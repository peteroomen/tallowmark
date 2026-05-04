import * as ROT from 'rot-js';
import type { Point } from './Grid';

export type WalkableFn = (x: number, y: number) => boolean;

/**
 * 8-directional A* pathfinding via rot.js.
 * Diagonals cost the same as cardinals (classic roguelike convention).
 *
 * Returns the full path including start and goal, or [] if no path exists.
 */
export function findPath(start: Point, goal: Point, isWalkable: WalkableFn): Point[] {
  // The goal must be walkable for rot.js A* to terminate; if it isn't, no path.
  if (!isWalkable(goal.x, goal.y)) return [];

  const astar = new ROT.Path.AStar(goal.x, goal.y, isWalkable, { topology: 8 });
  const out: Point[] = [];
  astar.compute(start.x, start.y, (x, y) => {
    out.push({ x, y });
  });
  return out;
}

/**
 * Like findPath, but allows the goal tile itself to be non-walkable
 * (useful when the goal is occupied by a "bumpable" target like an enemy).
 * Computes a path to a walkable neighbour adjacent to the goal, then appends
 * the goal so callers can detect bump intent.
 */
export function findPathToBump(
  start: Point,
  goal: Point,
  isWalkable: WalkableFn,
): Point[] {
  if (isWalkable(goal.x, goal.y)) return findPath(start, goal, isWalkable);

  // Try each of the 8 neighbours of the goal; pick the shortest path to one of them.
  let best: Point[] = [];
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];
  for (const [dx, dy] of offsets) {
    const nx = goal.x + dx;
    const ny = goal.y + dy;
    if (!isWalkable(nx, ny)) continue;
    const p = findPath(start, { x: nx, y: ny }, isWalkable);
    if (p.length > 0 && (best.length === 0 || p.length < best.length)) best = p;
  }
  if (best.length === 0) return [];
  // Append the goal so the caller knows the *intent* extends to bumping it.
  best.push({ x: goal.x, y: goal.y });
  return best;
}
