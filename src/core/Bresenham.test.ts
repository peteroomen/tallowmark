import { describe, expect, it } from 'vitest';
import { bresenhamLine, hasLineOfSight } from './Bresenham';

describe('bresenhamLine', () => {
  it('returns a single point when a and b are equal', () => {
    expect(bresenhamLine({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }]);
  });

  it('walks a horizontal line east', () => {
    const line = bresenhamLine({ x: 0, y: 0 }, { x: 3, y: 0 });
    expect(line).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('walks a vertical line south', () => {
    const line = bresenhamLine({ x: 0, y: 0 }, { x: 0, y: 3 });
    expect(line).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
  });

  it('walks a diagonal line', () => {
    const line = bresenhamLine({ x: 0, y: 0 }, { x: 3, y: 3 });
    expect(line).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('handles negative directions', () => {
    const line = bresenhamLine({ x: 3, y: 3 }, { x: 0, y: 0 });
    expect(line).toEqual([
      { x: 3, y: 3 },
      { x: 2, y: 2 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ]);
  });

  it('handles steep lines', () => {
    const line = bresenhamLine({ x: 0, y: 0 }, { x: 2, y: 5 });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 2, y: 5 });
    // Each step should advance by exactly 1 in y, occasionally 1 in x.
    for (let i = 1; i < line.length; i++) {
      const p = line[i]!;
      const prev = line[i - 1]!;
      expect(Math.abs(p.x - prev.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y - prev.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('hasLineOfSight', () => {
  const noOpaque = () => false;
  const allOpaque = () => true;
  const opaqueAt = (oxs: number[], oys: number[]) => (x: number, y: number) =>
    oxs.includes(x) && oys.includes(y);

  it('open ground has LoS', () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, noOpaque)).toBe(true);
  });

  it('endpoints opaque does NOT block LoS', () => {
    // Shooter and target can both be on opaque tiles; only intermediate counts.
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 0 }, allOpaque)).toBe(false);
    // Single-step line: only endpoints, no intermediate — LoS holds even with allOpaque.
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 1, y: 0 }, allOpaque)).toBe(true);
  });

  it('an intermediate opaque tile blocks LoS', () => {
    // Wall at x=2 between (0,0) and (4,0).
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, opaqueAt([2], [0]))).toBe(false);
  });

  it('LoS through gap', () => {
    // Wall only at (3, 5) — not on the line from (0,0) to (4,0).
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, opaqueAt([3], [5]))).toBe(true);
  });
});
