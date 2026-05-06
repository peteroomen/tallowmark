import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/Rng';
import { newRunState } from '@/state/RunState';
import { buildIdentifications } from './Identification';
import { applyIdentifyTo, useItem } from './UseEffects';

const rng = Rng.fromSeed(42);

const setup = () => {
  const state = newRunState(1, { x: 0, y: 0 }, buildIdentifications(Rng.fromSeed(1)));
  state.inventory = [];
  return state;
};

describe('useItem', () => {
  it('healing potion applies the regen status and identifies the def', () => {
    const s = setup();
    s.inventory.push({ defId: 'potion_healing', count: 1 });
    const r = useItem(s, 0, rng);
    expect(r.consumed).toBe(true);
    expect(s.activeStatuses.find((st) => st.id === 'healing')).toBeTruthy();
    expect(r.intents.find((i) => i.kind === 'applyStatus' && i.statusId === 'healing')).toBeTruthy();
    expect(s.identifications.identified).toContain('potion_healing');
  });

  it('fortitude potion applies the +armor status', () => {
    const s = setup();
    s.inventory.push({ defId: 'potion_fortitude', count: 1 });
    useItem(s, 0, rng);
    expect(s.activeStatuses.find((st) => st.id === 'fortitude')).toBeTruthy();
  });

  it('poison potion applies the poisoned status', () => {
    const s = setup();
    s.inventory.push({ defId: 'potion_poison', count: 1 });
    useItem(s, 0, rng);
    expect(s.activeStatuses.find((st) => st.id === 'poisoned')).toBeTruthy();
  });

  it('mapping scroll emits a revealFloor intent', () => {
    const s = setup();
    s.inventory.push({ defId: 'scroll_mapping', count: 1 });
    const r = useItem(s, 0, rng);
    expect(r.intents.find((i) => i.kind === 'revealFloor')).toBeTruthy();
    expect(r.consumed).toBe(true);
  });

  it('identification scroll opens picker but does NOT consume the scroll', () => {
    const s = setup();
    s.inventory.push({ defId: 'scroll_identification', count: 1 });
    const r = useItem(s, 0, rng);
    expect(r.intents.find((i) => i.kind === 'identifyPicker')).toBeTruthy();
    expect(r.consumed).toBe(false);
  });

  it('hardtack emits an eat intent capped at foodMax', () => {
    const s = setup();
    s.food = s.foodMax - 30; // only 30 missing
    s.inventory.push({ defId: 'food_hardtack', count: 1 });
    const r = useItem(s, 0, rng);
    const eat = r.intents.find((i) => i.kind === 'eat');
    expect(eat).toBeTruthy();
    if (eat?.kind === 'eat') expect(eat.food).toBe(30);
  });

  it('ember rune emits an embers intent of 10..20', () => {
    const s = setup();
    s.inventory.push({ defId: 'rune_ember', count: 1 });
    const r = useItem(s, 0, rng);
    const ember = r.intents.find((i) => i.kind === 'embers');
    expect(ember).toBeTruthy();
    if (ember?.kind === 'embers') {
      expect(ember.amount).toBeGreaterThanOrEqual(10);
      expect(ember.amount).toBeLessThanOrEqual(20);
    }
  });

  it('using an empty slot is a no-op', () => {
    const s = setup();
    const r = useItem(s, 0, rng);
    expect(r.consumed).toBe(false);
  });
});

describe('applyIdentifyTo', () => {
  it('marks an unidentified def as identified', () => {
    const s = setup();
    expect(applyIdentifyTo(s, 'potion_healing')).toBe(true);
    expect(s.identifications.identified).toContain('potion_healing');
  });

  it('returns false for already-identified defs', () => {
    const s = setup();
    applyIdentifyTo(s, 'potion_healing');
    expect(applyIdentifyTo(s, 'potion_healing')).toBe(false);
  });

  it('returns false for items that do not need identification', () => {
    const s = setup();
    expect(applyIdentifyTo(s, 'food_hardtack')).toBe(false);
  });
});
