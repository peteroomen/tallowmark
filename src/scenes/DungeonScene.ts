import Phaser from 'phaser';
import {
  ASSET_KEYS,
  COLORS,
  DUNGEON_H,
  DUNGEON_W,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_SCALE,
  SCENE_KEYS,
  TILE_SIZE,
} from '@/config';
import { Rng } from '@/core/Rng';
import { TurnEngine } from '@/core/TurnEngine';
import { CombatSystem } from '@/combat/CombatSystem';
import { Player } from '@/entities/Player';
import { Enemy, type EnemyAiContext } from '@/entities/Enemy';
import { RatAi } from '@/entities/ai/RatAi';
import { ArcherAi } from '@/entities/ai/ArcherAi';
import { Wayfarer } from '@/entities/classes/Wayfarer';
import { resolveStartingKit } from '@/entities/classes/ClassBlueprint';
import { generateBspDungeon, type GeneratedDungeon } from '@/world/Dungeon/BspGenerator';
import { TileKind, TILES } from '@/world/Tile';
import { CharsSheet, Inputs, UiLarge } from '@/world/FrameCatalog';
import { KenneyPlank } from '@/ui/KenneyPlank';
import { HpBar } from '@/ui/HpBar';
import { HungerBar } from '@/ui/HungerBar';
import { Minimap } from '@/ui/Minimap';
import { StatusIcon } from '@/ui/StatusIcon';
import { FogMask, fogKey } from '@/ui/FogMask';
import { computeFov } from '@/core/Fov';
import { GameEventBus, type LogTone } from '@/core/Events';
import { spawnFloatingText } from '@/ui/FloatingText';
import { findPath, findPathToBump } from '@/core/Pathfinding';
import { chebyshev, type Point } from '@/core/Grid';
import { newRunState, type RunState } from '@/state/RunState';
import { getServices } from '@/services';
import { buildIdentifications, displayName } from '@/items/Identification';
import { getItemDef } from '@/items/ItemCatalog';
import { placeItems, type ItemPlacement } from '@/world/Dungeon/ItemPlacement';
import { placeTraps } from '@/world/Dungeon/TrapPlacement';
import { isAdjacent, rollPerception, triggerTrap } from '@/world/Dungeon/Traps';
import { TRAP_CATALOG } from '@/world/Dungeon/TrapCatalog';
import { applyStatusTo } from '@/state/StatusBag';
import type { TrapState } from '@/state/RunState';
import {
  STARVATION_THRESHOLD,
  statusArmorBonus,
  tickHunger,
  tickStatuses,
  type TickEvent,
} from '@/state/PlayerTick';
import { hasStatus, tickStatusList } from '@/state/StatusBag';
import { STATUS_CATALOG, type StatusId, type StatusTarget } from '@/state/StatusCatalog';

interface DungeonSceneData {
  fresh?: boolean;
  resume?: boolean;
  /** True when re-entering after descending stairs. Loads runState but
   *  treats the world as fresh — regenerates layout, resets playerPos. */
  descend?: boolean;
}

/** Pool of floor descriptors picked deterministically per (seed, floor). */
const FLOOR_DESCRIPTOR_POOL: ReadonlyArray<'Quiet' | 'Cramped' | 'Open' | 'Trapped' | 'Hungry'> = [
  'Quiet',
  'Cramped',
  'Open',
  'Trapped',
  'Hungry',
];

const PLAYER_FRAME = CharsSheet.player;
const ENEMY_FRAME = CharsSheet.goblin;
const STEP_TWEEN_MS = 130;
const AUTO_STEP_INTERVAL_MS = 150; // > STEP_TWEEN_MS so steps don't pile up mid-animation

/**
 * Sight radius for fog-of-war shadowcasting. Classic-roguelike default of 8
 * tiles — feels right for the BSP corridor scale (rooms are 4-9 tiles wide,
 * so 8 sees across most rooms but only into one or two adjacent ones).
 * Tuned down from the scaffold value of 999 in stage 4's visual rollout.
 */
const SIGHT_RADIUS = 8;

/** Log tone → text colour. Drives the colour-coded message log. */
const LOG_TONE_COLORS: Record<LogTone, string> = {
  neutral: '#e5e3d8',   // bone — generic action
  discovery: '#d4a24c', // amber — discovery / item find
  danger: '#d44a4a',    // red — damage taken / hostile combat
  recovery: '#6aa84a',  // green — kill / heal / ember reward
  story: '#4a9ed4',     // cyan — narrative / NPC
};

/** Floating-text colours, used by combat / status code. */
const FT_COLOR_DAMAGE = '#d44a4a';
const FT_COLOR_DEATH = '#ff5050';

/**
 * Helper: world pixel coords of a tile's center.
 */
function tileToWorld(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
}

export class DungeonScene extends Phaser.Scene {
  private rng!: Rng;
  private turnEngine!: TurnEngine;
  private combat!: CombatSystem;
  private dungeon!: GeneratedDungeon;
  private player!: Player;
  private enemies: Enemy[] = [];
  private runState!: RunState;

  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  /** Last position the player saw an enemy at — keyed by enemy id. */
  private enemyLastSeen = new Map<number, Point>();
  /**
   * Translucent ghost sprites at last-seen positions. Shown when an enemy
   * is out of the player's FoV but their last-seen tile is still in
   * exploredTiles. Destroyed when the enemy is re-spotted (the live sprite
   * takes over) or when the enemy dies.
   */
  private enemyGhostSprites = new Map<number, Phaser.GameObjects.Image>();
  private hoverHighlight!: Phaser.GameObjects.Rectangle;
  private destinationMarker!: Phaser.GameObjects.Rectangle;

  private minimap?: Minimap;
  private hpText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  /** Pre-allocated 4 log slots; index 0 is newest (bottom), 3 is oldest (top). */
  private logTextSlots: Phaser.GameObjects.Text[] = [];
  private logLines: Array<{ tone: LogTone; message: string }> = [];
  private hpBar!: HpBar;
  private hungerBar!: HungerBar;
  private hungerText!: Phaser.GameObjects.Text;
  /** Container holding the status-icon row; rebuilt each refreshHud(). */
  private statusIconLayer!: Phaser.GameObjects.Container;

  /** Item entities on the floor — `pos` mirrors data, sprite mirrors render. */
  private items: Array<ItemPlacement & { sprite?: Phaser.GameObjects.Image }> = [];

  /** Trap sprites keyed by "x,y". Only revealed traps have a sprite. */
  private trapSprites = new Map<string, Phaser.GameObjects.Image>();

  /** One-shot perception boost flag — set by Search, consumed on next perception roll. */
  private searchBoost = false;

  /** Window-level keydown handler (QA workaround for physical '.' key). */
  private windowKeyHandler?: (e: KeyboardEvent) => void;
  /** Game event bus — combat / status / item code emits, UI subscribes. */
  private bus = new GameEventBus();

  private autoPath: Point[] = [];
  private autoStepTimer = 0;
  /** True once the death sequence has been started; used to avoid double-firing. */
  private deathSequenceStarted = false;

  // Fog of war
  private fogMask?: FogMask;
  private exploredTiles = new Set<string>();
  private visibleTiles = new Set<string>();

  // Death-transition timer (update-loop backup for the setTimeout in
  // handlePlayerDeath; whichever fires first wins, guarded by deathTransitionFired).
  private deathElapsedMs = 0;
  private deathTransitionFired = false;

  constructor() {
    super(SCENE_KEYS.Dungeon);
  }

  create(data: DungeonSceneData): void {
    const services = getServices(this);
    services.audio.playMusic('dungeon');

    // Scenes are reused — reset transient state.
    if (this.windowKeyHandler) {
      window.removeEventListener('keydown', this.windowKeyHandler, { capture: true });
      document.removeEventListener('keydown', this.windowKeyHandler, { capture: true });
      this.windowKeyHandler = undefined;
    }
    this.deathSequenceStarted = false;
    this.deathElapsedMs = 0;
    this.deathTransitionFired = false;
    this.autoPath = [];
    this.autoStepTimer = 0;
    this.enemies = [];
    this.enemySprites.clear();
    this.enemyLastSeen.clear();
    for (const ghost of this.enemyGhostSprites.values()) ghost.destroy();
    this.enemyGhostSprites.clear();
    this.logLines = [];
    this.bus.clear();
    this.cameras.main.resetFX();
    // Per refinement-002 §J: 350 ms fade-IN on descent so the transition
    // matches the descendToNextFloor fade-OUT. Other entry types (fresh /
    // resume) skip this — the title card already does the framing work.
    if (data.descend) {
      this.cameras.main.fadeIn(350, 0, 0, 0);
    }

    this.items = [];
    for (const s of this.trapSprites.values()) s.destroy();
    this.trapSprites.clear();
    this.searchBoost = false;
    if ((data.resume || data.descend) && services.save.loadRun()) {
      this.runState = services.save.loadRun()!;
    } else {
      const seed = Date.now() & 0x7fffffff;
      const seedRng = Rng.fromSeed(seed);
      // Resolve the Wayfarer's starting kit using the run RNG so the
      // "1× Hardtack + 1× random unidentified potion" pick is reproducible
      // per seed.
      const startingKit = resolveStartingKit(Wayfarer, seedRng);
      this.runState = newRunState(
        seed,
        { x: 0, y: 0 },
        buildIdentifications(seedRng),
        Wayfarer,
        startingKit,
      );
    }

    // Per-floor RNG: same base seed XOR the floor number so each floor is
    // deterministically distinct. Combat / item / trap / enemy placement all
    // share this single rng, so a floor is fully reproducible from
    // (seed, floor).
    this.rng = Rng.fromSeed((this.runState.seed ^ (this.runState.floor * 31337)) | 0);
    this.combat = new CombatSystem(this.rng);
    this.turnEngine = new TurnEngine();
    this.dungeon = generateBspDungeon(DUNGEON_W, DUNGEON_H, this.rng);

    // Floor descriptor — deterministic per (seed, floor); a fresh rng so the
    // descriptor doesn't drift if combat/item placement RNG is changed later.
    const descriptorRng = Rng.fromSeed(
      (this.runState.seed ^ (this.runState.floor * 0xdeadbeef)) | 0,
    );
    this.runState.floorDescriptor = descriptorRng.pick(FLOOR_DESCRIPTOR_POOL);

    // Place stairs-up at the player's start tile on floor 1 only — climbing
    // exits to town. Deeper floors are descent-only (no stairs-up).
    if (this.runState.floor === 1) {
      this.dungeon.tiles.set(
        this.dungeon.playerStart.x,
        this.dungeon.playerStart.y,
        TileKind.StairsUp,
      );
    }

    if (!data.resume) {
      // Fresh run OR descend — both want the player at the new layout's
      // start tile. Resume keeps the player wherever they were on save.
      this.runState.playerPos = { ...this.dungeon.playerStart };
      // Descending also clears floor-local state.
      if (data.descend) {
        this.runState.exploredTiles = [];
        this.runState.traps = [];
      }
    }

    this.player = new Player(this.runState.playerPos, { ...this.runState.player });

    this.spawnEnemies();
    this.spawnItems();
    this.spawnTraps();
    this.drawTiles();
    this.drawItems();
    this.drawTraps();
    this.drawHoverAndMarker();
    this.drawActors();
    this.drawHud();
    this.setupCamera();
    this.minimap = new Minimap(
      { scene: this, rightOffset: 8, bottomOffset: 110, pxPerTile: 3 },
      this.dungeon.tiles.width,
      this.dungeon.tiles.height,
    );

    // Fog of war scaffold: rehydrate explored set, build the mask, do an
    // initial FoV compute so the player can see immediately on entry.
    this.exploredTiles = new Set(this.runState.exploredTiles);
    this.fogMask = new FogMask({
      scene: this,
      cols: this.dungeon.tiles.width,
      rows: this.dungeon.tiles.height,
    });
    this.recomputeFov();
    this.refreshMinimap();

    this.turnEngine.onWorldTick(() => this.runEnemyTurns());
    // Hunger + status ticks fire after enemy turns so any death this turn
    // (starvation, poison) is resolved together with combat damage.
    this.turnEngine.onWorldTick(() => this.runPlayerTicks());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMouseMove(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    // Belt-and-suspenders wait keys: Phaser's specific keydown-* events
    // sometimes fire when the generic keydown handler doesn't (different
    // input layers, different e.key/e.code reporting). Bind PERIOD and
    // NUMPAD_FIVE explicitly so '.' and '5' both wait reliably.
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-PERIOD', () => {
        if (this.player.alive) this.tryStep(this.player.pos);
      });
      kb.on('keydown-NUMPAD_FIVE', () => {
        if (this.player.alive) this.tryStep(this.player.pos);
      });
      // V6 fix: explicitly tell Phaser to capture (preventDefault) the period
      // keys at the keyboard-plugin level. Stops the browser from routing
      // physical '.' presses to focused-but-invisible DOM elements after the
      // first interaction (the QA-pass-v5 bug — '.' worked once then went
      // silent). With addCapture, Phaser owns these keys exclusively.
      kb.addCapture('PERIOD,NUMPAD_DECIMAL,NUMPAD_FIVE');
    }

    // V6 fix — last-resort listener stack. Three QA passes have surfaced the
    // same regression: physical '.' presses stop reaching the game after the
    // first interaction. Each previous fix (kb.on, then window listener)
    // worked in isolation but failed in some browser/focus combinations.
    // This round: capture-phase listener on BOTH window AND document, so we
    // intercept the keydown at the earliest possible point regardless of which
    // element the browser has focused. capture: true ensures we run before
    // any handler that might call stopPropagation.
    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (!this.player.alive) return;
      if (this.scene.isPaused()) return;
      const k = (e.key ?? '').toLowerCase();
      const c = e.code ?? '';
      if (
        k === '.' ||
        k === 'period' ||
        k === 'decimal' ||
        k === 'numpaddecimal' ||
        c === 'Period' ||
        c === 'NumpadDecimal'
      ) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[period-key v6] received', { key: e.key, code: e.code });
        }
        e.preventDefault();
        e.stopPropagation();
        this.tryStep(this.player.pos);
      }
    };
    window.addEventListener('keydown', this.windowKeyHandler, { capture: true });
    document.addEventListener('keydown', this.windowKeyHandler, { capture: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.windowKeyHandler) {
        window.removeEventListener('keydown', this.windowKeyHandler, { capture: true });
        document.removeEventListener('keydown', this.windowKeyHandler, { capture: true });
        this.windowKeyHandler = undefined;
      }
    });

    // Subscribe to the event bus before anything emits. UI translations
    // live here: 'log' events append a tone-coloured line; 'floatingText'
    // events spawn an ephemeral bouncer at the tile.
    this.bus.on((event) => {
      switch (event.kind) {
        case 'log':
          this.logLines.push({ tone: event.tone, message: event.message });
          if (this.logLines.length > 50) this.logLines.shift();
          this.refreshLog();
          break;
        case 'floatingText':
          spawnFloatingText(this, event.spec);
          break;
        case 'turnAdvanced':
          // No-op for now; will hang status-effect tick / hunger tick here
          // in stage 6.
          break;
      }
    });

    services.save.saveRun(this.runState);
    if (data.descend) {
      this.log(`The stairs end. ${this.flavourFor(this.runState.floorDescriptor)}.`, 'story');
      this.log(`Floor ${this.runState.floor} — ${this.runState.floorDescriptor}.`, 'discovery');
      this.showFloorTitleCard();
    } else if (!data.resume) {
      this.log('Stale air, distant scratching.', 'story');
      this.log(
        `Floor ${this.runState.floor} — ${this.runState.floorDescriptor}. Seed ${this.runState.seed}.`,
        'discovery',
      );
      this.log('Watch for traps. Eat when you can.', 'neutral');
      this.showFloorTitleCard();
    } else {
      this.log('You resume your descent.', 'neutral');
      this.log(
        `Floor ${this.runState.floor} — ${this.runState.floorDescriptor}, turn ${this.runState.turn}.`,
        'discovery',
      );
    }

    // Dev hook for tests / AI agents — exposes a way to trigger game events
    // without needing to drive the BSP-generated layout to a specific state.
    if (import.meta.env.DEV) {
      // Dev hooks for QA / AI agents — surface in window.__tallowmark.* so the
      // QA agent can deterministically trigger features that are otherwise
      // gated by RNG (which trap kind spawned, which item, etc.). Each hook
      // is no-op if its preconditions aren't met (e.g. no trap nearby).
      const w = window as unknown as {
        __tallowmark?: {
          killPlayer?: () => void;
          triggerTrap?: (kind?: 'spike' | 'gas' | 'alarm') => void;
          applyStatus?: (id: StatusId, turns?: number) => void;
          giveItem?: (defId: string, count?: number) => void;
        };
      };
      w.__tallowmark = w.__tallowmark ?? {};
      w.__tallowmark.killPlayer = () => {
        this.player.stats.hp = 0;
        this.player.alive = false;
        this.runState.player = { ...this.player.stats };
        this.log('You die.', 'danger');
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: 'DIED', color: FT_COLOR_DEATH, size: 'large' },
        });
        this.handlePlayerDeath();
      };
      w.__tallowmark.triggerTrap = (kind) => {
        // Spawn a trap of the requested kind on the player's tile (revealed)
        // and immediately fire it. Lets QA test all trap effects without
        // RNG-walking around the dungeon hoping to find one.
        const requested: 'spike' | 'gas' | 'alarm' = kind ?? 'spike';
        const trap = { pos: { ...this.player.pos }, kind: requested, revealed: true };
        this.runState.traps.push(trap);
        this.placeTrapSprite(trap);
        this.handleTrapStep();
        getServices(this).save.saveRun(this.runState);
        this.refreshHud();
      };
      w.__tallowmark.applyStatus = (id, turns) => {
        applyStatusTo(this.runState.activeStatuses, id, turns ?? 5);
        this.log(`(dev) applied ${id} ×${turns ?? 5}`, 'discovery');
        this.flashSpriteForStatus(this.playerSprite);
        getServices(this).save.saveRun(this.runState);
        this.refreshHud();
      };
      w.__tallowmark.giveItem = (defId, count) => {
        const def = getItemDef(defId);
        if (!def) {
          this.log(`(dev) unknown item def: ${defId}`, 'danger');
          return;
        }
        for (let i = 0; i < (count ?? 1); i++) {
          const existing = def.stackable
            ? this.runState.inventory.find((s) => s.defId === def.id)
            : null;
          if (existing) existing.count += 1;
          else this.runState.inventory.push({ defId: def.id, count: 1 });
        }
        this.log(`(dev) +${count ?? 1} ${def.trueName}`, 'discovery');
        // Persist so the next InventoryScene open (which loads from
        // SaveStore) sees the new items. QA-v6 caught this — without the
        // save, the in-memory mutation was invisible to the overlay.
        getServices(this).save.saveRun(this.runState);
      };
    }
    void COLORS;
  }

  override update(_time: number, delta: number): void {
    // Safety net: if the player has died but the death sequence wasn't kicked
    // off (e.g. a state mutation outside endRound), trigger it now.
    if (!this.player.alive && !this.deathSequenceStarted) {
      this.handlePlayerDeath();
    }

    // Update-loop backup for the death-transition timer. setTimeout(600)
    // turned out to be unreliable in some browser environments (QA pass
    // saw 5+ second delays); the update-loop delta always ticks each frame
    // regardless of timer throttling, so we count off ~600ms here too and
    // whichever fires first wins.
    if (this.deathSequenceStarted && !this.deathTransitionFired) {
      this.deathElapsedMs += delta;
      if (this.deathElapsedMs >= 600) {
        this.deathTransitionFired = true;
        this.toDeathSummary();
        return;
      }
    }

    if (this.autoPath.length > 0 && this.player.alive) {
      this.autoStepTimer -= delta;
      if (this.autoStepTimer <= 0) {
        const next = this.autoPath.shift();
        if (next) {
          this.tryStep(next);
          this.autoStepTimer = AUTO_STEP_INTERVAL_MS;
        }
        if (this.autoPath.length === 0) {
          this.destinationMarker.setVisible(false);
        }
      }
    }
  }

  // ---------- Camera ----------

  private setupCamera(): void {
    const worldW = this.dungeon.tiles.width * TILE_SIZE;
    const worldH = this.dungeon.tiles.height * TILE_SIZE;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.playerSprite, true, 0.15, 0.15);
    // Deadzone: the camera only moves when the player approaches the edge of
    // a central rectangle. Reduces viewport sloshing during auto-path (QA-v5
    // perceived this as "camera centres on clicked tiles" — actually it's
    // tracking the player who's walking to the click). 60% of viewport.
    cam.setDeadzone(GAME_WIDTH * 0.6, GAME_HEIGHT * 0.6);
    cam.setBackgroundColor(COLORS.bg);
  }

  // ---------- World generation & rendering ----------

  private spawnEnemies(): void {
    // Floor-scaled enemy budget: floor 1 = 2-3, scaling up by floor.
    // Descriptor modifiers: Quiet -1 (fewer enemies, more loot); Cramped +1
    // (more bodies in tight halls); Hungry / Open / Trapped neutral.
    const base = Math.min(2 + this.runState.floor, 8);
    const descriptorAdj =
      this.runState.floorDescriptor === 'Quiet'
        ? -1
        : this.runState.floorDescriptor === 'Cramped'
          ? 1
          : 0;
    const budget = Math.max(1, base + descriptorAdj);
    const candidates = this.rng.shuffle(this.dungeon.rooms.slice(1));
    let placed = 0;
    for (const room of candidates) {
      if (placed >= budget) break;
      const rx = this.rng.intInclusive(room.x1, room.x2);
      const ry = this.rng.intInclusive(room.y1, room.y2);
      if (this.dungeon.tiles.get(rx, ry) !== TileKind.Floor) continue;
      // Floor 2+: roughly 1 in 3 enemies is a Skeleton Archer (iter-2 stage 9
      // glass cannon). Floor 1 stays goblin-only so the new mechanics don't
      // overwhelm a first-time player.
      const isArcher =
        this.runState.floor >= 2 && this.rng.next() < 0.33;
      const enemy = isArcher
        ? new Enemy(
            { x: rx, y: ry },
            { hp: 3, hpMax: 3, power: 3, armor: 0 },
            'skeleton_archer',
            'Skeleton Archer',
            new ArcherAi(),
          )
        : new Enemy(
            { x: rx, y: ry },
            { hp: 5, hpMax: 5, power: 2, armor: 0 },
            'goblin',
            'Goblin',
            new RatAi(),
          );
      this.enemies.push(enemy);
      placed += 1;
    }
  }

  private drawTiles(): void {
    // v2 dungeon visuals: palette-tinted rectangles for walls/floors. Proper
    // Kenney stone tiles will replace these once frames are picked via the
    // debug scene. Tile sprites live in WORLD coordinates — Phaser's main
    // camera follows the player to scroll the view.
    for (let y = 0; y < this.dungeon.tiles.height; y++) {
      for (let x = 0; x < this.dungeon.tiles.width; x++) {
        const kind = this.dungeon.tiles.get(x, y);
        const w = tileToWorld(x, y);
        let color: number;
        switch (kind) {
          case TileKind.Wall:
            color = 0x32323a;
            break;
          case TileKind.Floor:
            color = 0x6a6470;
            break;
          case TileKind.StairsDown:
            color = 0xd4a24c;
            break;
          case TileKind.StairsUp:
            color = 0x9a988e;
            break;
          case TileKind.Door:
            color = 0x6a4a2f;
            break;
          default:
            color = 0x4a4a52;
        }
        const rect = this.add.rectangle(w.x, w.y, TILE_SIZE, TILE_SIZE, color).setOrigin(0.5);
        if (kind === TileKind.Floor) rect.setStrokeStyle(1, 0x4a444f);
        else if (kind === TileKind.Wall) rect.setStrokeStyle(1, 0x1a1a22);
        void TILES[kind].iconFrame;
      }
    }
  }

  private drawHoverAndMarker(): void {
    // Depth 60 — above the FogMask at depth 50, below HUD at 1000+. Lets
    // the cursor highlight remain visible over fogged tiles so the player
    // can still see where they're aiming.
    this.hoverHighlight = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0)
      .setStrokeStyle(2, 0xffd76a, 0.85)
      .setOrigin(0.5)
      .setDepth(60)
      .setVisible(false);

    this.destinationMarker = this.add
      .rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0xd4a24c, 0.18)
      .setStrokeStyle(2, 0xd4a24c, 1)
      .setOrigin(0.5)
      .setDepth(60)
      .setVisible(false);
  }

  private drawActors(): void {
    const pw = tileToWorld(this.player.pos.x, this.player.pos.y);
    this.playerSprite = this.add
      .image(pw.x, pw.y, ASSET_KEYS.sprites.chars, PLAYER_FRAME)
      .setScale(RENDER_SCALE)
      .setOrigin(0.5)
      .setDepth(10);

    for (const e of this.enemies) {
      const ew = tileToWorld(e.pos.x, e.pos.y);
      const frame = e.kind === 'skeleton_archer' ? CharsSheet.skeletonArcher : ENEMY_FRAME;
      const s = this.add
        .image(ew.x, ew.y, ASSET_KEYS.sprites.chars, frame)
        .setScale(RENDER_SCALE)
        .setOrigin(0.5)
        .setDepth(9);
      this.enemySprites.set(e.id, s);
    }
  }

  private drawHud(): void {
    const stroke = { stroke: '#1a1a24', strokeThickness: 3 };

    // Stat plank — backs HP/Hunger bars + numeric labels.
    new KenneyPlank({
      scene: this,
      x: 4,
      y: 4,
      width: 360,
      height: 60,
      variant: 'wood',
    })
      .setScrollFactor(0)
      .setDepth(99);

    // HP bar (top row) + numeric HP/Pow/Arm (right of bar).
    this.hpBar = new HpBar({
      scene: this,
      x: 14,
      y: 18,
      width: 110,
      height: 12,
      originX: 0,
      originY: 0.5,
    });
    this.hpBar.setScrollFactor(0).setDepth(1000);

    this.hpText = this.add
      .text(132, 12, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        ...stroke,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    // Hunger bar (bottom row of the stat plank) + numeric food + status icons.
    this.hungerBar = new HungerBar({
      scene: this,
      x: 14,
      y: 42,
      width: 110,
      height: 10,
      originX: 0,
      originY: 0.5,
    });
    this.hungerBar.setScrollFactor(0).setDepth(1000);

    this.hungerText = this.add
      .text(132, 36, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cfcfd5',
        ...stroke,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    // Status icon row — 16×16 sprites tinted by their StatusDef colour, each
    // with a small remaining-turns countdown. Container is repopulated in
    // refreshHud() so we don't leak nodes when statuses come and go.
    this.statusIconLayer = this.add
      .container(220, 38)
      .setScrollFactor(0)
      .setDepth(1000);

    // Floor / turn plank top-right.
    new KenneyPlank({
      scene: this,
      x: GAME_WIDTH - 184,
      y: 4,
      width: 180,
      height: 28,
      variant: 'wood',
    })
      .setScrollFactor(0)
      .setDepth(99);
    this.floorText = this.add
      .text(GAME_WIDTH - 14, 11, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d4a24c',
        ...stroke,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    // Log plank — narrow horizontal slate strip at the bottom-left, behind
    // the message log so it reads against busy tiles.
    new KenneyPlank({
      scene: this,
      x: 4,
      y: GAME_HEIGHT - 96,
      width: 580,
      height: 64,
      variant: 'dark',
      alpha: 0.7,
    })
      .setScrollFactor(0)
      .setDepth(99);

    // Pre-allocated 4 log slots, each its own Text object so we can colour
    // lines independently. Slot 0 is the newest line (anchored bottom),
    // slot 3 is the oldest (top of the log block). Origin (0, 1) means each
    // line's baseline sits at its anchor y.
    this.logTextSlots = [];
    const lineStride = 14;
    const baseY = GAME_HEIGHT - 38;
    for (let i = 0; i < 4; i++) {
      const t = this.add
        .text(16, baseY - i * lineStride, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e5e3d8',
          wordWrap: { width: 560 },
          ...stroke,
        })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(1000)
        .setVisible(false);
      this.logTextSlots.push(t);
    }

    this.drawHudIcons();
    this.drawControlsHint();
    this.refreshHud();
  }

  private drawHudIcons(): void {
    const items: Array<{ frame: number; key: string; tooltip: string; onClick: () => void }> = [
      {
        frame: UiLarge.buttonGrey,
        key: 'I',
        tooltip: 'Inventory (i)',
        onClick: () => this.openOverlay(SCENE_KEYS.Inventory),
      },
      {
        frame: UiLarge.buttonGrey,
        key: 'C',
        tooltip: 'Character (c)',
        onClick: () => this.openOverlay(SCENE_KEYS.Character),
      },
      {
        frame: UiLarge.buttonGrey,
        key: '≡',
        tooltip: 'Pause (esc)',
        onClick: () => {
          this.scene.launch(SCENE_KEYS.Pause);
          this.scene.pause();
        },
      },
    ];
    let x = GAME_WIDTH - 24;
    const y = 80;
    for (const it of items) {
      const slice = this.add
        .nineslice(x, y, ASSET_KEYS.ui.large, it.frame, 48, 48, 6, 6, 6, 6)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1000);
      this.add
        .text(x, y, it.key, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#3a2a1f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001);
      // Hit zone — explicit interactive shape so the entire visual area is
      // clickable (avoids the Phaser Container hit-area quirk we saw on
      // KenneyButton).
      const zone = this.add
        .zone(x, y, 48, 48)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1002)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => slice.setAlpha(0.9));
      zone.on('pointerout', () => slice.setAlpha(1));
      zone.on('pointerdown', () => slice.setAlpha(0.78));
      zone.on('pointerup', () => {
        slice.setAlpha(1);
        try {
          getServices(this).audio.playSfx(ASSET_KEYS.audio.sfxClick);
        } catch {
          /* no-op in test envs */
        }
        it.onClick();
      });
      x -= 56; // 48px button + 8px gutter (per CLAUDE.md 48px touch floor)
    }
  }

  private drawControlsHint(): void {
    const y = GAME_HEIGHT - 18;
    const items: Array<[number, string]> = [
      [Inputs.mouseLeft, 'path'],
      [Inputs.arrowUp, 'step'],
    ];
    let cx = 8;
    for (const [icon, label] of items) {
      this.add
        .image(cx, y, ASSET_KEYS.ui.inputs, icon)
        .setOrigin(0, 0.5)
        .setScale(2)
        .setScrollFactor(0)
        .setDepth(1000);
      cx += 28;
      const t = this.add
        .text(cx, y, label, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#e5e3d8',
          stroke: '#1a1a24',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(1000);
      cx += t.width + 12;
    }
  }

  private refreshHud(): void {
    const stats = this.player.stats;
    const armorBonus = statusArmorBonus(this.runState);
    const armorStr = armorBonus > 0 ? `${stats.armor}+${armorBonus}` : `${stats.armor}`;
    this.hpBar.setHp(stats.hp, stats.hpMax);
    this.hpText.setText(`HP ${stats.hp}/${stats.hpMax}   Pow ${stats.power}   Arm ${armorStr}`);
    this.hungerBar.setFood(this.runState.food, this.runState.foodMax);
    const hungerLabel =
      this.runState.food === 0 ? 'STARVING' : this.runState.food < STARVATION_THRESHOLD ? 'Hungry' : 'Fed';
    this.hungerText.setText(`Food ${this.runState.food}/${this.runState.foodMax}  ${hungerLabel}`);
    this.refreshStatusIcons();
    this.floorText.setText(
      `Floor ${this.runState.floor} — ${this.runState.floorDescriptor}    Turn ${this.runState.turn}`,
    );
  }

  /** Rebuild the status-icon row in the HUD. Icons tinted by status colour. */
  private refreshStatusIcons(): void {
    // Per refinement-002 §B: programmatic 3-field status icons (glyph +
    // colour + frame style) with 3-state countdown. The new StatusIcon
    // widget owns its own pulse + flash tweens, so we just instantiate
    // and call setTurnsRemaining for each active status.
    this.statusIconLayer.removeAll(true);
    const ICON = 36;
    const LABEL_W = 36; // room for "Fort 12" label after each icon
    const STRIDE = ICON + LABEL_W;
    let i = 0;
    for (const s of this.runState.activeStatuses) {
      const def = STATUS_CATALOG[s.id];
      if (!def) continue;
      const x = i * STRIDE + ICON / 2;
      const icon = new StatusIcon(this, def, ICON);
      icon.setPosition(x, 0);
      icon.setTurnsRemaining(s.turnsRemaining);
      const label = this.add
        .text(x + ICON / 2 + 4, 0, def.label, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: def.color,
          stroke: '#1a1a24',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);
      this.statusIconLayer.add([icon, label]);
      i++;
    }
  }

  /**
   * Fill the 4 log slots with the most recent lines, each in its tone colour.
   * Slot 0 = newest (bottom), slot 3 = oldest (top).
   */
  private refreshLog(): void {
    const recent = this.logLines.slice(-4);
    for (let i = 0; i < 4; i++) {
      const slot = this.logTextSlots[i];
      if (!slot) continue;
      // Reverse-index so slot 0 holds recent[N-1] (newest).
      const line = recent[recent.length - 1 - i];
      if (line) {
        slot.setText(line.message);
        slot.setColor(LOG_TONE_COLORS[line.tone]);
        slot.setVisible(true);
      } else {
        slot.setVisible(false);
      }
    }
  }

  /** Sugar — emits a `log` event onto the bus. */
  private log(message: string, tone: LogTone = 'neutral'): void {
    this.bus.emit({ kind: 'log', tone, message });
  }

  /** Pause the dungeon and open the named overlay scene; resumes on close. */
  private openOverlay(key: string): void {
    this.scene.launch(key, { returnTo: SCENE_KEYS.Dungeon });
    this.scene.pause();
  }

  // ---------- Animation helpers ----------

  /** Tween a sprite to the given tile. Logical state should already reflect the move. */
  private tweenTo(sprite: Phaser.GameObjects.Image, tile: Point): void {
    const w = tileToWorld(tile.x, tile.y);
    if (sprite.x === w.x && sprite.y === w.y) return;
    this.tweens.add({
      targets: sprite,
      x: w.x,
      y: w.y,
      duration: STEP_TWEEN_MS,
      ease: 'Quad.easeOut',
    });
  }

  /** Quick "lunge" toward a target tile and back — used for bump attacks. */
  /**
   * Per refinement-002 §J: 180 ms single white pulse on a target sprite when
   * a status is applied. ONE pulse only — two reads as broken. The flash is a
   * white rectangle overlay at depth 11 (above actors at 9-10), alpha 0.7 → 0.
   */
  private flashSpriteForStatus(sprite: Phaser.GameObjects.Image): void {
    const overlay = this.add
      .rectangle(sprite.x, sprite.y, TILE_SIZE, TILE_SIZE, 0xffffff, 0.7)
      .setOrigin(0.5)
      .setDepth(11);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => overlay.destroy(),
    });
  }

  private lungeAt(sprite: Phaser.GameObjects.Image, target: Point): void {
    // Per refinement-002 §J: 70 ms out + 70 ms back, with a ~6 px overshoot
    // past the midpoint (easeOutBack). Reads as a real "throw weight into it"
    // motion vs the previous symmetric yoyo.
    const from = { x: sprite.x, y: sprite.y };
    const to = tileToWorld(target.x, target.y);
    // Vector toward target; midpoint + 6 px past the midpoint.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const overshoot = 6;
    const peakX = from.x + dx * 0.5 + (dx / len) * overshoot;
    const peakY = from.y + dy * 0.5 + (dy / len) * overshoot;
    this.tweens.add({
      targets: sprite,
      x: peakX,
      y: peakY,
      duration: 70,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          x: from.x,
          y: from.y,
          duration: 70,
          ease: 'Quad.easeIn',
        });
      },
    });
  }

  // ---------- Game logic ----------

  private isWalkable(x: number, y: number): boolean {
    if (!this.dungeon.tiles.inBounds(x, y)) return false;
    const def = TILES[this.dungeon.tiles.get(x, y)];
    return def.walkable;
  }

  private enemyAt(x: number, y: number): Enemy | null {
    return this.enemies.find((e) => e.alive && e.pos.x === x && e.pos.y === y) ?? null;
  }

  private worldPointToTile(worldX: number, worldY: number): Point {
    return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
  }

  private onMouseMove(p: Phaser.Input.Pointer): void {
    const tile = this.worldPointToTile(p.worldX, p.worldY);
    if (!this.dungeon.tiles.inBounds(tile.x, tile.y)) {
      this.hoverHighlight.setVisible(false);
      return;
    }
    const w = tileToWorld(tile.x, tile.y);
    this.hoverHighlight.setPosition(w.x, w.y).setVisible(true);
    // Hover color: gold if walkable / has enemy (a valid target), red-tinted if blocked.
    const hasEnemy = !!this.enemyAt(tile.x, tile.y);
    const blocked = !this.isWalkable(tile.x, tile.y) && !hasEnemy;
    this.hoverHighlight.setStrokeStyle(2, blocked ? 0xb84a4a : 0xffd76a, 0.85);
  }

  private onClick(p: Phaser.Input.Pointer): void {
    if (!this.player.alive) return;
    const target = this.worldPointToTile(p.worldX, p.worldY);
    if (!this.dungeon.tiles.inBounds(target.x, target.y)) return;

    // Tap distinction (per refinement-002 §09): adjacent tap = direct step
    // (skip pathfinding), distant tap = auto-path. One rule, two behaviours,
    // zero ambiguity. Tapping yourself = wait one turn.
    if (chebyshev(this.player.pos, target) <= 1) {
      this.autoPath = [];
      this.destinationMarker.setVisible(false);
      this.tryStep(target);
      return;
    }

    const enemy = this.enemyAt(target.x, target.y);
    const path = enemy
      ? findPathToBump(this.player.pos, target, (x, y) => this.isWalkable(x, y) && !this.enemyAt(x, y))
      : findPath(this.player.pos, target, (x, y) => this.isWalkable(x, y) && !this.enemyAt(x, y));
    if (path.length <= 1) return;
    this.autoPath = path.slice(1);
    this.autoStepTimer = 0;

    // Show destination marker on the goal tile.
    const goal = path[path.length - 1]!;
    const w = tileToWorld(goal.x, goal.y);
    this.destinationMarker.setPosition(w.x, w.y).setVisible(true);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.player.alive) {
      if (e.key === 'Enter' || e.key === ' ') this.toDeathSummary();
      return;
    }
    if (e.key === 'Escape') {
      this.scene.launch(SCENE_KEYS.Pause);
      this.scene.pause();
      return;
    }
    if (e.key === 'i' || e.code === 'KeyI') {
      this.openOverlay(SCENE_KEYS.Inventory);
      return;
    }
    if (e.key === 'c' || e.code === 'KeyC') {
      this.openOverlay(SCENE_KEYS.Character);
      return;
    }
    if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
      this.minimap?.toggle();
      return;
    }
    if (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ') {
      // Search: enhanced wait. Boosts the next perception roll to ~0.8 and
      // advances the turn so adjacent unrevealed traps get a high-chance
      // reveal. Touch-friendly equivalent (long-press the wait button) lands
      // alongside the touch input layer in iter 6.
      this.searchBoost = true;
      this.log('You search the area.', 'discovery');
      this.tryStep(this.player.pos);
      return;
    }

    // Match against both `e.key` and `e.code`. Some automation tools fire
    // KeyboardEvent with non-standard casing on the `key` field — e.g.
    // 'Period' instead of 'period', or 'KeyW' instead of 'w'. Lowercase
    // the whole thing so casing differences don't sink the match.
    const k = (e.key ?? '').toLowerCase();
    const c = e.code ?? '';
    let dx = 0;
    let dy = 0;
    if (k === 'arrowup' || k === 'w' || k === 'k' || c === 'ArrowUp' || c === 'KeyW' || c === 'KeyK') {
      dy = -1;
    } else if (k === 'arrowdown' || k === 's' || k === 'j' || c === 'ArrowDown' || c === 'KeyS' || c === 'KeyJ') {
      dy = 1;
    } else if (k === 'arrowleft' || k === 'a' || k === 'h' || c === 'ArrowLeft' || c === 'KeyA' || c === 'KeyH') {
      dx = -1;
    } else if (k === 'arrowright' || k === 'd' || k === 'l' || c === 'ArrowRight' || c === 'KeyD' || c === 'KeyL') {
      dx = 1;
    } else if (k === 'y' || c === 'KeyY') {
      dx = -1;
      dy = -1;
    } else if (k === 'u' || c === 'KeyU') {
      dx = 1;
      dy = -1;
    } else if (k === 'b' || c === 'KeyB') {
      dx = -1;
      dy = 1;
    } else if (k === 'n' || c === 'KeyN') {
      dx = 1;
      dy = 1;
    } else if (
      k === '.' ||
      k === '5' ||
      k === 'clear' ||
      k === 'decimal' ||
      // The W3C key name for the period key is 'Period' — some automation
      // tools fire e.key = 'period' (lowercase) instead of '.'. Match both
      // string forms in addition to e.code.
      k === 'period' ||
      k === 'numpad5' ||
      k === 'numpaddecimal' ||
      c === 'Period' ||
      c === 'Numpad5' ||
      c === 'NumpadDecimal'
    ) {
      this.tryStep(this.player.pos);
      return;
    } else {
      return;
    }
    this.autoPath = [];
    this.destinationMarker.setVisible(false);
    // Confused mirrors keyboard movement direction. Click-to-path bypasses
    // this on purpose — a player navigating with the mouse would otherwise
    // be unable to move while confused. Keyboard movers feel the cost.
    if (hasStatus(this.runState.activeStatuses, 'confused')) {
      dx = -dx;
      dy = -dy;
    }
    this.tryStep({ x: this.player.pos.x + dx, y: this.player.pos.y + dy });
  }

  private tryStep(target: Point): void {
    if (!this.player.alive) return;
    if (chebyshev(this.player.pos, target) > 1) return;

    if (target.x === this.player.pos.x && target.y === this.player.pos.y) {
      this.endRound(() => {});
      return;
    }
    if (!this.dungeon.tiles.inBounds(target.x, target.y)) return;
    if (!this.isWalkable(target.x, target.y)) return;

    const occupant = this.enemyAt(target.x, target.y);
    if (occupant) {
      this.endRound(() => this.playerAttack(occupant));
      return;
    }

    const tile = this.dungeon.tiles.get(target.x, target.y);
    if (tile === TileKind.StairsDown) {
      // Step onto stairs-down → descend to next floor. Player state (HP,
      // inventory, statuses, embers, kills) carries; floor-local state
      // (explored, traps, layout) regenerates.
      this.player.pos = { ...target };
      this.runState.playerPos = { ...target };
      this.tweenTo(this.playerSprite, target);
      this.descendToNextFloor();
      return;
    }
    if (tile === TileKind.StairsUp) {
      // Step onto stairs-up (only present on floor 1) → exit to town with
      // banked Embers. Deeper floors have no stairs-up; you can only go
      // down or die.
      this.log('You climb back up to Tallowmark with what you found.', 'recovery');
      this.player.pos = { ...target };
      this.runState.playerPos = { ...target };
      this.tweenTo(this.playerSprite, target);
      this.completeRunSurvived();
      return;
    }

    this.endRound(() => {
      this.player.pos = { ...target };
      this.runState.playerPos = { ...target };
      this.tweenTo(this.playerSprite, target);
      this.tryPickup();
      this.handleTrapStep();
    });
  }

  private endRound(playerAction: () => void): void {
    this.turnEngine.submitPlayerAction(() => {
      playerAction();
      // Track turn directly on RunState. Don't piggyback on the turnEngine's
      // internal counter — the engine resets to 0 each scene mount, so a
      // mid-run Continue would otherwise wipe the turn number.
      this.runState.turn += 1;
    });
    this.cleanupDeadEnemies();
    this.runState.player = { ...this.player.stats };
    this.recomputeFov();
    // exploredTiles is updated inside recomputeFov; persist it on the run.
    this.runState.exploredTiles = Array.from(this.exploredTiles);
    getServices(this).save.saveRun(this.runState);
    this.refreshHud();
    this.refreshMinimap();
    if (!this.player.alive) {
      this.handlePlayerDeath();
    }
  }

  /** Re-render the minimap from current dungeon state. Cheap. */
  private refreshMinimap(): void {
    if (!this.minimap) return;
    const ghosts: Point[] = [];
    for (const ghost of this.enemyGhostSprites.values()) {
      const tx = Math.floor(ghost.x / TILE_SIZE);
      const ty = Math.floor(ghost.y / TILE_SIZE);
      ghosts.push({ x: tx, y: ty });
    }
    this.minimap.render({
      tiles: this.dungeon.tiles,
      visibleKeys: this.visibleTiles,
      exploredKeys: this.exploredTiles,
      playerPos: this.player.pos,
      enemies: this.enemies.map((e) => ({ pos: e.pos, alive: e.alive })),
      enemyGhosts: ghosts,
      items: this.items.map((i) => ({ pos: i.pos })),
      revealedTraps: this.runState.traps.filter((t) => t.revealed).map((t) => ({ pos: t.pos })),
    });
  }

  /**
   * Compute current FoV from the player's position, update the FogMask,
   * and gate enemy sprite visibility — enemies outside the player's FoV
   * are hidden so they can't be tracked through walls.
   */
  private recomputeFov(): void {
    const isOpaque = (x: number, y: number): boolean => {
      if (!this.dungeon.tiles.inBounds(x, y)) return true;
      return TILES[this.dungeon.tiles.get(x, y)].opaque;
    };
    this.visibleTiles = computeFov(this.player.pos, SIGHT_RADIUS, isOpaque);
    for (const key of this.visibleTiles) this.exploredTiles.add(key);
    if (this.fogMask) this.fogMask.update(this.visibleTiles, this.exploredTiles);

    // Enemy visibility — and "last-known position" ghost markers.
    //
    // Live sprite shows when the enemy is in the player's FoV. Whenever
    // they're seen, we record their tile as the last-known position. When
    // the enemy LEAVES the FoV (or starts off-screen), if their last-seen
    // tile is in the explored set we render a translucent ghost there as a
    // "you saw them last here" hint. Re-spotting them moves the live sprite
    // back; killing them tears down both.
    for (const enemy of this.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const visible = this.visibleTiles.has(fogKey(enemy.pos.x, enemy.pos.y));
      sprite.setVisible(visible);
      if (visible) {
        // Record current position; remove any stale ghost.
        this.enemyLastSeen.set(enemy.id, { ...enemy.pos });
        this.removeGhostFor(enemy.id);
      } else {
        const last = this.enemyLastSeen.get(enemy.id);
        if (last && this.exploredTiles.has(fogKey(last.x, last.y))) {
          this.placeGhostFor(enemy, last);
        } else {
          this.removeGhostFor(enemy.id);
        }
      }
    }
  }

  /** Show or update the ghost marker for an enemy at the given tile. */
  private placeGhostFor(enemy: Enemy, tile: Point): void {
    let ghost = this.enemyGhostSprites.get(enemy.id);
    const xy = tileToWorld(tile.x, tile.y);
    if (!ghost) {
      ghost = this.add
        .image(xy.x, xy.y, ASSET_KEYS.sprites.chars, ENEMY_FRAME)
        .setScale(RENDER_SCALE)
        .setOrigin(0.5)
        .setAlpha(0.4)
        .setTint(0xb8c0d8) // cool grey-blue tint to read as "memory" not "live"
        .setDepth(8);
      this.enemyGhostSprites.set(enemy.id, ghost);
    } else {
      ghost.setPosition(xy.x, xy.y);
    }
  }

  private removeGhostFor(id: number): void {
    const ghost = this.enemyGhostSprites.get(id);
    if (ghost) {
      ghost.destroy();
      this.enemyGhostSprites.delete(id);
    }
  }

  private playerAttack(enemy: Enemy): void {
    this.lungeAt(this.playerSprite, enemy.pos);
    const result = this.combat.applyDamage(enemy.stats, this.combat.resolveAttack(this.player.stats, enemy.stats));
    this.log(`You hit the ${enemy.displayName} for ${result.damage}.`, 'danger');
    this.bus.emit({
      kind: 'floatingText',
      spec: { tile: { ...enemy.pos }, text: `-${result.damage}`, color: FT_COLOR_DAMAGE },
    });
    if (enemy.stats.hp <= 0) {
      enemy.alive = false;
      this.runState.kills += 1;
      this.log(`The ${enemy.displayName} dies.`, 'recovery');
      // Green "+kill" bouncer above the death tile so the green log line gets
      // a paired floating-text echo. Mirrors the red "-N" bouncer on hits.
      this.bus.emit({
        kind: 'floatingText',
        spec: { tile: { ...enemy.pos }, text: '+kill', color: '#6aa84a', size: 'small' },
      });
    }
  }

  private runEnemyTurns(): void {
    if (!this.player.alive) return;
    const ctx: EnemyAiContext = {
      isWalkable: (x, y) => this.isWalkable(x, y),
      enemyAt: (x, y) => this.enemyAt(x, y),
      playerPos: this.player.pos,
      attackPlayer: (attacker) => {
        const sprite = this.enemySprites.get(attacker.id);
        if (sprite) this.lungeAt(sprite, this.player.pos);
        const result = this.combat.applyDamage(
          this.player.stats,
          this.combat.resolveAttack(attacker.stats, this.player.stats),
        );
        this.log(`The ${attacker.displayName} hits you for ${result.damage}.`, 'danger');
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `-${result.damage}`, color: FT_COLOR_DAMAGE },
        });
        if (this.player.stats.hp <= 0) {
          this.player.alive = false;
          this.log('You die.', 'danger');
          this.bus.emit({
            kind: 'floatingText',
            spec: { tile: { ...this.player.pos }, text: 'DIED', color: FT_COLOR_DEATH, size: 'large' },
          });
        }
      },
      moveEnemy: (enemy, to) => {
        enemy.pos = { ...to };
        const sprite = this.enemySprites.get(enemy.id);
        if (sprite) this.tweenTo(sprite, to);
      },
      isOpaque: (x, y) => {
        if (!this.dungeon.tiles.inBounds(x, y)) return true;
        return TILES[this.dungeon.tiles.get(x, y)].opaque;
      },
      fireProjectile: (self, target) => this.fireArrow(self, target),
    };
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.ai.takeTurn(e, ctx);
      if (!this.player.alive) break;
    }
  }

  private spawnItems(): void {
    const occupied = this.enemies.map((e) => ({ x: e.pos.x, y: e.pos.y }));
    // Quiet floors trade enemies for loot. Hungry floors halve item count.
    const baseCount = Math.max(2, Math.floor(this.dungeon.rooms.length / 2));
    const count =
      this.runState.floorDescriptor === 'Quiet'
        ? baseCount + 2
        : this.runState.floorDescriptor === 'Hungry'
          ? Math.max(1, Math.floor(baseCount / 2))
          : baseCount;
    const placements = placeItems(this.dungeon, this.rng, {
      floor: this.runState.floor,
      count,
      occupied,
    });
    // Hungry: filter out food drops entirely so the player feels the bite.
    const filtered =
      this.runState.floorDescriptor === 'Hungry'
        ? placements.filter((p) => p.defId !== 'food_hardtack')
        : placements;
    for (const p of filtered) this.items.push({ ...p });
  }

  private spawnTraps(): void {
    // Build occupied list from enemies + items + player so traps don't overlap.
    const occupied: Point[] = [
      ...this.enemies.map((e) => ({ x: e.pos.x, y: e.pos.y })),
      ...this.items.map((i) => ({ x: i.pos.x, y: i.pos.y })),
      { ...this.player.pos },
    ];
    // Resume picks up traps from saved RunState; otherwise generate fresh.
    if (this.runState.traps && this.runState.traps.length > 0) return;
    // Trapped floors double the trap count. Quiet floors honour the per-floor
    // cap. The placeTraps helper takes its own count override so descriptor
    // tweaks happen here, not inside the placement logic.
    const baseCount = Math.max(1, Math.floor(this.dungeon.rooms.length / 3));
    const trapCap = this.runState.floor <= 1 ? 2 : Number.POSITIVE_INFINITY;
    const desired =
      this.runState.floorDescriptor === 'Trapped' ? baseCount * 2 : baseCount;
    const count = Math.min(desired, trapCap);
    this.runState.traps = placeTraps(this.dungeon, this.rng, {
      floor: this.runState.floor,
      count,
      occupied,
    });
  }

  private drawTraps(): void {
    for (const t of this.runState.traps) {
      if (t.revealed) this.placeTrapSprite(t);
    }
  }

  /** Render (or refresh) a single trap sprite at its tile. */
  private placeTrapSprite(trap: TrapState, animate = false): void {
    const key = `${trap.pos.x},${trap.pos.y}`;
    const def = TRAP_CATALOG[trap.kind];
    if (!def) return;
    const old = this.trapSprites.get(key);
    if (old) old.destroy();
    const w = tileToWorld(trap.pos.x, trap.pos.y);
    const sprite = this.add
      .image(w.x, w.y, ASSET_KEYS.sprites.rpg, def.iconFrame)
      .setScale(RENDER_SCALE)
      .setOrigin(0.5)
      .setDepth(6) // below items (7) and actors (9-10), above floor tiles
      .setTint(parseInt(def.color.slice(1), 16));
    this.trapSprites.set(key, sprite);
    if (animate) {
      // Per refinement-002 §J: 200 ms scale 1.2 → 1, alpha 0 → 1, easeOutQuad.
      // The scale-DOWN is the cue ("locking in"). Fires alongside the existing
      // !Spotted! floating text emitted by the perception roll.
      sprite.setAlpha(0).setScale(RENDER_SCALE * 1.2);
      this.tweens.add({
        targets: sprite,
        alpha: 1,
        scale: RENDER_SCALE,
        duration: 200,
        ease: 'Quad.easeOut',
      });
    }
  }

  private removeTrapSprite(pos: Point): void {
    const key = `${pos.x},${pos.y}`;
    const s = this.trapSprites.get(key);
    if (s) {
      s.destroy();
      this.trapSprites.delete(key);
    }
  }

  /** Player walked onto a trap tile — fire it. */
  private handleTrapStep(): void {
    const idx = this.runState.traps.findIndex(
      (t) => t.pos.x === this.player.pos.x && t.pos.y === this.player.pos.y,
    );
    if (idx < 0) return;
    const trap = this.runState.traps[idx]!;
    const def = TRAP_CATALOG[trap.kind];
    if (!def) return;

    const result = triggerTrap(trap, this.rng);
    this.log(def.triggeredLine, 'danger');

    if (result.damage > 0) {
      const dealt = Math.min(result.damage, this.player.stats.hp);
      this.player.stats.hp -= dealt;
      this.runState.player.hp = this.player.stats.hp;
      this.bus.emit({
        kind: 'floatingText',
        spec: { tile: { ...this.player.pos }, text: `-${dealt}`, color: FT_COLOR_DAMAGE },
      });
    }
    if (result.applyStatusToTrigger) {
      applyStatusTo(
        this.runState.activeStatuses,
        result.applyStatusToTrigger.id,
        result.applyStatusToTrigger.turns,
      );
      this.flashSpriteForStatus(this.playerSprite);
    }
    if (result.aoeTiles && result.applyStatusToAoe) {
      this.applyAoeStatus(result.aoeTiles, result.applyStatusToAoe.id, result.applyStatusToAoe.turns);
    }
    if (result.alarmRadius) {
      this.broadcastAlarm(trap.pos, result.alarmRadius);
    }

    if (result.consumed) {
      this.runState.traps.splice(idx, 1);
      this.removeTrapSprite(trap.pos);
    }
    if (this.player.stats.hp <= 0) this.player.alive = false;
  }

  /** Apply an AoE status (e.g. gas → poisoned) to every entity standing in the tiles. */
  private applyAoeStatus(tiles: Point[], statusId: StatusId, turns: number): void {
    // Brief green tint flash on each tile as a visual marker. ~600 ms.
    for (const t of tiles) {
      if (!this.dungeon.tiles.inBounds(t.x, t.y)) continue;
      const w = tileToWorld(t.x, t.y);
      const overlay = this.add
        .rectangle(w.x, w.y, TILE_SIZE, TILE_SIZE, 0x7ac74c, 0.45)
        .setOrigin(0.5)
        .setDepth(8);
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 600,
        onComplete: () => overlay.destroy(),
      });
    }
    // Player in cloud?
    for (const t of tiles) {
      if (t.x === this.player.pos.x && t.y === this.player.pos.y) {
        applyStatusTo(this.runState.activeStatuses, statusId, turns);
        this.flashSpriteForStatus(this.playerSprite);
        break;
      }
    }
    // Enemies in cloud get poisoned too.
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (tiles.some((t) => t.x === enemy.pos.x && t.y === enemy.pos.y)) {
        applyStatusTo(enemy.statuses, statusId, turns);
        const enemySprite = this.enemySprites.get(enemy.id);
        if (enemySprite) this.flashSpriteForStatus(enemySprite);
      }
    }
  }

  /** Alarm trap: every enemy within `radius` chases regardless of sight. */
  private broadcastAlarm(pos: Point, radius: number): void {
    let alerted = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (chebyshev(e.pos, pos) <= radius) {
        e.alarmedTurns = Math.max(e.alarmedTurns, 12);
        alerted++;
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...e.pos }, text: '!', color: '#d4a24c', size: 'large' },
        });
      }
    }
    if (alerted > 0) this.log(`${alerted} enemies are alerted!`, 'danger');
  }

  /** Roll perception against unrevealed adjacent traps; reveal hits. */
  private rollPerceptionForAdjacentTraps(): void {
    const baseP = this.player.stats.perception ?? 0.3;
    const p = this.searchBoost ? Math.max(baseP, 0.8) : baseP;
    this.searchBoost = false;

    for (const trap of this.runState.traps) {
      if (trap.revealed) continue;
      if (!isAdjacent(this.player.pos, trap.pos)) continue;
      if (rollPerception(p, this.rng)) {
        trap.revealed = true;
        const def = TRAP_CATALOG[trap.kind];
        if (def) {
          this.log(def.spottedLine, 'discovery');
          this.bus.emit({
            kind: 'floatingText',
            spec: { tile: { ...trap.pos }, text: '!Spotted!', color: def.color, size: 'small' },
          });
        }
        // animate=true triggers the 200 ms scale 1.2→1 + alpha 0→1 reveal.
        this.placeTrapSprite(trap, true);
      }
    }
  }

  private drawItems(): void {
    for (const item of this.items) {
      const def = getItemDef(item.defId);
      if (!def) continue;
      const w = tileToWorld(item.pos.x, item.pos.y);
      item.sprite = this.add
        .image(w.x, w.y, ASSET_KEYS.sprites.rpg, def.iconFrame)
        .setScale(RENDER_SCALE)
        .setOrigin(0.5)
        .setDepth(7); // below actors (9-10), above floor tiles
    }
  }

  /** Picks up any item the player is standing on; logs + adds to inventory. */
  private tryPickup(): void {
    const idx = this.items.findIndex((it) => it.pos.x === this.player.pos.x && it.pos.y === this.player.pos.y);
    if (idx < 0) return;
    const item = this.items[idx]!;
    const def = getItemDef(item.defId);
    if (!def) return;
    // Stack into existing slot or push a new one (data-side mirror of the
    // Inventory class — simpler than instantiating the class here, since
    // RunState is JSON anyway).
    const existing = def.stackable ? this.runState.inventory.find((s) => s.defId === def.id) : null;
    if (existing) existing.count += 1;
    else this.runState.inventory.push({ defId: def.id, count: 1 });
    item.sprite?.destroy();
    this.items.splice(idx, 1);
    const name = displayName(this.runState.identifications, def);
    this.log(`Picked up ${name}.`, 'discovery');
  }

  private runPlayerTicks(): void {
    if (!this.player.alive) return;
    const events: TickEvent[] = [...tickStatuses(this.runState), ...tickHunger(this.runState)];
    // Statuses + hunger can move HP independent of combat. Mirror the data
    // layer's HP back onto the runtime Player object.
    this.player.stats.hp = this.runState.player.hp;
    if (this.player.stats.hp <= 0) this.player.alive = false;

    for (const ev of events) {
      if (ev.kind === 'hungerDanger') {
        this.log('You feel hungry.', 'danger');
      } else if (ev.kind === 'starvationDamage') {
        this.log('You are starving!', 'danger');
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `-${ev.amount ?? 1}`, color: FT_COLOR_DAMAGE, size: 'small' },
        });
      } else if (ev.kind === 'poisonDamage') {
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `-${ev.amount ?? 1}`, color: '#7ac74c', size: 'small' },
        });
      } else if (ev.kind === 'bleedDamage') {
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `-${ev.amount ?? 1}`, color: '#d44a4a', size: 'small' },
        });
      } else if (ev.kind === 'regenHeal') {
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `+${ev.amount ?? 1}`, color: '#6aa84a', size: 'small', durationMs: 800 },
        });
      } else if (ev.kind === 'statusExpired') {
        const def = ev.statusId ? STATUS_CATALOG[ev.statusId] : undefined;
        this.log(`Status faded: ${def?.label ?? ev.statusId}.`, 'neutral');
      }
    }

    this.runEnemyStatusTicks();
    this.tickAlarm();
    this.rollPerceptionForAdjacentTraps();
  }

  /** Decrement each enemy's force-aggro counter once per world tick. */
  private tickAlarm(): void {
    for (const e of this.enemies) {
      if (e.alarmedTurns > 0) e.alarmedTurns -= 1;
    }
  }

  /** Tick each living enemy's status bag. Mirrors player tick behaviour. */
  private runEnemyStatusTicks(): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.statuses.length === 0) continue;
      const target: StatusTarget = {
        damage: (n) => {
          const dealt = Math.min(n, enemy.stats.hp);
          enemy.stats.hp -= dealt;
          return dealt;
        },
        heal: (n) => {
          const headroom = enemy.stats.hpMax - enemy.stats.hp;
          const healed = Math.min(n, Math.max(0, headroom));
          enemy.stats.hp += healed;
          return healed;
        },
        isDead: () => enemy.stats.hp <= 0,
      };
      const events = tickStatusList(enemy.statuses, target);
      for (const e of events) {
        if (e.kind === 'damage' && e.amount) {
          this.bus.emit({
            kind: 'floatingText',
            spec: {
              tile: { ...enemy.pos },
              text: `-${e.amount}`,
              color: e.statusId === 'poisoned' ? '#7ac74c' : '#d44a4a',
              size: 'small',
            },
          });
        }
      }
      if (enemy.stats.hp <= 0 && enemy.alive) {
        enemy.alive = false;
        this.runState.kills += 1;
        this.log(`The ${enemy.displayName} succumbs.`, 'recovery');
      }
    }
  }

  // ---------- Public API for the InventoryScene overlay ----------

  /** Mapping scroll: mark every floor tile as explored, redraw fog. */
  public applyRevealFloor(): void {
    for (let y = 0; y < this.dungeon.tiles.height; y++) {
      for (let x = 0; x < this.dungeon.tiles.width; x++) {
        if (this.isWalkable(x, y)) this.exploredTiles.add(fogKey(x, y));
      }
    }
    this.runState.exploredTiles = Array.from(this.exploredTiles);
    this.fogMask?.update(this.visibleTiles, this.exploredTiles);
    this.log('You glimpse the floor below.', 'discovery');
  }

  /** Blinking scroll: teleport the player to a random visible tile. */
  public applyBlink(): void {
    const candidates: Point[] = [];
    for (const key of this.visibleTiles) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!this.isWalkable(x, y)) continue;
      if (this.enemyAt(x, y)) continue;
      if (x === this.player.pos.x && y === this.player.pos.y) continue;
      candidates.push({ x, y });
    }
    if (candidates.length === 0) {
      this.log('Reality shudders, but nowhere calls.', 'neutral');
      return;
    }
    const target = this.rng.pick(candidates);
    this.player.pos = { ...target };
    this.runState.playerPos = { ...target };
    const w = tileToWorld(target.x, target.y);
    this.playerSprite.setPosition(w.x, w.y);
    this.recomputeFov();
  }

  /** Append a log line emitted from another scene (e.g. inventory use). */
  public applyExternalLog(message: string): void {
    this.log(message, 'neutral');
  }

  /**
   * After the inventory scene mutates the run state and saves it, the dungeon
   * scene rehydrates so HP / food / armor bonus / inventory all reflect the
   * latest state. Called by InventoryScene on close.
   */
  public reloadFromSavedState(): void {
    const fresh = getServices(this).save.loadRun();
    if (!fresh) return;
    this.runState = fresh;
    this.player.stats.hp = fresh.player.hp;
    this.player.stats.hpMax = fresh.player.hpMax;
    this.player.stats.power = fresh.player.power;
    this.player.stats.armor = fresh.player.armor;
    if (this.player.stats.hp <= 0) this.player.alive = false;
    this.refreshHud();
  }

  /**
   * Skeleton Archer projectile — tween a small dart from shooter to target
   * over 120 ms (per refinement-002 §J), then resolve damage. The visual is
   * a 4×4 white rectangle so we don't need an asset frame; readable enough
   * at the dungeon zoom level.
   */
  private fireArrow(shooter: Enemy, target: Point): void {
    const from = tileToWorld(shooter.pos.x, shooter.pos.y);
    const to = tileToWorld(target.x, target.y);
    const arrow = this.add
      .rectangle(from.x, from.y, 6, 4, 0xfffbe6)
      .setStrokeStyle(1, 0x1a1a14)
      .setOrigin(0.5)
      .setDepth(50)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    this.log(`The ${shooter.displayName} draws back the bow.`, 'danger');
    this.tweens.add({
      targets: arrow,
      x: to.x,
      y: to.y,
      duration: 120,
      ease: 'Linear',
      onComplete: () => {
        arrow.destroy();
        // Resolve damage post-tween. Player may have moved if a queued
        // turn intervened — in iter-2 it can't (turns are synchronous).
        if (!this.player.alive) return;
        const result = this.combat.applyDamage(
          this.player.stats,
          this.combat.resolveAttack(shooter.stats, this.player.stats),
        );
        this.log(`The arrow strikes you for ${result.damage}.`, 'danger');
        this.bus.emit({
          kind: 'floatingText',
          spec: { tile: { ...this.player.pos }, text: `-${result.damage}`, color: FT_COLOR_DAMAGE },
        });
        if (this.player.stats.hp <= 0) {
          this.player.alive = false;
          this.log('You die.', 'danger');
          this.bus.emit({
            kind: 'floatingText',
            spec: { tile: { ...this.player.pos }, text: 'DIED', color: FT_COLOR_DEATH, size: 'large' },
          });
        }
        // Mirror data layer for the HUD.
        this.runState.player.hp = this.player.stats.hp;
        this.refreshHud();
      },
    });
  }

  private cleanupDeadEnemies(): void {
    for (const e of this.enemies) {
      if (!e.alive) {
        const s = this.enemySprites.get(e.id);
        if (s) {
          this.tweens.add({
            targets: s,
            alpha: 0,
            scale: RENDER_SCALE * 1.5,
            duration: 200,
            onComplete: () => s.destroy(),
          });
          this.enemySprites.delete(e.id);
        }
        this.enemyLastSeen.delete(e.id);
        this.removeGhostFor(e.id);
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private handlePlayerDeath(): void {
    if (this.deathSequenceStarted) return;
    this.deathSequenceStarted = true;
    this.autoPath = [];
    this.destinationMarker.setVisible(false);
    this.runState.ended = { reason: 'death', turn: this.runState.turn };
    getServices(this).save.saveRun(this.runState);

    // Death beat polish per refinement-002 / iter-2 stage 12 spec:
    //   1. Player sprite stays visible ~300 ms post-death (no blink-out).
    //   2. World desaturates (cool tint), keeping contour visible — not blacks.
    //   3. The "DIED" floating bouncer in code holds ~400 ms before the
    //      camera fade kicks in.
    // The 600 ms total budget matches the existing setTimeout below, so
    // the scene-transition timing is unchanged; we're spending those 600 ms
    // better.
    //
    // Desaturation: an alpha-rect over the whole viewport gives a cool
    // grey wash so the world isn't blacked out — contour stays readable,
    // "something happened to me" beats "screen replaced screen". Phaser
    // Camera doesn't expose setTint at this version; the rect approach is
    // simpler and renders above everything below the HUD.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x6a6470, 0.35)
      .setScrollFactor(0)
      .setDepth(900);
    // Player sprite stays full-alpha + crisp for a beat — the held frame.
    // Then a slow desaturate before the fade.
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 0.6,
      duration: 300,
      delay: 300,
      ease: 'Quad.easeIn',
    });
    // Camera fade after the held frame + DIED bouncer hang.
    this.time.delayedCall(400, () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
    });
    setTimeout(() => {
      if (this.deathTransitionFired) return;
      this.deathTransitionFired = true;
      if (this.scene.isActive() || this.scene.isPaused()) {
        this.toDeathSummary();
      }
    }, 600);
  }

  /** Floor-descriptor flavour line for the entry log. */
  private flavourFor(d: string): string {
    switch (d) {
      case 'Quiet':
        return 'A quiet floor. The walls hold their breath';
      case 'Cramped':
        return 'Tight corridors. Watch for arrows';
      case 'Open':
        return 'Wide rooms. Sight-lines open in every direction';
      case 'Trapped':
        return 'Tread carefully. The masons left teeth in the floor';
      case 'Hungry':
        return 'Nothing here grew, nothing here grew old';
      default:
        return 'You descend';
    }
  }

  /**
   * Animated title card on floor entry — 2-second fade per refinement-002 §E.
   * 200 ms fade-in / 1400 ms hold / 400 ms fade-out. 48px serif, depth 950
   * (above floating text at 70, below pause at 1000+).
   */
  private showFloorTitleCard(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.4;
    const big = this.add
      .text(cx, cy, `Floor ${this.runState.floor}`, {
        fontFamily: 'serif',
        fontSize: '48px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950)
      .setAlpha(0);
    const sub = this.add
      .text(cx, cy + 36, `— ${this.runState.floorDescriptor} —`, {
        fontFamily: 'serif',
        fontSize: '20px',
        color: '#d4a24c',
        fontStyle: 'italic',
        stroke: '#1a1a24',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950)
      .setAlpha(0);
    // Fade in / hold / fade out.
    this.tweens.add({
      targets: [big, sub],
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(1400, () => {
          this.tweens.add({
            targets: [big, sub],
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => {
              big.destroy();
              sub.destroy();
            },
          });
        });
      },
    });
  }

  private descendToNextFloor(): void {
    this.runState.floor += 1;
    this.runState.exploredTiles = [];
    this.runState.traps = [];
    // Save before scene restart; the new create() will load this state.
    getServices(this).save.saveRun(this.runState);
    // Per refinement-002 §J: 350 ms fade-out + 50 ms hold + 350 ms fade-in
    // (the new scene's fadeIn). The HOLD is critical — without it the player
    // doesn't register the transition happened. Total: 750 ms of stair travel.
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start(SCENE_KEYS.Dungeon, { descend: true });
    });
  }

  private completeRunSurvived(): void {
    const services = getServices(this);
    // Reward scales with deepest floor reached + small turn-efficiency bonus.
    // Per roadmap: "Embers reward scales with deepest floor reached."
    const depthBonus = (this.runState.floor - 1) * 25;
    const speedBonus = Math.max(0, 30 - Math.floor(this.runState.turn / 5));
    const reward = 10 + depthBonus + speedBonus;
    services.setPersistent((s) => {
      s.resources.embers += reward;
      s.hasCompletedFirstRun = true;
    });
    services.save.clearRun();
    this.scene.start(SCENE_KEYS.Town);
  }

  private toDeathSummary(): void {
    this.scene.start(SCENE_KEYS.DeathSummary, {
      turn: this.runState.turn,
      floor: this.runState.floor,
      kills: this.runState.kills,
    });
  }
}
