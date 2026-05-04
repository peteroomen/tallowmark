import Phaser from 'phaser';
import {
  ASSET_KEYS,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_SCALE,
  SCENE_KEYS,
  TILE_SIZE,
} from '@/config';
import { CharsSheet, Inputs, TilesRPG } from '@/world/FrameCatalog';
import { getServices } from '@/services';

const TOWN_W = Math.floor(GAME_WIDTH / TILE_SIZE);
const TOWN_H = Math.floor(GAME_HEIGHT / TILE_SIZE);

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Roof color (hex) — drawn as the top half of the building. */
  roof: number;
  /** Wall color (hex) — drawn as the bottom half. */
  wall: number;
}

const BUILDINGS: Building[] = [
  { x: 2, y: 2, w: 5, h: 4, label: 'Apothecary', roof: 0x8a3a3a, wall: 0xc9a06b },
  { x: 9, y: 2, w: 5, h: 4, label: 'Blacksmith', roof: 0x4a5a6a, wall: 0xc9a06b },
  { x: 16, y: 2, w: 5, h: 4, label: 'Inn', roof: 0x6a4a2f, wall: 0xc9a06b },
  { x: 2, y: 11, w: 5, h: 3, label: 'Upgrade Shrine', roof: 0x9a7a3a, wall: 0xc9a06b },
];

const DUNGEON_ENTRANCE = { x: 17, y: 11, w: 4, h: 3 };

/**
 * Tallowmark — the hub town.
 *
 * Floor uses confirmed Kenney rpg-pack grass tiles. Buildings and the dungeon
 * entrance are drawn as palette-tinted rectangles for v2 — they read as
 * "buildings" without relying on yet-to-be-confirmed wall/roof frames.
 *
 * Trees use confirmed rpg-pack tree frames. Player uses the confirmed warrior
 * frame from the chars-pack.
 *
 * Iteration target: replace the rectangle buildings with proper Kenney
 * wall/roof tiles once frames are picked via DebugSheetScene (F9 in dev).
 */
export class TownScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private playerTile = { x: 11, y: 8 };

  constructor() {
    super(SCENE_KEYS.Town);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('town');

    this.drawGrass();
    this.drawPaths();
    for (const b of BUILDINGS) this.drawBuilding(b);
    this.drawDungeonEntrance();
    this.drawTrees();
    this.drawPlayer();
    this.drawHud();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.MainMenu));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  // ---------- World rendering ----------

  private drawGrass(): void {
    for (let y = 0; y < TOWN_H; y++) {
      for (let x = 0; x < TOWN_W; x++) {
        const frame = (x * 31 + y * 17) % 11 === 0 ? TilesRPG.grassAlt : TilesRPG.grass;
        this.add
          .image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, ASSET_KEYS.sprites.rpg, frame)
          .setScale(RENDER_SCALE);
      }
    }
  }

  private drawPaths(): void {
    // Horizontal stone path across the middle, vertical spur to the dungeon.
    const pathRow = 8;
    for (let x = 0; x < TOWN_W; x++) {
      this.placeTile(x, pathRow, TilesRPG.dirt);
    }
    for (let y = pathRow; y < DUNGEON_ENTRANCE.y; y++) {
      this.placeTile(DUNGEON_ENTRANCE.x + 1, y, TilesRPG.dirt);
    }
  }

  private drawBuilding(b: Building): void {
    const px = b.x * TILE_SIZE;
    const py = b.y * TILE_SIZE;
    const pw = b.w * TILE_SIZE;
    const ph = b.h * TILE_SIZE;

    // Roof (top 40%)
    const roofH = Math.floor(ph * 0.4);
    this.add
      .rectangle(px + pw / 2, py + roofH / 2, pw - 4, roofH - 2, b.roof)
      .setStrokeStyle(2, 0x1a1a24);

    // Wall (bottom 60%)
    this.add
      .rectangle(px + pw / 2, py + roofH + (ph - roofH) / 2, pw - 4, ph - roofH - 2, b.wall)
      .setStrokeStyle(2, 0x1a1a24);

    // Door (centered on bottom)
    const doorH = TILE_SIZE;
    this.add
      .rectangle(px + pw / 2, py + ph - doorH / 2 - 4, TILE_SIZE * 0.7, doorH, 0x3a2a1f)
      .setStrokeStyle(2, 0x1a1a24);

    // Two windows
    const winY = py + roofH + (ph - roofH) * 0.35;
    this.add.rectangle(px + pw * 0.25, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8).setStrokeStyle(2, 0x1a1a24);
    this.add.rectangle(px + pw * 0.75, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8).setStrokeStyle(2, 0x1a1a24);

    // Label
    this.add
      .text(px + pw / 2, py - 6, b.label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
  }

  private drawDungeonEntrance(): void {
    const e = DUNGEON_ENTRANCE;
    const px = e.x * TILE_SIZE;
    const py = e.y * TILE_SIZE;
    const pw = e.w * TILE_SIZE;
    const ph = e.h * TILE_SIZE;

    // Stone arch — dark grey rectangle with darker entrance cavity
    this.add.rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 2, 0x4a4a52).setStrokeStyle(3, 0x1a1a24);
    // Cavity
    this.add
      .rectangle(px + pw / 2, py + ph * 0.6, TILE_SIZE * 1.5, TILE_SIZE * 1.8, 0x14101a)
      .setStrokeStyle(2, 0x1a1a24);

    this.add
      .text(px + pw / 2, py - 6, 'TO THE DEEP ↓', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d4a24c',
        stroke: '#1a1a24',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
  }

  private drawTrees(): void {
    const trees: Array<[number, number, number]> = [
      [1, 1, TilesRPG.tree],
      [22, 1, TilesRPG.treeDark],
      [22, 6, TilesRPG.tree],
      [1, 13, TilesRPG.treeDark],
      [0, 11, TilesRPG.tree],
      [8, 12, TilesRPG.treeDark],
      [14, 12, TilesRPG.tree],
    ];
    for (const [x, y, frame] of trees) {
      if (this.inTownBounds(x, y)) this.placeTile(x, y, frame);
    }
  }

  private drawPlayer(): void {
    const px = this.playerTile.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.playerTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.playerSprite = this.add
      .image(px, py, ASSET_KEYS.sprites.chars, CharsSheet.player)
      .setScale(RENDER_SCALE)
      .setDepth(10);
  }

  private drawHud(): void {
    const services = getServices(this);
    this.add
      .text(8, 8, 'TALLOWMARK', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#d4a24c',
        fontStyle: 'bold',
        stroke: '#1a1a24',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(100);
    this.add
      .text(8, 28, `Souls: ${services.persistent.metaCurrency}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(100);

    // Footer with input-prompt sprites.
    const footerY = GAME_HEIGHT - 18;
    let fx = 10;
    const addPrompt = (frame: number, text: string) => {
      this.add
        .image(fx, footerY, ASSET_KEYS.ui.inputs, frame)
        .setOrigin(0, 0.5)
        .setScale(2)
        .setDepth(100);
      fx += 28;
      const t = this.add
        .text(fx, footerY, text, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e5e3d8',
          stroke: '#1a1a24',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5)
        .setDepth(100);
      fx += t.width + 14;
    };
    addPrompt(Inputs.mouseLeft, 'walk');
    addPrompt(Inputs.keyEsc, 'menu');
    void COLORS;
  }

  // ---------- Input handlers ----------

  private onClick(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.isInDungeonArch(tx, ty)) {
      this.promptDescend();
      return;
    }
    if (!this.inTownBounds(tx, ty)) return;
    this.movePlayerTo(tx, ty);
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
        if (
          Math.abs(this.playerTile.x - (DUNGEON_ENTRANCE.x + DUNGEON_ENTRANCE.w / 2)) <= 2 &&
          Math.abs(this.playerTile.y - (DUNGEON_ENTRANCE.y + DUNGEON_ENTRANCE.h / 2)) <= 2
        ) {
          this.promptDescend();
        }
        return;
      default:
        return;
    }
    this.movePlayerTo(this.playerTile.x + dx, this.playerTile.y + dy);
  }

  private movePlayerTo(x: number, y: number): void {
    if (!this.inTownBounds(x, y)) return;
    this.playerTile = { x, y };
    this.playerSprite.setPosition(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
  }

  // ---------- Helpers ----------

  private placeTile(x: number, y: number, frame: number): void {
    if (!this.inTownBounds(x, y)) return;
    this.add
      .image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, ASSET_KEYS.sprites.rpg, frame)
      .setScale(RENDER_SCALE);
  }

  private inTownBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H;
  }

  private isInDungeonArch(x: number, y: number): boolean {
    return (
      x >= DUNGEON_ENTRANCE.x &&
      x < DUNGEON_ENTRANCE.x + DUNGEON_ENTRANCE.w &&
      y >= DUNGEON_ENTRANCE.y &&
      y < DUNGEON_ENTRANCE.y + DUNGEON_ENTRANCE.h
    );
  }

  private promptDescend(): void {
    this.scene.launch(SCENE_KEYS.ConfirmDialog, {
      title: 'Descend?',
      body: 'You will lose any items on your person if you die.\nMeta-currency you earn returns with you.',
      confirmText: 'Descend',
      cancelText: 'Stay',
      onConfirm: () => this.scene.start(SCENE_KEYS.Dungeon, { fresh: true }),
    });
  }
}
