import Phaser from 'phaser';
import type { Grid } from '@/core/Grid';
import type { TileKind } from '@/world/Tile';
import { TileKind as TK } from '@/world/Tile';
import type { Point } from '@/core/Grid';

/**
 * Bottom-right HUD minimap MVP per refinement-002 / iter-2 stage 12.
 *
 * 3 px per dungeon tile by default → 120 × 80 px widget for the typical
 * BSP grid (40 × 27). Renders walls, floors, stairs, items, traps, the
 * player, and enemy ghost markers using the same colour palette as the
 * rect-based dungeon renderer for visual continuity. Same widget will be
 * extended in iter-3 stage 3 to sample real tile palettes per biome,
 * and in iter-7 to swap content for a world-map view.
 *
 * Toggle (m-key) expands the widget to 3× scale via setScale; the
 * underlying canvas size doesn't change (smaller memory footprint).
 */

export interface MinimapOptions {
  scene: Phaser.Scene;
  /** Bottom-right anchor; px offset from the screen edge. */
  rightOffset?: number;
  bottomOffset?: number;
  /** Pixels per dungeon tile in compact mode. */
  pxPerTile?: number;
}

const COLOR_BG = 0x1a1a14;
const COLOR_BORDER = 0xd4a24c;
const COLOR_WALL = 0x2a2218;
const COLOR_FLOOR = 0x6a6470;
const COLOR_STAIR_DOWN = 0x4a9ed4;
const COLOR_STAIR_UP = 0xd4a24c;
const COLOR_PLAYER = 0xfffbe6;
const COLOR_ENEMY = 0xd44a4a;
const COLOR_ENEMY_GHOST = 0x6a4a4a;
const COLOR_ITEM = 0xd4a24c;
const COLOR_TRAP = 0xd44a4a;

export class Minimap extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly pxPerTile: number;
  private expanded = false;
  private readonly widthPx: number;
  private readonly heightPx: number;
  private readonly anchorRight: number;
  private readonly anchorBottom: number;

  constructor(opts: MinimapOptions, gridCols: number, gridRows: number) {
    const px = opts.pxPerTile ?? 3;
    const w = gridCols * px;
    const h = gridRows * px;
    const anchorRight = opts.rightOffset ?? 8;
    const anchorBottom = opts.bottomOffset ?? 110;
    const x = (opts.scene.scale.width ?? opts.scene.cameras.main.width) - w - anchorRight;
    const y = (opts.scene.scale.height ?? opts.scene.cameras.main.height) - h - anchorBottom;

    super(opts.scene, x, y);
    this.pxPerTile = px;
    this.widthPx = w;
    this.heightPx = h;
    this.anchorRight = anchorRight;
    this.anchorBottom = anchorBottom;

    this.bg = opts.scene.add.rectangle(0, 0, w + 4, h + 4, COLOR_BG, 0.85).setOrigin(0, 0);
    this.border = opts.scene.add
      .rectangle(0, 0, w + 4, h + 4, 0, 0)
      .setStrokeStyle(1, COLOR_BORDER, 0.7)
      .setOrigin(0, 0);
    this.graphics = opts.scene.add.graphics();
    this.graphics.x = 2;
    this.graphics.y = 2;

    this.add([this.bg, this.border, this.graphics]);
    this.setScrollFactor(0);
    this.setDepth(990);
    opts.scene.add.existing(this);
  }

  /** Re-render from the dungeon state. Cheap — called once per turn. */
  render(opts: {
    tiles: Grid<TileKind>;
    visibleKeys: Set<string>;
    exploredKeys: Set<string>;
    playerPos: Point;
    enemies: ReadonlyArray<{ pos: Point; alive: boolean }>;
    enemyGhosts: ReadonlyArray<Point>;
    items: ReadonlyArray<{ pos: Point }>;
    revealedTraps: ReadonlyArray<{ pos: Point }>;
    /** Force-shown stairs-down point — used by the 60%-explored auto-reveal. */
    revealedStairsDown?: Point;
  }): void {
    const g = this.graphics;
    const px = this.pxPerTile;
    g.clear();

    // Tiles — only render explored.
    for (let y = 0; y < opts.tiles.height; y++) {
      for (let x = 0; x < opts.tiles.width; x++) {
        const key = `${x},${y}`;
        const explored = opts.exploredKeys.has(key);
        if (!explored) continue;
        const visible = opts.visibleKeys.has(key);
        const kind = opts.tiles.get(x, y);
        let color = COLOR_FLOOR;
        if (kind === TK.Wall) color = COLOR_WALL;
        else if (kind === TK.StairsDown) color = COLOR_STAIR_DOWN;
        else if (kind === TK.StairsUp) color = COLOR_STAIR_UP;
        g.fillStyle(color, visible ? 1 : 0.5);
        g.fillRect(x * px, y * px, px, px);
      }
    }
    // Items (explored visible only — items in unexplored fog are still hidden).
    for (const it of opts.items) {
      const key = `${it.pos.x},${it.pos.y}`;
      if (!opts.visibleKeys.has(key)) continue;
      g.fillStyle(COLOR_ITEM, 1);
      g.fillRect(it.pos.x * px, it.pos.y * px, px, px);
    }
    // Revealed traps.
    for (const t of opts.revealedTraps) {
      g.fillStyle(COLOR_TRAP, 1);
      g.fillRect(t.pos.x * px, t.pos.y * px, px, px);
    }
    // Force-revealed stairs-down (60%-explored auto-reveal). Pulses subtly
    // — drawn as a slightly-larger cyan dot so it reads as a destination
    // hint, not the same weight as a normally-explored stair tile.
    if (opts.revealedStairsDown && !opts.exploredKeys.has(`${opts.revealedStairsDown.x},${opts.revealedStairsDown.y}`)) {
      g.fillStyle(COLOR_STAIR_DOWN, 0.85);
      g.fillRect(opts.revealedStairsDown.x * px - 1, opts.revealedStairsDown.y * px - 1, px + 2, px + 2);
    }
    // Enemy ghost markers (last-seen positions, semi-transparent).
    for (const ghost of opts.enemyGhosts) {
      g.fillStyle(COLOR_ENEMY_GHOST, 0.7);
      g.fillRect(ghost.x * px, ghost.y * px, px, px);
    }
    // Live enemies in current FoV.
    for (const e of opts.enemies) {
      if (!e.alive) continue;
      const key = `${e.pos.x},${e.pos.y}`;
      if (!opts.visibleKeys.has(key)) continue;
      g.fillStyle(COLOR_ENEMY, 1);
      g.fillRect(e.pos.x * px, e.pos.y * px, px, px);
    }
    // Player on top.
    g.fillStyle(COLOR_PLAYER, 1);
    g.fillRect(opts.playerPos.x * px, opts.playerPos.y * px, px, px);
  }

  /** Toggle compact ↔ expanded view (m-key). */
  toggle(): void {
    this.expanded = !this.expanded;
    if (this.expanded) {
      this.setScale(3);
      // Anchor to centre when expanded so it doesn't fall off-screen.
      this.x = (this.scene.scale.width - this.widthPx * 3) / 2;
      this.y = (this.scene.scale.height - this.heightPx * 3) / 2;
    } else {
      this.setScale(1);
      this.x = this.scene.scale.width - this.widthPx - this.anchorRight;
      this.y = this.scene.scale.height - this.heightPx - this.anchorBottom;
    }
  }

  isExpanded(): boolean {
    return this.expanded;
  }
}
