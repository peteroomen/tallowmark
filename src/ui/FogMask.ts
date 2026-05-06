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
   */
  update(visible: ReadonlySet<string>, explored: ReadonlySet<string>): void {
    this.gfx.clear();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const key = `${x},${y}`;
        if (visible.has(key)) {
          // Currently visible — leave fully transparent.
          continue;
        }
        const alpha = explored.has(key) ? 0.55 : 0.92;
        this.gfx.fillStyle(0x000000, alpha);
        this.gfx.fillRect(x * this.tilePx, y * this.tilePx, this.tilePx, this.tilePx);
      }
    }
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
