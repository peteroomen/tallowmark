/** A coordinate on the discrete game grid. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Cardinal + diagonal neighbour offsets, in 8 directions. */
export const DIRS_8: readonly Point[] = Object.freeze([
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
]);

export function pointEq(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * A typed 2D grid backed by a flat array. Pure data — no rendering.
 * `T` is the cell value; the grid is fully-populated (no holes).
 */
export class Grid<T> {
  private readonly cells: T[];

  constructor(
    public readonly width: number,
    public readonly height: number,
    fill: T | ((x: number, y: number) => T),
  ) {
    if (width <= 0 || height <= 0) throw new RangeError('Grid dimensions must be positive');
    this.cells = new Array(width * height);
    if (typeof fill === 'function') {
      const f = fill as (x: number, y: number) => T;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          this.cells[y * width + x] = f(x, y);
        }
      }
    } else {
      this.cells.fill(fill);
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): T {
    if (!this.inBounds(x, y)) throw new RangeError(`Grid.get OOB at ${x},${y}`);
    return this.cells[y * this.width + x] as T;
  }

  set(x: number, y: number, value: T): void {
    if (!this.inBounds(x, y)) throw new RangeError(`Grid.set OOB at ${x},${y}`);
    this.cells[y * this.width + x] = value;
  }

  /** Iterate every cell. */
  forEach(fn: (value: T, x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(this.cells[y * this.width + x] as T, x, y);
      }
    }
  }

  /** Map to a new grid of a different cell type. */
  map<U>(fn: (value: T, x: number, y: number) => U): Grid<U> {
    return new Grid<U>(this.width, this.height, (x, y) => fn(this.get(x, y), x, y));
  }
}
