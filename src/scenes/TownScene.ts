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
import { CharsSheet, Inputs, TilesRPG, UiLarge } from '@/world/FrameCatalog';
import { getServices } from '@/services';

const TOWN_W = Math.floor(GAME_WIDTH / TILE_SIZE);
const TOWN_H = Math.floor(GAME_HEIGHT / TILE_SIZE);
const STEP_TWEEN_MS = 130;

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  roof: number;
  wall: number;
}

const BUILDINGS: Building[] = [
  { x: 2, y: 2, w: 5, h: 4, label: 'Apothecary', roof: 0x8a3a3a, wall: 0xc9a06b },
  { x: 9, y: 2, w: 5, h: 4, label: 'Blacksmith', roof: 0x4a5a6a, wall: 0xc9a06b },
  { x: 16, y: 2, w: 5, h: 4, label: 'Inn', roof: 0x6a4a2f, wall: 0xc9a06b },
  { x: 2, y: 11, w: 5, h: 3, label: 'Upgrade Shrine', roof: 0x9a7a3a, wall: 0xc9a06b },
];

// One multi-tile lake placed in the open band between the Upgrade Shrine
// (left) and the Dungeon Entrance (right), below the main horizontal path.
// Drawn as a contiguous block so it reads as one body of water rather than
// scattered fragments.
const LAKE = { x: 8, y: 10, w: 5, h: 4 };

const DUNGEON_ENTRANCE = { x: 17, y: 11, w: 4, h: 3 };

/**
 * Tallowmark — the hub town.
 *
 * Floor: confirmed Kenney rpg-pack grass tiles.
 * Buildings, lake, dungeon entrance: palette-tinted rectangles for v2 (real
 * Kenney building tiles arrive in iteration 2 once the in-game paint mode
 * is wired up).
 * Player: confirmed Kenney warrior sprite.
 * Movement: tweens between tiles for a smoother feel.
 */
export class TownScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private playerTile = { x: 11, y: 8 };
  private moving = false;

  constructor() {
    super(SCENE_KEYS.Town);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('town');

    this.drawGrass();
    this.drawLake();
    this.drawPaths();
    for (const b of BUILDINGS) this.drawBuilding(b);
    this.drawDungeonEntrance();
    this.drawPlayer();
    this.drawHud();

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.MainMenu));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  // ---------- World rendering ----------

  private drawGrass(): void {
    // Plain grass — no checkerboard variation for now (the alternate frame
    // wasn't actually grass and rendered as fragments). One clean field.
    for (let y = 0; y < TOWN_H; y++) {
      for (let x = 0; x < TOWN_W; x++) {
        this.add
          .image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            ASSET_KEYS.sprites.rpg,
            TilesRPG.grass,
          )
          .setScale(RENDER_SCALE);
      }
    }
  }

  private drawLake(): void {
    // One big body of water — flat blue rectangle with a darker outline so it
    // reads as a coherent lake instead of dozens of scattered shore-edge tiles.
    const px = LAKE.x * TILE_SIZE;
    const py = LAKE.y * TILE_SIZE;
    const pw = LAKE.w * TILE_SIZE;
    const ph = LAKE.h * TILE_SIZE;
    this.add
      .rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 4, 0x4a8aa8)
      .setStrokeStyle(3, 0x2a5870);
    // Subtle ripple lines.
    for (let i = 0; i < 4; i++) {
      const rx = px + 8 + Math.floor(((i * 17) % (pw - 64)));
      const ry = py + 12 + i * 28;
      this.add.rectangle(rx, ry, 24, 2, 0x6aa8c8).setOrigin(0, 0.5);
    }
  }

  private drawPaths(): void {
    const pathRow = 8;
    for (let x = 0; x < TOWN_W; x++) this.placeTile(x, pathRow, TilesRPG.dirt);
    for (let y = pathRow; y < DUNGEON_ENTRANCE.y; y++) {
      this.placeTile(DUNGEON_ENTRANCE.x + 1, y, TilesRPG.dirt);
    }
  }

  private drawBuilding(b: Building): void {
    const px = b.x * TILE_SIZE;
    const py = b.y * TILE_SIZE;
    const pw = b.w * TILE_SIZE;
    const ph = b.h * TILE_SIZE;

    const roofH = Math.floor(ph * 0.4);
    this.add
      .rectangle(px + pw / 2, py + roofH / 2, pw - 4, roofH - 2, b.roof)
      .setStrokeStyle(2, 0x1a1a24);
    this.add
      .rectangle(px + pw / 2, py + roofH + (ph - roofH) / 2, pw - 4, ph - roofH - 2, b.wall)
      .setStrokeStyle(2, 0x1a1a24);

    const doorH = TILE_SIZE;
    this.add
      .rectangle(px + pw / 2, py + ph - doorH / 2 - 4, TILE_SIZE * 0.7, doorH, 0x3a2a1f)
      .setStrokeStyle(2, 0x1a1a24);

    const winY = py + roofH + (ph - roofH) * 0.35;
    this.add
      .rectangle(px + pw * 0.25, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8)
      .setStrokeStyle(2, 0x1a1a24);
    this.add
      .rectangle(px + pw * 0.75, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8)
      .setStrokeStyle(2, 0x1a1a24);

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

    this.add.rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 2, 0x4a4a52).setStrokeStyle(3, 0x1a1a24);
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
      .text(8, 28, `Embers: ${services.persistent.metaCurrency}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(100);

    this.drawHudIcons();
    this.drawFooter();
    void COLORS;
  }

  private drawHudIcons(): void {
    const items: Array<{ frame: number; key: string; onClick: () => void }> = [
      {
        frame: UiLarge.buttonGrey,
        key: 'I',
        onClick: () => this.scene.launch(SCENE_KEYS.Inventory),
      },
      {
        frame: UiLarge.buttonGrey,
        key: 'C',
        onClick: () => this.scene.launch(SCENE_KEYS.Character),
      },
    ];
    let x = GAME_WIDTH - 24;
    const y = 24;
    for (const it of items) {
      const slice = this.add
        .nineslice(x, y, ASSET_KEYS.ui.large, it.frame, 36, 36, 6, 6, 6, 6)
        .setOrigin(0.5)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      slice.on('pointerover', () => slice.setAlpha(0.9));
      slice.on('pointerout', () => slice.setAlpha(1));
      slice.on('pointerdown', () => slice.setAlpha(0.78));
      slice.on('pointerup', () => {
        slice.setAlpha(1);
        try {
          getServices(this).audio.playSfx(ASSET_KEYS.audio.sfxClick);
        } catch {
          /* test contexts */
        }
        it.onClick();
      });
      this.add
        .text(x, y, it.key, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#3a2a1f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(101);
      x -= 42;
    }
  }

  private drawFooter(): void {
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
  }

  // ---------- Input ----------

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
      case 'i':
        this.scene.launch(SCENE_KEYS.Inventory);
        return;
      case 'c':
        this.scene.launch(SCENE_KEYS.Character);
        return;
      default:
        return;
    }
    this.movePlayerTo(this.playerTile.x + dx, this.playerTile.y + dy);
  }

  private movePlayerTo(x: number, y: number): void {
    if (!this.inTownBounds(x, y)) return;
    if (this.moving) return;
    this.playerTile = { x, y };
    this.moving = true;
    this.tweens.add({
      targets: this.playerSprite,
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
      duration: STEP_TWEEN_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.moving = false;
      },
    });
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
