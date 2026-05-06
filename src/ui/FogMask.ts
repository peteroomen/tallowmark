import type Phaser from 'phaser';
import { TILE_SIZE } from '@/config';

export interface FogMaskOptions {
  scene: Phaser.Scene;
  /** Width of the dungeon in tiles. */
  cols: number;
  /** Height of the dungeon in tiles. */
  rows: number;
  /** Source tile size on screen. */
  tilePx?: number;
}

/**
 * Renders the fog-of-war overlay on top of the dungeon.
 *
 *   currently visible          → no fill (player sees clearly)
 *   explored, not currently    → 50% black (player remembers walls / items)
 *   never seen                 → 92% black (you don't know what's there)
 *
 * Backed by a `Graphics` object that we redraw every player turn. Cheap
 * (single GameObject, single render call), simple to inspect, and works
 * uniformly across Phaser versions / WebGL / Canvas backends.
 */
export class FogMask {
  private readonly cols: number;
  private readonly rows: number;
  private readonly tilePx: number;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(opts: FogMaskOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.tilePx = opts.tilePx ?? TILE_SIZE;
    this.gfx = opts.scene.add.graphics().setDepth(50);
  }

  /**
   * Update the mask from the current data layer. `visible` are tiles in the
   * player's current FoV; `explored` are tiles that have ever been visible.
   *
   * Includes a 1-tile soft-edge feather: visible tiles that border at least
   * one non-visible neighbour get a subtle dim overlay so the boundary
   * doesn't read as a hard geometric edge.
   */
  update(visible: ReadonlySet<string>, explored: ReadonlySet<string>): void {
    this.gfx.clear();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const key = `${x},${y}`;
        if (visible.has(key)) {
          // Visible tile — feather if any 8-dir neighbour is non-visible.
          if (this.hasNonVisibleNeighbour(x, y, visible)) {
            this.gfx.fillStyle(0x000000, 0.18);
            this.gfx.fillRect(x * this.tilePx, y * this.tilePx, this.tilePx, this.tilePx);
          }
          continue;
        }
        const alpha = explored.has(key) ? 0.55 : 0.92;
        this.gfx.fillStyle(0x000000, alpha);
        this.gfx.fillRect(x * this.tilePx, y * this.tilePx, this.tilePx, this.tilePx);
      }
    }
  }

  private hasNonVisibleNeighbour(x: number, y: number, visible: ReadonlySet<string>): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!visible.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  }

  /** Reset the mask (e.g. when descending to a new floor). */
  clear(): void {
    this.gfx.clear();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

/** Convenience for forming the "x,y" key matching the FoV module's format. */
export const fogKey = (x: number, y: number): string => `${x},${y}`;
