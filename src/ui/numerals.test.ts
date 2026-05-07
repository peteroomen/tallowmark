import { describe, expect, it } from 'vitest';
import { toRoman } from './numerals';

describe('toRoman', () => {
  it('converts 1-10 correctly', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(3)).toBe('III');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(5)).toBe('V');
    expect(toRoman(6)).toBe('VI');
    expect(toRoman(7)).toBe('VII');
    expect(toRoman(8)).toBe('VIII');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(10)).toBe('X');
  });

  it('returns empty string for 0 and out-of-range', () => {
    expect(toRoman(0)).toBe('');
    expect(toRoman(-1)).toBe('');
    expect(toRoman(11)).toBe('');
    expect(toRoman(NaN)).toBe('');
    expect(toRoman(Infinity)).toBe('');
  });

  it('floors fractional values', () => {
    expect(toRoman(3.7)).toBe('III');
  });
});
