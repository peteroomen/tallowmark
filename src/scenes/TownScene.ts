import Phaser from 'phaser';
import {
  ASSET_KEYS,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENE_KEYS,
  TILE_SIZE,
  RENDER_SCALE,
} from '@/config';
import { getServices } from '@/services';

/**
 * Tallowmark — the hub town. v1 is a static placeholder map: a grass field with
 * a few buildings rendered as colored blocks, an NPC stub, and a dungeon entrance
 * portal that prompts before descending. The town will grow with metaprogression.
 */
export class TownScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private playerTile = { x: 12, y: 8 };
  private dungeonEntrance = { x: 18, y: 4 };
  private cooldown = 0;

  constructor() {
    super(SCENE_KEYS.Town);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('town');

    this.drawGround();
    this.drawBuildings();
    this.drawDungeonEntrance();
    this.drawPlayer();
    this.drawHud();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.MainMenu));
    // Click anywhere to walk toward (v1: instant teleport for the town hub).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));

    // Arrow / WASD movement
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  override update(_time: number, delta: number): void {
    if (this.cooldown > 0) this.cooldown -= delta;
  }

  private drawGround(): void {
    // Solid grass-coloured fill plus a subtle grid for orientation.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x2a3d24);
    const g = this.add.graphics({ lineStyle: { color: 0x1f2e1b, width: 1 } });
    for (let x = 0; x <= GAME_WIDTH; x += TILE_SIZE) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y <= GAME_HEIGHT; y += TILE_SIZE) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private drawBuildings(): void {
    const buildings: Array<{ x: number; y: number; w: number; h: number; color: number; label: string }> = [
      { x: 2, y: 2, w: 4, h: 3, color: 0x5a4a3a, label: 'Apothecary\n(coming soon)' },
      { x: 8, y: 2, w: 4, h: 3, color: 0x5a4a3a, label: 'Blacksmith\n(coming soon)' },
      { x: 2, y: 11, w: 4, h: 3, color: 0x5a4a3a, label: 'Inn\n(coming soon)' },
      { x: 14, y: 11, w: 4, h: 3, color: 0x6a5a3a, label: 'Upgrade Shrine\n(coming soon)' },
    ];
    for (const b of buildings) {
      const px = b.x * TILE_SIZE + (b.w * TILE_SIZE) / 2;
      const py = b.y * TILE_SIZE + (b.h * TILE_SIZE) / 2;
      this.add
        .rectangle(px, py, b.w * TILE_SIZE - 4, b.h * TILE_SIZE - 4, b.color)
        .setStrokeStyle(2, 0x3a2a1f);
      this.add
        .text(px, py, b.label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e5e3d8',
          align: 'center',
        })
        .setOrigin(0.5);
    }
  }

  private drawDungeonEntrance(): void {
    const px = this.dungeonEntrance.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.dungeonEntrance.y * TILE_SIZE + TILE_SIZE / 2;
    this.add
      .rectangle(px, py, TILE_SIZE * 2, TILE_SIZE * 2, 0x14101a)
      .setStrokeStyle(2, 0xd4a24c);
    this.add
      .text(px, py - 4, 'DUNGEON', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#d4a24c',
      })
      .setOrigin(0.5);
    this.add
      .text(px, py + 12, '↓', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#d4a24c',
      })
      .setOrigin(0.5);
  }

  private drawPlayer(): void {
    // The Kenney character sheet is laid out by row; pick a hero-looking frame.
    // Frame index 0 is the top-left character; we'll use it for v1.
    const px = this.playerTile.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.playerTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.playerSprite = this.add.image(px, py, ASSET_KEYS.sprites.chars, 0).setScale(RENDER_SCALE);
  }

  private drawHud(): void {
    const services = getServices(this);
    this.add
      .text(8, 8, `Tallowmark — Hub Town`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d4a24c',
      })
      .setOrigin(0, 0);
    this.add
      .text(8, 28, `Souls: ${services.persistent.metaCurrency}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9a988e',
      })
      .setOrigin(0, 0);
    this.add
      .text(8, GAME_HEIGHT - 24, 'Click the dungeon entrance to descend · ESC for menu', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#5a5848',
      })
      .setOrigin(0, 0);
    void COLORS;
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    // If they clicked on or adjacent to the dungeon entrance 2x2, prompt.
    const within =
      tx >= this.dungeonEntrance.x &&
      tx <= this.dungeonEntrance.x + 1 &&
      ty >= this.dungeonEntrance.y &&
      ty <= this.dungeonEntrance.y + 1;
    if (within) {
      this.promptDescend();
      return;
    }
    // Otherwise, walk: instant teleport in v1 for simplicity (turn loop is in the dungeon).
    this.playerTile = { x: tx, y: ty };
    this.playerSprite.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
  }

  private onKey(e: KeyboardEvent): void {
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        dy = -1;
        break;
      case 'ArrowDown':
      case 's':
        dy = 1;
        break;
      case 'ArrowLeft':
      case 'a':
        dx = -1;
        break;
      case 'ArrowRight':
      case 'd':
        dx = 1;
        break;
      case 'Enter':
      case ' ':
        // If next to the dungeon entrance, prompt.
        if (
          Math.abs(this.playerTile.x - (this.dungeonEntrance.x + 0.5)) <= 1.5 &&
          Math.abs(this.playerTile.y - (this.dungeonEntrance.y + 0.5)) <= 1.5
        ) {
          this.promptDescend();
        }
        return;
      default:
        return;
    }
    const nx = this.playerTile.x + dx;
    const ny = this.playerTile.y + dy;
    this.playerTile = { x: nx, y: ny };
    this.playerSprite.setPosition(nx * TILE_SIZE + TILE_SIZE / 2, ny * TILE_SIZE + TILE_SIZE / 2);
  }

  private promptDescend(): void {
    this.scene.launch(SCENE_KEYS.ConfirmDialog, {
      title: 'Descend into the dungeon?',
      body: 'You will lose any items on your person if you die.\nMeta-currency you earn returns with you.',
      confirmText: 'Descend',
      cancelText: 'Stay',
      onConfirm: () => this.scene.start(SCENE_KEYS.Dungeon, { fresh: true }),
    });
  }
}
