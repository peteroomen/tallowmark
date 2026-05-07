import Phaser from 'phaser';
import { TILE_SIZE } from '@/config';
import { MIST_DENSITY, type MistDensity } from './mistDensity';

/**
 * Drifting fog overlay per refinement-002 §L — the "mist" half of the
 * "physical block + mist" locked-content visual language.
 *
 * Three density presets scale with how distant the unlock is:
 *   - 'thin'   — alpha 0.35, 6 px/sec drift   — day-1 secret door
 *   - 'medium' — alpha 0.50, 6 px/sec drift   — Tier 0 building (3×3)
 *   - 'thick'  — alpha 0.60, 4 px/sec drift   — region (5×5 Wizard's Tower)
 *
 * Players learn: *more fog = farther unlock*. The slower drift on thick
 * mist reads as heavier and harder to see through.
 *
 * Implementation: Phaser.GameObjects.TileSprite with a procedurally-
 * generated 64×64 fog texture (radial blobs scattered for an organic
 * feel). The texture is cached per scene so all overlays share it. The
 * tilePositionX is incremented each frame for the horizontal drift.
 *
 * Companion to the BOARDED visuals (TilesRPG.wB / dB) — this widget
 * is the *atmospheric* layer; the boarded planks are the *physical
 * block* layer. Together they encode "this is a place. It's not for
 * you yet. You can see why."
 */

export type { MistDensity } from './mistDensity';

export interface MistOverlayOptions {
  scene: Phaser.Scene;
  /** Tile-coord region the mist covers. */
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  density?: MistDensity;
  /** Hex tint for the mist (default white = pure fog). */
  color?: number;
  /** Z-depth — defaults to 8 (above floor + decorations, below actors). */
  depth?: number;
}

const MIST_TEXTURE_KEY = 'tallowmark_mist_texture_v1';
const MIST_TEXTURE_SIZE = 64;

export class MistOverlay extends Phaser.GameObjects.Container {
  private readonly tileSprite: Phaser.GameObjects.TileSprite;
  private readonly speed: number;
  private readonly tickHandler: (time: number, delta: number) => void;

  constructor(opts: MistOverlayOptions) {
    super(opts.scene, 0, 0);
    const density = opts.density ?? 'medium';
    const cfg = MIST_DENSITY[density];
    this.speed = cfg.driftSpeed;

    const texKey = MistOverlay.ensureMistTexture(opts.scene);

    this.tileSprite = opts.scene.add.tileSprite(
      opts.tileX * TILE_SIZE,
      opts.tileY * TILE_SIZE,
      opts.tileW * TILE_SIZE,
      opts.tileH * TILE_SIZE,
      texKey,
    );
    this.tileSprite.setOrigin(0, 0);
    this.tileSprite.setAlpha(cfg.alpha);
    this.tileSprite.setDepth(opts.depth ?? 8);
    if (opts.color !== undefined) this.tileSprite.setTint(opts.color);

    this.add(this.tileSprite);
    opts.scene.add.existing(this);

    // Drive the drift in the scene's update loop. Detach on shutdown so we
    // don't leak handlers across scene restarts.
    this.tickHandler = (_time: number, delta: number) => {
      this.tileSprite.tilePositionX += (this.speed * delta) / 1000;
    };
    opts.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tickHandler);
    opts.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      opts.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tickHandler);
    });
  }

  /**
   * Generate the procedural mist texture once per game session. Cached on
   * Phaser's TextureManager keyed on `MIST_TEXTURE_KEY` — subsequent
   * MistOverlay instances reuse it (cheap, no per-instance canvas churn).
   */
  private static ensureMistTexture(scene: Phaser.Scene): string {
    if (scene.textures.exists(MIST_TEXTURE_KEY)) return MIST_TEXTURE_KEY;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    // Soft fog: scattered radial blobs of varying size + alpha for an
    // organic, non-tilable-looking texture (even though it tiles).
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, MIST_TEXTURE_SIZE, MIST_TEXTURE_SIZE);
    // Pre-compute blob positions deterministically so the texture is the
    // same every load (no flicker on hot-reload).
    const blobs: Array<[number, number, number, number]> = [
      // [x, y, radius, alpha]
      [10, 12, 14, 0.55],
      [42, 18, 11, 0.45],
      [22, 38, 16, 0.5],
      [55, 44, 9, 0.4],
      [4, 52, 12, 0.45],
      [38, 8, 8, 0.35],
      [50, 32, 13, 0.5],
      [18, 58, 10, 0.4],
      [60, 60, 7, 0.3],
      [30, 26, 6, 0.3],
    ];
    for (const [x, y, r, a] of blobs) {
      g.fillStyle(0xffffff, a);
      g.fillCircle(x, y, r);
    }
    g.generateTexture(MIST_TEXTURE_KEY, MIST_TEXTURE_SIZE, MIST_TEXTURE_SIZE);
    g.destroy();
    return MIST_TEXTURE_KEY;
  }
}
