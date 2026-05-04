import { describe, expect, it } from 'vitest';
import { Grid } from './Grid';
import { findPath, findPathToBump } from './Pathfinding';

function makeMap(rows: string[]): { walk: (x: number, y: number) => boolean; w: number; h: number } {
  const h = rows.length;
  const w = rows[0]!.length;
  const g = new Grid<boolean>(w, h, (x, y) => rows[y]![x] === '.');
  return {
    walk: (x, y) => g.inBounds(x, y) && g.get(x, y),
    w,
    h,
  };
}

describe('findPath', () => {
  it('finds a straight path in an open room', () => {
    const m = makeMap(['.....', '.....', '.....']);
    const path = findPath({ x: 0, y: 0 }, { x: 4, y: 2 }, m.walk);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
    // Diagonals allowed: 8-dir Chebyshev distance is 4, so path length is 5 (start..goal inclusive).
    expect(path.length).toBe(5);
  });

  it('routes around walls', () => {
    const m = makeMap([
      '.....',
      '..#..',
      '..#..',
      '..#..',
      '.....',
    ]);
    const path = findPath({ x: 0, y: 2 }, { x: 4, y: 2 }, m.walk);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0, y: 2 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
    // Must not pass through any '#' tile.
    for (const p of path) expect(m.walk(p.x, p.y)).toBe(true);
  });

  it('returns empty when no path exists', () => {
    const m = makeMap([
      '.#.',
      '.#.',
      '.#.',
    ]);
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, m.walk);
    expect(path).toEqual([]);
  });

  it('returns empty when goal is blocked', () => {
    const m = makeMap(['.#.']);
    const path = findPath({ x: 0, y: 0 }, { x: 1, y: 0 }, m.walk);
    expect(path).toEqual([]);
  });
});

describe('findPathToBump', () => {
  it('returns a path that ends at a non-walkable goal (the bump target)', () => {
    // Target at (2,0) is a wall. We should reach (1,0) and the path should append (2,0).
    const m = makeMap(['..#..']);
    const path = findPathToBump({ x: 0, y: 0 }, { x: 2, y: 0 }, m.walk);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    // The penultimate cell must be walkable — that's where the bumper actually stands.
    const second = path[path.length - 2]!;
    expect(m.walk(second.x, second.y)).toBe(true);
  });

  it('returns empty when no neighbour of the goal is reachable', () => {
    const m = makeMap([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    // (2,2) is walkable but fully walled in.
    const path = findPathToBump({ x: 0, y: 0 }, { x: 2, y: 2 }, m.walk);
    expect(path).toEqual([]);
  });
});
