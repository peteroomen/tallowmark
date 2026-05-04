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
import { CharsSheet, Inputs } from '@/world/FrameCatalog';
import { findPath, findPathToBump } from '@/core/Pathfinding';
import { chebyshev, type Point } from '@/core/Grid';
import { newRunState, type RunState } from '@/state/RunState';
import { getServices } from '@/services';

interface DungeonSceneData {
  fresh?: boolean;
  resume?: boolean;
}

const PLAYER_FRAME = CharsSheet.player;
// v2: enemies are goblins (chars sheet col 0 row 3). The data model still
// uses the "rat" kind; we rename in iteration 2 along with proper monster art.
const ENEMY_FRAME = CharsSheet.goblin;

export class DungeonScene extends Phaser.Scene {
  private rng!: Rng;
  private turnEngine!: TurnEngine;
  private combat!: CombatSystem;
  private dungeon!: GeneratedDungeon;
  private player!: Player;
  private enemies: Enemy[] = [];
  private runState!: RunState;

  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();

  private hpText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];

  private autoPath: Point[] = [];
  private autoStepTimer = 0;
  private camOffset = { x: 0, y: 0 };

  constructor() {
    super(SCENE_KEYS.Dungeon);
  }

  create(data: DungeonSceneData): void {
    const services = getServices(this);
    services.audio.playMusic('dungeon');

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    this.runState =
      data.resume && services.save.loadRun()
        ? services.save.loadRun()!
        : newRunState(Date.now() & 0x7fffffff, { x: 0, y: 0 });

    this.rng = Rng.fromSeed(this.runState.seed);
    this.combat = new CombatSystem(this.rng);
    this.turnEngine = new TurnEngine();
    this.dungeon = generateBspDungeon(DUNGEON_W, DUNGEON_H, this.rng);

    // First time entering: align run state to the generated dungeon.
    if (!data.resume) {
      this.runState.playerPos = { ...this.dungeon.playerStart };
    }

    this.player = new Player(this.runState.playerPos, { ...this.runState.player });

    this.spawnEnemies();
    this.drawTiles();
    this.drawActors();
    this.drawHud();

    this.turnEngine.onWorldTick(() => this.runEnemyTurns());

    // Input
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    services.save.saveRun(this.runState);
    this.log(`You enter the dungeon. Seed: ${this.runState.seed}.`);
  }

  override update(_time: number, delta: number): void {
    if (this.autoPath.length > 0 && this.player.alive) {
      this.autoStepTimer -= delta;
      if (this.autoStepTimer <= 0) {
        const next = this.autoPath.shift();
        if (next) {
          this.tryStep(next);
          this.autoStepTimer = 110;
        }
      }
    }
  }

  // ---------- World generation & rendering ----------

  private spawnEnemies(): void {
    // Place 1 rat per room beyond the first, up to 8 rats.
    const candidates = this.dungeon.rooms.slice(1, 9);
    for (const room of candidates) {
      const rx = this.rng.intInclusive(room.x1, room.x2);
      const ry = this.rng.intInclusive(room.y1, room.y2);
      if (this.dungeon.tiles.get(rx, ry) !== TileKind.Floor) continue;
      const enemy = new Enemy(
        { x: rx, y: ry },
        { hp: 5, hpMax: 5, power: 2, armor: 0 },
        'rat',
        'Giant Rat',
        new RatAi(),
      );
      this.enemies.push(enemy);
    }
  }

  private drawTiles(): void {
    // Compute a camera offset so the player starts roughly centered.
    this.camOffset = this.computeCamOffset(this.player.pos);
    this.tileSprites = [];
    // v2 dungeon visuals use palette-tinted rectangles for walls/floors —
    // proper Kenney stone tiles will replace these once frames are picked
    // via the debug scene. The data layer (TILES[kind]) is unchanged.
    for (let y = 0; y < this.dungeon.tiles.height; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < this.dungeon.tiles.width; x++) {
        const kind = this.dungeon.tiles.get(x, y);
        const [sx, sy] = this.toScreen(x, y);
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
        const rect = this.add
          .rectangle(sx, sy, TILE_SIZE, TILE_SIZE, color)
          .setOrigin(0.5);
        if (kind === TileKind.Floor) {
          rect.setStrokeStyle(1, 0x4a444f);
        } else if (kind === TileKind.Wall) {
          rect.setStrokeStyle(1, 0x1a1a22);
        }
        // Cast: rectangles aren't Images but our cleanup logic only calls
        // setPosition / destroy, both shared on GameObject.
        this.tileSprites[y]![x] = rect as unknown as Phaser.GameObjects.Image;
        // Use def.iconFrame to silence unused-var when we re-wire to Kenney tiles.
        void TILES[kind].iconFrame;
      }
    }
  }

  private drawActors(): void {
    this.playerSprite = this.add
      .image(...this.toScreen(this.player.pos.x, this.player.pos.y), ASSET_KEYS.sprites.chars, PLAYER_FRAME)
      .setScale(RENDER_SCALE)
      .setOrigin(0.5)
      .setDepth(10);

    for (const e of this.enemies) {
      const s = this.add
        .image(...this.toScreen(e.pos.x, e.pos.y), ASSET_KEYS.sprites.chars, ENEMY_FRAME)
        .setScale(RENDER_SCALE)
        .setOrigin(0.5)
        .setDepth(9);
      this.enemySprites.set(e.id, s);
    }
  }

  private drawHud(): void {
    const stroke = { stroke: '#1a1a24', strokeThickness: 3 };
    this.hpText = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5e3d8', ...stroke })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.floorText = this.add
      .text(GAME_WIDTH - 8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#d4a24c', ...stroke })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.logText = this.add
      .text(8, GAME_HEIGHT - 80, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        wordWrap: { width: GAME_WIDTH - 16 },
        ...stroke,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.drawControlsHint();
    this.refreshHud();
  }

  private drawControlsHint(): void {
    const y = GAME_HEIGHT - 18;
    const items: Array<[number, string]> = [
      [Inputs.mouseLeft, 'path'],
      [Inputs.arrowUp, 'step'],
      [Inputs.keyEsc, 'pause'],
      [Inputs.keyI, 'inv'],
      [Inputs.keyC, 'char'],
    ];
    let cx = 8;
    for (const [icon, label] of items) {
      this.add
        .image(cx, y, ASSET_KEYS.ui.inputs, icon)
        .setOrigin(0, 0.5)
        .setScale(2)
        .setScrollFactor(0)
        .setDepth(100);
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
        .setDepth(100);
      cx += t.width + 12;
    }
  }

  private refreshHud(): void {
    const stats = this.player.stats;
    this.hpText.setText(`HP ${stats.hp}/${stats.hpMax}    Pow ${stats.power}    Arm ${stats.armor}`);
    this.floorText.setText(`Floor ${this.runState.floor}    Turn ${this.runState.turn}`);
    this.logText.setText(this.logLines.slice(-4).join('\n'));
  }

  private log(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 50) this.logLines.shift();
    this.refreshHud();
  }

  // ---------- Coordinate plumbing ----------

  private toScreen(x: number, y: number): [number, number] {
    return [
      (x - this.camOffset.x) * TILE_SIZE + TILE_SIZE / 2,
      (y - this.camOffset.y) * TILE_SIZE + TILE_SIZE / 2,
    ];
  }

  private fromScreen(sx: number, sy: number): Point {
    return {
      x: Math.floor(sx / TILE_SIZE) + this.camOffset.x,
      y: Math.floor(sy / TILE_SIZE) + this.camOffset.y,
    };
  }

  private computeCamOffset(focus: Point): { x: number; y: number } {
    const halfW = Math.floor(GAME_WIDTH / TILE_SIZE / 2);
    const halfH = Math.floor(GAME_HEIGHT / TILE_SIZE / 2);
    const ox = Math.max(0, Math.min(this.dungeon.tiles.width - GAME_WIDTH / TILE_SIZE, focus.x - halfW));
    const oy = Math.max(0, Math.min(this.dungeon.tiles.height - GAME_HEIGHT / TILE_SIZE, focus.y - halfH));
    return { x: Math.floor(ox), y: Math.floor(oy) };
  }

  private rerenderPositions(): void {
    this.camOffset = this.computeCamOffset(this.player.pos);
    for (let y = 0; y < this.dungeon.tiles.height; y++) {
      const row = this.tileSprites[y];
      if (!row) continue;
      for (let x = 0; x < this.dungeon.tiles.width; x++) {
        const s = row[x];
        if (!s) continue;
        s.setPosition(...this.toScreen(x, y));
      }
    }
    this.playerSprite.setPosition(...this.toScreen(this.player.pos.x, this.player.pos.y));
    for (const e of this.enemies) {
      const s = this.enemySprites.get(e.id);
      if (s) s.setPosition(...this.toScreen(e.pos.x, e.pos.y));
    }
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

  private onClick(p: Phaser.Input.Pointer): void {
    if (!this.player.alive) return;
    const target = this.fromScreen(p.worldX, p.worldY);
    if (!this.dungeon.tiles.inBounds(target.x, target.y)) return;

    const enemy = this.enemyAt(target.x, target.y);
    const path = enemy
      ? findPathToBump(this.player.pos, target, (x, y) => this.isWalkable(x, y) && !this.enemyAt(x, y))
      : findPath(this.player.pos, target, (x, y) => this.isWalkable(x, y) && !this.enemyAt(x, y));
    if (path.length <= 1) return;
    this.autoPath = path.slice(1); // drop the start, which is our current position
    this.autoStepTimer = 0;
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
    if (e.key === 'i') {
      this.scene.launch(SCENE_KEYS.Inventory);
      return;
    }
    if (e.key === 'c') {
      this.scene.launch(SCENE_KEYS.Character);
      return;
    }
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'k':
        dy = -1;
        break;
      case 'ArrowDown':
      case 's':
      case 'j':
        dy = 1;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'h':
        dx = -1;
        break;
      case 'ArrowRight':
      case 'd':
      case 'l':
        dx = 1;
        break;
      case 'y':
        dx = -1;
        dy = -1;
        break;
      case 'u':
        dx = 1;
        dy = -1;
        break;
      case 'b':
        dx = -1;
        dy = 1;
        break;
      case 'n':
        dx = 1;
        dy = 1;
        break;
      case '.':
        this.tryStep(this.player.pos);
        return;
      default:
        return;
    }
    this.autoPath = [];
    this.tryStep({ x: this.player.pos.x + dx, y: this.player.pos.y + dy });
  }

  private tryStep(target: Point): void {
    if (!this.player.alive) return;
    if (chebyshev(this.player.pos, target) > 1) return;

    // Same tile = wait.
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

    // Walking onto stairs ends the floor (v1: returns to town).
    const tile = this.dungeon.tiles.get(target.x, target.y);
    if (tile === TileKind.StairsDown) {
      this.log('You climb back up to Tallowmark with what you found.');
      this.player.pos = { ...target };
      this.runState.playerPos = { ...target };
      this.completeRunSurvived();
      return;
    }

    this.endRound(() => {
      this.player.pos = { ...target };
      this.runState.playerPos = { ...target };
    });
  }

  private endRound(playerAction: () => void): void {
    this.turnEngine.submitPlayerAction(() => {
      playerAction();
      this.runState.turn = this.turnEngine.getTurnNumber() + 1;
    });
    this.cleanupDeadEnemies();
    this.runState.player = { ...this.player.stats };
    getServices(this).save.saveRun(this.runState);
    this.rerenderPositions();
    this.refreshHud();
    if (!this.player.alive) {
      this.handlePlayerDeath();
    }
  }

  private playerAttack(enemy: Enemy): void {
    const result = this.combat.applyDamage(enemy.stats, this.combat.resolveAttack(this.player.stats, enemy.stats));
    this.log(`You hit the ${enemy.displayName} for ${result.damage}.`);
    if (enemy.stats.hp <= 0) {
      enemy.alive = false;
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
          s.destroy();
          this.enemySprites.delete(e.id);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private handlePlayerDeath(): void {
    this.autoPath = [];
    this.runState.ended = { reason: 'death', turn: this.runState.turn };
    getServices(this).save.saveRun(this.runState);
    this.time.delayedCall(400, () => this.toDeathSummary());
  }

  private completeRunSurvived(): void {
    // v1: surviving / climbing stairs returns you to town and grants meta-currency.
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
      kills: 0, // TODO: track in iteration 2+
    });
  }
}
