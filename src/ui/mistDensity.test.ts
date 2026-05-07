import { describe, expect, it } from 'vitest';
import { densityForScale, MIST_DENSITY } from './mistDensity';

describe('MIST_DENSITY', () => {
  it('thin matches the §L spec (alpha 0.35, drift 6 px/s)', () => {
    expect(MIST_DENSITY.thin).toEqual({ alpha: 0.35, driftSpeed: 6 });
  });

  it('medium matches the spec (alpha 0.5, drift 6 px/s)', () => {
    expect(MIST_DENSITY.medium).toEqual({ alpha: 0.5, driftSpeed: 6 });
  });

  it('thick matches the spec (alpha 0.6, drift 4 px/s)', () => {
    expect(MIST_DENSITY.thick).toEqual({ alpha: 0.6, driftSpeed: 4 });
  });

  it('thick drifts SLOWER than thin/medium — heavier-feeling fog', () => {
    expect(MIST_DENSITY.thick.driftSpeed).toBeLessThan(MIST_DENSITY.thin.driftSpeed);
    expect(MIST_DENSITY.thick.alpha).toBeGreaterThan(MIST_DENSITY.thin.alpha);
  });
});

describe('densityForScale', () => {
  it('1×1 tile → thin', () => {
    expect(densityForScale(1, 1)).toBe('thin');
  });

  it('3×3 building → medium', () => {
    expect(densityForScale(3, 3)).toBe('medium');
  });

  it('3×4 (Inn footprint) → medium', () => {
    expect(densityForScale(3, 4)).toBe('medium');
  });

  it('5×5 region (Wizard\'s Tower) → thick', () => {
    expect(densityForScale(5, 5)).toBe('thick');
  });

  it('large region (8×6) → thick', () => {
    expect(densityForScale(8, 6)).toBe('thick');
  });
});
