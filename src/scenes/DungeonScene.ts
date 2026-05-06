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
import { generateBspDungeon, type GeneratedDungeon } from '@/world/Dungeon/BspGenerator';
import { TileKind, TILES } from '@/world/Tile';
import { CharsSheet, Inputs, UiLarge } from '@/world/FrameCatalog';
import { KenneyPlank } from '@/ui/KenneyPlank';
import { HpBar } from '@/ui/HpBar';
import { FogMask, fogKey } from '@/ui/FogMask';
import { computeFov } from '@/core/Fov';
import { findPath, findPathToBump } from '@/core/Pathfinding';
import { chebyshev, type Point } from '@/core/Grid';
import { newRunState, type RunState } from '@/state/RunState';
import { getServices } from '@/services';

interface DungeonSceneData {
  fresh?: boolean;
  resume?: boolean;
}

const PLAYER_FRAME = CharsSheet.player;
const ENEMY_FRAME = CharsSheet.goblin;
const STEP_TWEEN_MS = 130;
const AUTO_STEP_INTERVAL_MS = 150; // > STEP_TWEEN_MS so steps don't pile up mid-animation

/**
 * Sight radius for fog-of-war shadowcasting. Stage 4 SCAFFOLD value: 999 —
 * effectively unlimited, so every tile is in the visible set and the FogMask
 * draws nothing. The data flow (compute FoV → update exploredTiles → save →
 * update mask) is fully wired; flipping this to 8 or so in the next stage
 * turns the visual fog on without any other code changes.
 */
const SIGHT_RADIUS = 999;

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
  private hoverHighlight!: Phaser.GameObjects.Rectangle;
  private destinationMarker!: Phaser.GameObjects.Rectangle;

  private hpText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private hpBar!: HpBar;

  private autoPath: Point[] = [];
  private autoStepTimer = 0;
  /** True once the death sequence has been started; used to avoid double-firing. */
  private deathSequenceStarted = false;

  // Fog of war (Stage 4 scaffold)
  private fogMask?: FogMask;
  private exploredTiles = new Set<string>();

  constructor() {
    super(SCENE_KEYS.Dungeon);
  }

  create(data: DungeonSceneData): void {
    const services = getServices(this);
    services.audio.playMusic('dungeon');

    // Scenes are reused — reset transient state.
    this.deathSequenceStarted = false;
    this.autoPath = [];
    this.autoStepTimer = 0;
    this.enemies = [];
    this.enemySprites.clear();
    this.logLines = [];
    this.cameras.main.resetFX();

    this.runState =
      data.resume && services.save.loadRun()
        ? services.save.loadRun()!
        : newRunState(Date.now() & 0x7fffffff, { x: 0, y: 0 });

    this.rng = Rng.fromSeed(this.runState.seed);
    this.combat = new CombatSystem(this.rng);
    this.turnEngine = new TurnEngine();
    this.dungeon = generateBspDungeon(DUNGEON_W, DUNGEON_H, this.rng);

    if (!data.resume) {
      this.runState.playerPos = { ...this.dungeon.playerStart };
    }

    this.player = new Player(this.runState.playerPos, { ...this.runState.player });

    this.spawnEnemies();
    this.drawTiles();
    this.drawHoverAndMarker();
    this.drawActors();
    this.drawHud();
    this.setupCamera();

    // Fog of war scaffold: rehydrate explored set, build the mask, do an
    // initial FoV compute so the player can see immediately on entry.
    this.exploredTiles = new Set(this.runState.exploredTiles);
    this.fogMask = new FogMask({
      scene: this,
      cols: this.dungeon.tiles.width,
      rows: this.dungeon.tiles.height,
    });
    this.recomputeFov();

    this.turnEngine.onWorldTick(() => this.runEnemyTurns());

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
    }

    services.save.saveRun(this.runState);
    if (!data.resume) {
      this.log(`You enter the dungeon. Seed: ${this.runState.seed}.`);
    } else {
      this.log(`You resume your descent.`);
    }

    // Dev hook for tests / AI agents — exposes a way to trigger game events
    // without needing to drive the BSP-generated layout to a specific state.
    if (import.meta.env.DEV) {
      const w = window as unknown as { __tallowmark?: { killPlayer?: () => void } };
      w.__tallowmark = w.__tallowmark ?? {};
      w.__tallowmark.killPlayer = () => {
        this.player.stats.hp = 0;
        this.player.alive = false;
        this.runState.player = { ...this.player.stats };
        this.log('You die.');
        this.handlePlayerDeath();
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
    cam.setBackgroundColor(COLORS.bg);
  }

  // ---------- World generation & rendering ----------

  private spawnEnemies(): void {
    // Floor-scaled enemy budget: floor 1 = 2-3, scaling up by floor.
    // Multi-floor descent isn't wired yet; until iter 2's stairs-down
    // chain ships, runState.floor stays at 1.
    const budget = Math.min(2 + this.runState.floor, 8);
    const candidates = this.rng.shuffle(this.dungeon.rooms.slice(1));
    let placed = 0;
    for (const room of candidates) {
      if (placed >= budget) break;
      const rx = this.rng.intInclusive(room.x1, room.x2);
      const ry = this.rng.intInclusive(room.y1, room.y2);
      if (this.dungeon.tiles.get(rx, ry) !== TileKind.Floor) continue;
      const enemy = new Enemy(
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
    this.hoverHighlight = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0)
      .setStrokeStyle(2, 0xffd76a, 0.85)
      .setOrigin(0.5)
      .setDepth(8)
      .setVisible(false);

    this.destinationMarker = this.add
      .rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0xd4a24c, 0.18)
      .setStrokeStyle(2, 0xd4a24c, 1)
      .setOrigin(0.5)
      .setDepth(8)
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
      const s = this.add
        .image(ew.x, ew.y, ASSET_KEYS.sprites.chars, ENEMY_FRAME)
        .setScale(RENDER_SCALE)
        .setOrigin(0.5)
        .setDepth(9);
      this.enemySprites.set(e.id, s);
    }
  }

  private drawHud(): void {
    const stroke = { stroke: '#1a1a24', strokeThickness: 3 };

    // Stat plank — backs HP bar + Pow/Arm text on the top-left.
    new KenneyPlank({
      scene: this,
      x: 4,
      y: 4,
      width: 320,
      height: 36,
      variant: 'wood',
    })
      .setScrollFactor(0)
      .setDepth(99);

    // HP bar (left) + numeric HP/Pow/Arm (right of bar).
    this.hpBar = new HpBar({
      scene: this,
      x: 14,
      y: 22,
      width: 110,
      height: 14,
      originX: 0,
      originY: 0.5,
    });
    this.hpBar.setScrollFactor(0).setDepth(1000);

    this.hpText = this.add
      .text(132, 14, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e5e3d8',
        ...stroke,
      })
      .setOrigin(0, 0)
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

    // Log: bottom-left anchored, grows UP so it never collides with the
    // controls hint at GAME_HEIGHT - 18. Word-wrap stays clear of the right-
    // side HUD icons.
    this.logText = this.add
      .text(16, GAME_HEIGHT - 38, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        wordWrap: { width: 560 },
        ...stroke,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1000);

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
    const y = 56;
    for (const it of items) {
      const slice = this.add
        .nineslice(x, y, ASSET_KEYS.ui.large, it.frame, 36, 36, 6, 6, 6, 6)
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
        .zone(x, y, 36, 36)
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
      x -= 42;
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
    this.hpBar.setHp(stats.hp, stats.hpMax);
    this.hpText.setText(`${stats.hp}/${stats.hpMax}   Pow ${stats.power}   Arm ${stats.armor}`);
    this.floorText.setText(`Floor ${this.runState.floor}    Turn ${this.runState.turn}`);
    this.logText.setText(this.logLines.slice(-4).join('\n'));
  }

  private log(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 50) this.logLines.shift();
    this.refreshHud();
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
  private lungeAt(sprite: Phaser.GameObjects.Image, target: Point): void {
    const from = { x: sprite.x, y: sprite.y };
    const to = tileToWorld(target.x, target.y);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    this.tweens.add({
      targets: sprite,
      x: mid.x,
      y: mid.y,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
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

    // Match against both `e.key` and `e.code`. Some automation tools fire
    // KeyboardEvent with a non-standard `key` field; `code` is more reliable
    // for layout-independent matching.
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const c = e.code;
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
      this.log('You climb back up to Tallowmark with what you found.');
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
    if (!this.player.alive) {
      this.handlePlayerDeath();
    }
  }

  /** Compute current FoV from the player's position and update the FogMask. */
  private recomputeFov(): void {
    const isOpaque = (x: number, y: number): boolean => {
      if (!this.dungeon.tiles.inBounds(x, y)) return true;
      return TILES[this.dungeon.tiles.get(x, y)].opaque;
    };
    const visible = computeFov(this.player.pos, SIGHT_RADIUS, isOpaque);
    // Merge into explored.
    for (const key of visible) this.exploredTiles.add(key);
    if (this.fogMask) this.fogMask.update(visible, this.exploredTiles);
    void fogKey; // imported for future use; suppress unused-import
  }

  private playerAttack(enemy: Enemy): void {
    this.lungeAt(this.playerSprite, enemy.pos);
    const result = this.combat.applyDamage(enemy.stats, this.combat.resolveAttack(this.player.stats, enemy.stats));
    this.log(`You hit the ${enemy.displayName} for ${result.damage}.`);
    if (enemy.stats.hp <= 0) {
      enemy.alive = false;
      this.runState.kills += 1;
      this.log(`The ${enemy.displayName} dies.`);
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
        this.log(`The ${attacker.displayName} hits you for ${result.damage}.`);
        if (this.player.stats.hp <= 0) {
          this.player.alive = false;
          this.log(`You die.`);
        }
      },
      moveEnemy: (enemy, to) => {
        enemy.pos = { ...to };
        const sprite = this.enemySprites.get(enemy.id);
        if (sprite) this.tweenTo(sprite, to);
      },
    };
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.ai.takeTurn(e, ctx);
      if (!this.player.alive) break;
    }
  }

  private cleanupDeadEnemies(): void {
    for (const e of this.enemies) {
      if (!e.alive) {
        const s = this.enemySprites.get(e.id);
        if (s) {
          // Quick fade-out before destroying for a nicer feel.
          this.tweens.add({
            targets: s,
            alpha: 0,
            scale: RENDER_SCALE * 1.5,
            duration: 200,
            onComplete: () => s.destroy(),
          });
          this.enemySprites.delete(e.id);
        }
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

    // Cosmetic camera fade — kicks off the visual blackout. The QA pass
    // proved we *cannot* rely on the FADE_OUT_COMPLETE event firing in every
    // environment (it didn't fire in the agent's harness), so the actual
    // scene transition is driven by a plain setTimeout. Browser-level timer:
    // independent of Phaser's update loop, the scene's pause state, the
    // camera's effect queue, or any other ambient state.
    this.cameras.main.fadeOut(500, 0, 0, 0);
    setTimeout(() => {
      // Guard against double-firing if the scene was already torn down.
      if (this.scene.isActive() || this.scene.isPaused()) {
        this.toDeathSummary();
      }
    }, 600);
  }

  private completeRunSurvived(): void {
    const services = getServices(this);
    const reward = 10 + Math.max(0, 30 - Math.floor(this.runState.turn / 5));
    services.setPersistent((s) => {
      s.metaCurrency += reward;
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
