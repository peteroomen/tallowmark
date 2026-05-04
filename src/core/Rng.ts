import * as ROT from 'rot-js';

/**
 * Seeded random number generator. The single allowed source of randomness in the codebase.
 * Wraps rot.js's RNG with a small ergonomic surface.
 */
export class Rng {
  private constructor(private readonly impl: typeof ROT.RNG) {}

  /** Build a generator seeded by the given numeric seed. Same seed → same sequence, always. */
  static fromSeed(seed: number): Rng {
    const clone = ROT.RNG.clone();
    clone.setSeed(seed);
    return new Rng(clone);
  }

  /** Build a generator seeded from the current time. Use only when starting a brand-new run. */
  static fromTime(): Rng {
    return Rng.fromSeed(Date.now() ^ ((Math.random() * 0xffffffff) | 0));
  }

  /** Current seed — preserve this to reproduce a run later. */
  getSeed(): number {
    return this.impl.getSeed();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.impl.getUniform();
  }

  /** Inclusive integer in [min, max]. */
  intInclusive(min: number, max: number): number {
    if (max < min) throw new RangeError(`intInclusive: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Roll a "DnD-style" XdY: sum of `count` rolls of 1..sides. */
  roll(count: number, sides: number): number {
    if (count < 0 || sides < 1) throw new RangeError(`roll: bad inputs ${count}d${sides}`);
    let total = 0;
    for (let i = 0; i < count; i++) total += this.intInclusive(1, sides);
    return total;
  }

  /** Pick one element from an array. Throws if empty. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('pick: empty array');
    const v = arr[this.intInclusive(0, arr.length - 1)];
    return v as T;
  }

  /** Returns a new array containing the same elements in shuffled order. Does not mutate input. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.intInclusive(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
