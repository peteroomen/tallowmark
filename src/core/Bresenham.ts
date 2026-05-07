/**
 * Bresenham's line algorithm + line-of-sight predicate.
 *
 * The renderer uses `bresenhamLine` to tween a projectile sprite along a
 * straight grid line from shooter to target. AI uses `hasLineOfSight` to
 * decide whether to fire (if any tile along the line is opaque, no shot).
 *
 * Pure functions over `Point[]` — Phaser-free, fully unit-testable.
 */

import type { Point } from './Grid';

/**
 * Returns the inclusive set of grid points on the line from `a` to `b`.
 * The first point is `a`, the last is `b`. Diagonals count.
 */
export function bresenhamLine(a: Point, b: Point): Point[] {
  const points: Point[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

/**
 * True iff every tile strictly between `a` and `b` (exclusive endpoints)
 * is non-opaque. Endpoints are not tested — a shooter on an opaque tile
 * can still fire at a target on an opaque tile, which is the right call
 * for things like "skeleton on stairs shooting through doorway".
 */
export function hasLineOfSight(
  a: Point,
  b: Point,
  isOpaque: (x: number, y: number) => boolean,
): boolean {
  const line = bresenhamLine(a, b);
  for (let i = 1; i < line.length - 1; i++) {
    const p = line[i]!;
    if (isOpaque(p.x, p.y)) return false;
  }
  return true;
}
