/**
 * Roman numeral conversion for Renown tiers (1–10). Used by the iter-3
 * Town Status strip and iter-7's Town Board. Pure function — kept in its
 * own module so tests can import it without pulling Phaser into jsdom.
 *
 * Returns empty string for 0 / NaN / out-of-range so callers can simply
 * concatenate without nullable checks.
 */
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 10) return '';
  const numerals: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
  };
  return numerals[Math.floor(n)] ?? '';
}
