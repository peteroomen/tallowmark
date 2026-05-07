/**
 * Locked-content mist density presets per refinement-002 §L.
 *
 * Players learn: more fog = farther unlock. The slower drift on thick
 * mist reads as heavier and harder to see through. Pure data — kept in
 * its own module so tests can import without pulling Phaser.
 */

export type MistDensity = 'thin' | 'medium' | 'thick';

export interface MistConfig {
  /** Overlay alpha (0..1). */
  alpha: number;
  /** Horizontal drift speed in pixels per second. */
  driftSpeed: number;
}

export const MIST_DENSITY: Record<MistDensity, MistConfig> = {
  thin: { alpha: 0.35, driftSpeed: 6 },
  medium: { alpha: 0.5, driftSpeed: 6 },
  thick: { alpha: 0.6, driftSpeed: 4 },
};

/**
 * Suggested density for each scale per refinement-002 §L:
 *   tile (1×1)            — thin    (e.g. day-1 secret door)
 *   building (≤ 4×4)      — medium  (e.g. Tier 0 building, Inn 3×4)
 *   region (> 4 in either) — thick   (e.g. day-1 Wizard's Tower 5×5+)
 */
export function densityForScale(tileWidth: number, tileHeight: number): MistDensity {
  if (tileWidth <= 1 && tileHeight <= 1) return 'thin';
  if (tileWidth <= 4 && tileHeight <= 4) return 'medium';
  return 'thick';
}
