import { describe, expect, it } from 'vitest';
import { Rng } from './Rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('intInclusive stays within bounds', () => {
    const r = Rng.fromSeed(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.intInclusive(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('intInclusive throws when max < min', () => {
    const r = Rng.fromSeed(1);
    expect(() => r.intInclusive(5, 3)).toThrow(RangeError);
  });

  it('roll(N, sides) is bounded by N..N*sides', () => {
    const r = Rng.fromSeed(99);
    for (let i = 0; i < 500; i++) {
      const v = r.roll(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(18);
    }
  });

  it('pick returns an element from the array', () => {
    const r = Rng.fromSeed(11);
    const arr = ['a', 'b', 'c', 'd'] as const;
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it('pick throws on empty array', () => {
    const r = Rng.fromSeed(1);
    expect(() => r.pick([])).toThrow(RangeError);
  });

  it('shuffle preserves multiset and does not mutate input', () => {
    const r = Rng.fromSeed(123);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(input);
    expect(out.slice().sort()).toEqual(input.slice().sort());
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('chance(0) is always false; chance(1) is always true', () => {
    const r = Rng.fromSeed(5);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
