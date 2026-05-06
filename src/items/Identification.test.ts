import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/Rng';
import { ITEM_CATALOG } from './ItemCatalog';
import {
  buildIdentifications,
  displayName,
  isIdentified,
  markIdentified,
} from './Identification';

describe('Identification', () => {
  it('assigns a label to every potion + scroll def that needs identification', () => {
    const ids = buildIdentifications(Rng.fromSeed(42));
    for (const def of Object.values(ITEM_CATALOG)) {
      if (def.needsIdentification) {
        expect(ids.labels[def.id]).toBeTypeOf('string');
        expect(ids.labels[def.id]!.length).toBeGreaterThan(0);
      }
    }
    expect(ids.identified).toEqual([]);
  });

  it('produces the same labels for the same seed', () => {
    const a = buildIdentifications(Rng.fromSeed(123));
    const b = buildIdentifications(Rng.fromSeed(123));
    expect(a).toEqual(b);
  });

  it('produces different labels for different seeds', () => {
    const a = buildIdentifications(Rng.fromSeed(1));
    const b = buildIdentifications(Rng.fromSeed(2));
    expect(a).not.toEqual(b);
  });

  it('displayName returns the label until identified, then trueName', () => {
    const ids = buildIdentifications(Rng.fromSeed(42));
    const def = ITEM_CATALOG['potion_healing']!;
    expect(isIdentified(ids, def)).toBe(false);
    expect(displayName(ids, def)).toBe(ids.labels[def.id]);
    markIdentified(ids, def.id);
    expect(isIdentified(ids, def)).toBe(true);
    expect(displayName(ids, def)).toBe(def.trueName);
  });

  it('always-identified items return trueName regardless of state', () => {
    const ids = buildIdentifications(Rng.fromSeed(42));
    const def = ITEM_CATALOG['food_hardtack']!;
    expect(isIdentified(ids, def)).toBe(true);
    expect(displayName(ids, def)).toBe(def.trueName);
  });

  it('markIdentified is idempotent', () => {
    const ids = buildIdentifications(Rng.fromSeed(42));
    markIdentified(ids, 'potion_healing');
    markIdentified(ids, 'potion_healing');
    expect(ids.identified.filter((id) => id === 'potion_healing')).toHaveLength(1);
  });
});
