import { describe, expect, it } from 'vitest';
import { computeFov, fovKey } from './Fov';

describe('computeFov', () => {
  it('sees nothing past an opaque wall directly adjacent', () => {
    // origin at (5,5); a single wall column at x=6 blocks line-of-sight east.
    const isOpaque = (x: number, _y: number) => x === 6;
    const vis = computeFov({ x: 5, y: 5 }, 8, isOpaque);
    // Origin always visible.
    expect(vis.has(fovKey(5, 5))).toBe(true);
    // The wall tile itself is visible (you see the wall).
    expect(vis.has(fovKey(6, 5))).toBe(true);
    // Past the wall on the same row should be hidden.
    expect(vis.has(fovKey(7, 5))).toBe(false);
    expect(vis.has(fovKey(8, 5))).toBe(false);
  });

  it('respects radius', () => {
    const isOpaque = () => false;
    const vis = computeFov({ x: 0, y: 0 }, 3, isOpaque);
    expect(vis.has(fovKey(3, 0))).toBe(true);
    expect(vis.has(fovKey(4, 0))).toBe(false);
  });
});
