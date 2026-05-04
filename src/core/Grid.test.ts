import { describe, expect, it } from 'vitest';
import { Grid, chebyshev, pointEq, DIRS_8 } from './Grid';

describe('Grid', () => {
  it('fills with a constant', () => {
    const g = new Grid<number>(3, 2, 7);
    g.forEach((v) => expect(v).toBe(7));
  });

  it('fills via function', () => {
    const g = new Grid<string>(2, 2, (x, y) => `${x},${y}`);
    expect(g.get(0, 0)).toBe('0,0');
    expect(g.get(1, 1)).toBe('1,1');
  });

  it('rejects non-positive dimensions', () => {
    expect(() => new Grid(0, 5, 0)).toThrow(RangeError);
    expect(() => new Grid(5, -1, 0)).toThrow(RangeError);
  });

  it('reports inBounds correctly', () => {
    const g = new Grid<number>(4, 3, 0);
    expect(g.inBounds(0, 0)).toBe(true);
    expect(g.inBounds(3, 2)).toBe(true);
    expect(g.inBounds(4, 2)).toBe(false);
    expect(g.inBounds(-1, 0)).toBe(false);
  });

  it('throws on OOB access', () => {
    const g = new Grid<number>(2, 2, 0);
    expect(() => g.get(2, 0)).toThrow(RangeError);
    expect(() => g.set(0, 5, 1)).toThrow(RangeError);
  });

  it('set + get round-trips', () => {
    const g = new Grid<number>(3, 3, 0);
    g.set(2, 1, 42);
    expect(g.get(2, 1)).toBe(42);
    expect(g.get(0, 0)).toBe(0);
  });

  it('map produces a grid of the same shape with mapped values', () => {
    const a = new Grid<number>(3, 2, (x, y) => x + y);
    const b = a.map((v) => v * 10);
    expect(b.width).toBe(3);
    expect(b.height).toBe(2);
    expect(b.get(2, 1)).toBe(30);
  });
});

describe('grid helpers', () => {
  it('pointEq compares coords', () => {
    expect(pointEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(pointEq({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });

  it('chebyshev measures king-move distance', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
  });

  it('DIRS_8 has 8 unique unit-step neighbours', () => {
    expect(DIRS_8).toHaveLength(8);
    for (const d of DIRS_8) {
      expect(Math.max(Math.abs(d.x), Math.abs(d.y))).toBe(1);
      expect(d.x === 0 && d.y === 0).toBe(false);
    }
  });
});
