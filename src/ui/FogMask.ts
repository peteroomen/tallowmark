import type Phaser from 'phaser';
import { TILE_SIZE } from '@/config';

export interface FogMaskOptions {
  scene: Phaser.Scene;
  /** Width of the dungeon in tiles. */
  cols: number;
  /** Height of the dungeon in tiles. */
  rows: number;
  /** Render scale factor used for tile sprites; defaults to TILE_SIZE-based. */
  tilePx?: number;
}

/**
 * Renders the fog-of-war overlay on top of the dungeon.
 *
 *   currently visible tiles  → fully transparent (player sees clearly)
 *   explored-not-visible     → 50% dark (player remembers walls / items)
 *   never seen               → fully black (you don't know what's there)
 *
 * Backed by a `RenderTexture` so we can later blur it for soft edges or
 * pipe it through a fragment shader. The data layer (Set<string> of visible
 * tile keys + Set<string> of explored tile keys) drives the render.
 *
 * **Stage 4 scaffold note:** the mask is created and updated each turn, but
 * the dungeon scene currently passes a sight radius of ~999 — i.e. every
 * tile is in the visible set, so the mask draws nothing. Flipping this on
 * for real is the next stage; the data flow + plumbing are ready.
 */
export class FogMask {
  private readonly scene: Phaser.Scene;
  private readonly cols: number;
  private readonly rows: number;
  private readonly tilePx: number;
  private readonly rt: Phaser.GameObjects.RenderTexture;

  constructor(opts: FogMaskOptions) {
    this.scene = opts.scene;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.tilePx = opts.tilePx ?? TILE_SIZE;
    const w = this.cols * this.tilePx;
    const h = this.rows * this.tilePx;
    this.rt = this.scene.add
      .renderTexture(0, 0, w, h)
      .setOrigin(0, 0)
      .setDepth(50); // above tiles & actors, below HUD (HUD is depth 1000+)
    this.clear();
  }

  /**
   * Update the mask from the current data layer. `visible` are tiles in the
   * player's current FoV; `explored` are tiles that have ever been visible.
   */
  update(visible: ReadonlySet<string>, explored: ReadonlySet<string>): void {
    this.rt.clear();
    // Fill with full black; we'll erase visible / dim-fill explored.
    this.rt.fill(0x000000, 1);

    const tile = this.tilePx;
    // Erase explored-not-visible tiles to ~50% dark (so the player remembers
    // them but they're still "in shadow"). We do this by drawing a dim rect.
    // To get partial transparency, we draw black at 0 (erase fully) for the
    // visible set and re-fill the explored-not-visible set at 0.5 alpha.
    this.rt.beginDraw();
    for (const key of explored) {
      if (visible.has(key)) continue;
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      // Dim grey rect to soften the "remembered but not currently visible"
      // tiles vs full black for never-seen.
      this.rt.drawFrame('__WHITE', undefined, x * tile, y * tile);
    }
    this.rt.endDraw();

    // Erase the currently-visible tiles to full transparency.
    for (const key of visible) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      this.rt.erase('__WHITE', x * tile, y * tile);
    }
  }

  /** Reset the entire mask (e.g. when descending a floor). */
  clear(): void {
    this.rt.clear();
    // Stage 4 scaffold: leave fully transparent so behaviour is unchanged
    // until the renderer is wired in for real.
    this.rt.fill(0x000000, 0);
  }

  destroy(): void {
    this.rt.destroy();
  }
}

/** Convenience for forming the "x,y" key matching the FoV module's format. */
export const fogKey = (x: number, y: number): string => `${x},${y}`;
