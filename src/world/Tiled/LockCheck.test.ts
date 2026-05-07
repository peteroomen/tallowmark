import { describe, expect, it } from 'vitest';
import { isMet, type LockCheckContext } from './LockCheck';

const ctx = (overrides: Partial<LockCheckContext> = {}): LockCheckContext => ({
  rescuedFounders: [],
  inventoryDefIds: [],
  renown: 0,
  unlockedFeats: [],
  ...overrides,
});

describe('LockCheck.isMet', () => {
  it('null / empty / "none" condition is always met', () => {
    expect(isMet(null, ctx())).toBe(true);
    expect(isMet(undefined, ctx())).toBe(true);
    expect(isMet('', ctx())).toBe(true);
    expect(isMet('none', ctx())).toBe(true);
  });

  it('founder: passes when founder is rescued', () => {
    expect(isMet('founder:Apothecary', ctx({ rescuedFounders: ['Apothecary'] }))).toBe(true);
    expect(isMet('founder:Apothecary', ctx({ rescuedFounders: [] }))).toBe(false);
    expect(isMet('founder:Apothecary', ctx({ rescuedFounders: ['Blacksmith'] }))).toBe(false);
  });

  it('item: passes when item is in inventory', () => {
    expect(isMet('item:iron_key', ctx({ inventoryDefIds: ['iron_key'] }))).toBe(true);
    expect(isMet('item:iron_key', ctx({ inventoryDefIds: ['food_hardtack'] }))).toBe(false);
  });

  it('renown: passes when renown >= required', () => {
    expect(isMet('renown:3', ctx({ renown: 3 }))).toBe(true);
    expect(isMet('renown:3', ctx({ renown: 5 }))).toBe(true);
    expect(isMet('renown:3', ctx({ renown: 2 }))).toBe(false);
    expect(isMet('renown:3', ctx({ renown: 0 }))).toBe(false);
    expect(isMet('renown:3', ctx())).toBe(false); // renown defaults to 0
  });

  it('renown: gracefully fails on non-numeric value', () => {
    expect(isMet('renown:abc', ctx({ renown: 99 }))).toBe(false);
  });

  it('feat: passes when feat is unlocked', () => {
    expect(isMet('feat:identify_100', ctx({ unlockedFeats: ['identify_100'] }))).toBe(true);
    expect(isMet('feat:identify_100', ctx({ unlockedFeats: [] }))).toBe(false);
    expect(isMet('feat:identify_100', ctx())).toBe(false); // defaults
  });

  it('unknown kind is treated as locked (fail-closed)', () => {
    expect(isMet('weird:thing', ctx())).toBe(false);
  });

  it('malformed condition (no colon) is locked', () => {
    expect(isMet('justbad', ctx())).toBe(false);
  });
});
