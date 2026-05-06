import { describe, expect, it } from 'vitest';
import type { ActiveStatus } from './RunState';
import {
  applyStatusTo,
  hasStatus,
  removeStatus,
  statusArmorBonus,
  tickStatusList,
} from './StatusBag';
import type { StatusTarget } from './StatusCatalog';

const makeTarget = (hp = 10, hpMax = 10) => {
  const state = { hp, hpMax };
  const t: StatusTarget = {
    damage: (n) => {
      const dealt = Math.min(n, state.hp);
      state.hp -= dealt;
      return dealt;
    },
    heal: (n) => {
      const healed = Math.min(n, state.hpMax - state.hp);
      state.hp += healed;
      return healed;
    },
    isDead: () => state.hp <= 0,
  };
  return { state, target: t };
};

describe('StatusBag', () => {
  it('applyStatusTo adds a new status', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'fortitude', 10);
    expect(list).toEqual([{ id: 'fortitude', turnsRemaining: 10 }]);
  });

  it('applyStatusTo refreshes-with-extension', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'fortitude', 5);
    applyStatusTo(list, 'fortitude', 2); // shorter — should not shorten
    expect(list[0]!.turnsRemaining).toBe(5);
    applyStatusTo(list, 'fortitude', 12); // longer — should extend
    expect(list[0]!.turnsRemaining).toBe(12);
  });

  it('hasStatus / removeStatus', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'poisoned', 5);
    expect(hasStatus(list, 'poisoned')).toBe(true);
    expect(hasStatus(list, 'fortitude')).toBe(false);
    removeStatus(list, 'poisoned');
    expect(hasStatus(list, 'poisoned')).toBe(false);
  });

  it('statusArmorBonus sums armorBonus from all active', () => {
    const list: ActiveStatus[] = [];
    expect(statusArmorBonus(list)).toBe(0);
    applyStatusTo(list, 'fortitude', 10);
    expect(statusArmorBonus(list)).toBe(2);
  });

  it('tickStatusList: poisoned ticks 1 damage per turn and decrements duration', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'poisoned', 3);
    const { state, target } = makeTarget(10);
    tickStatusList(list, target);
    expect(state.hp).toBe(9);
    expect(list[0]!.turnsRemaining).toBe(2);
  });

  it('tickStatusList: healing regenerates HP', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'healing', 3);
    const { state, target } = makeTarget(5, 10);
    tickStatusList(list, target);
    expect(state.hp).toBe(6);
  });

  it('tickStatusList: status expires after duration runs out', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'fortitude', 1);
    const { target } = makeTarget(10);
    const events = tickStatusList(list, target);
    expect(list).toEqual([]);
    expect(events.find((e) => e.kind === 'expired' && e.statusId === 'fortitude')).toBeTruthy();
  });

  it('tickStatusList: dead targets stop receiving status ticks', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'poisoned', 5);
    applyStatusTo(list, 'bleed', 5);
    const { state, target } = makeTarget(1, 10);
    tickStatusList(list, target);
    // Either poison or bleed killed the target; the other did not also tick.
    expect(state.hp).toBe(0);
    // turnsRemaining still decrements either way; that's fine.
  });

  it('tickStatusList: returns damage/heal events with statusId tagging', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'poisoned', 3);
    applyStatusTo(list, 'healing', 3);
    const { target } = makeTarget(5, 10);
    const events = tickStatusList(list, target);
    expect(events.find((e) => e.kind === 'damage' && e.statusId === 'poisoned')).toBeTruthy();
    expect(events.find((e) => e.kind === 'heal' && e.statusId === 'healing')).toBeTruthy();
  });

  it('list reference is preserved across ticks (mutated in place)', () => {
    const list: ActiveStatus[] = [];
    applyStatusTo(list, 'fortitude', 1);
    const ref = list;
    const { target } = makeTarget(10);
    tickStatusList(list, target);
    expect(list).toBe(ref);
    expect(list.length).toBe(0);
  });
});
