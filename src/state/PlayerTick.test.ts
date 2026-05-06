import { describe, expect, it } from 'vitest';
import { newRunState } from './RunState';
import {
  applyStatus,
  STARVATION_INTERVAL,
  STARVATION_THRESHOLD,
  statusArmorBonus,
  tickHunger,
  tickStatuses,
} from './PlayerTick';

describe('tickHunger', () => {
  it('decrements food by 1 each tick', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    const start = r.food;
    tickHunger(r);
    expect(r.food).toBe(start - 1);
  });

  it('emits hungerDanger when food crosses the threshold', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    r.food = STARVATION_THRESHOLD + 1;
    const evs = tickHunger(r);
    expect(evs.some((e) => e.kind === 'hungerDanger')).toBe(true);
  });

  it('applies 1 damage every STARVATION_INTERVAL turns at 0 food', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    r.food = 0;
    r.turn = STARVATION_INTERVAL; // multiple of interval
    const before = r.player.hp;
    const evs = tickHunger(r);
    expect(r.player.hp).toBe(before - 1);
    expect(evs.find((e) => e.kind === 'starvationDamage')?.damage).toBe(1);
  });

  it('does not damage on every turn at 0 food', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    r.food = 0;
    r.turn = STARVATION_INTERVAL + 1; // not a multiple
    const before = r.player.hp;
    tickHunger(r);
    expect(r.player.hp).toBe(before);
  });
});

describe('tickStatuses', () => {
  it('decrements turnsRemaining and removes expired statuses', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    applyStatus(r, 'fortitude', 1);
    tickStatuses(r);
    expect(r.activeStatuses).toEqual([]);
  });

  it('emits statusExpired when a status drops off', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    applyStatus(r, 'fortitude', 1);
    const evs = tickStatuses(r);
    expect(evs.find((e) => e.kind === 'statusExpired' && e.statusId === 'fortitude')).toBeTruthy();
  });

  it('poisoned ticks 1 damage per turn', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    applyStatus(r, 'poisoned', 3);
    const before = r.player.hp;
    tickStatuses(r);
    expect(r.player.hp).toBe(before - 1);
  });

  it('refresh-with-extension keeps the longer remaining duration', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    applyStatus(r, 'fortitude', 5);
    applyStatus(r, 'fortitude', 2); // shorter — should not shorten
    expect(r.activeStatuses[0]!.turnsRemaining).toBe(5);
    applyStatus(r, 'fortitude', 10); // longer — should extend
    expect(r.activeStatuses[0]!.turnsRemaining).toBe(10);
  });
});

describe('statusArmorBonus', () => {
  it('sums fortitude into +2 armor', () => {
    const r = newRunState(1, { x: 0, y: 0 });
    expect(statusArmorBonus(r)).toBe(0);
    applyStatus(r, 'fortitude', 20);
    expect(statusArmorBonus(r)).toBe(2);
  });
});
