import { describe, expect, it } from 'vitest';
import {
  hasAnyVerb,
  resolveSlots,
  resolveVerbForKey,
  resolveVerbForNumericKey,
  slotCount,
} from './Resolver';
import type { Target } from './Targets';

describe('resolveSlots', () => {
  it('self target — wait + search + inventory + character (4 verbs)', () => {
    const slots = resolveSlots({ kind: 'self' });
    expect(slots[0]).toBe('wait');
    expect(slots[1]).toBe('search');
    expect(slots[2]).toBe('open_inventory');
    expect(slots[3]).toBe('open_character');
    expect(slots[4]).toBeNull();
    expect(slots[5]).toBeNull();
    expect(slotCount(slots)).toBe(4);
  });

  it('floor tile — walk_to + search + examine', () => {
    const slots = resolveSlots({ kind: 'floor_tile', pos: { x: 0, y: 0 } });
    expect(slots[0]).toBe('walk_to');
    expect(slots[1]).toBe('search');
    expect(slots[2]).toBe('examine');
    expect(slotCount(slots)).toBe(3);
  });

  it('enemy — attack + examine', () => {
    const slots = resolveSlots({ kind: 'enemy', pos: { x: 1, y: 1 }, enemyId: 1 });
    expect(slots[0]).toBe('attack');
    expect(slots[1]).toBe('examine');
    expect(slotCount(slots)).toBe(2);
  });

  it('item on floor — pick_up + examine + step_over', () => {
    const slots = resolveSlots({
      kind: 'item_on_floor',
      pos: { x: 0, y: 0 },
      defId: 'potion_healing',
    });
    expect(slots[0]).toBe('pick_up');
    expect(slots[1]).toBe('examine');
    expect(slots[2]).toBe('step_over');
  });

  it('item in bag — use + drop + examine', () => {
    const slots = resolveSlots({ kind: 'item_in_bag', slotIndex: 0, defId: 'potion_healing' });
    expect(slots[0]).toBe('use');
    expect(slots[1]).toBe('drop');
    expect(slots[2]).toBe('examine');
  });

  it('stairs down — descend at 12 o\'clock + examine', () => {
    const slots = resolveSlots({ kind: 'stairs', direction: 'down', pos: { x: 0, y: 0 } });
    expect(slots[0]).toBe('descend');
    expect(slots[2]).toBe('examine');
  });

  it('stairs up — climb at 12 o\'clock + examine', () => {
    const slots = resolveSlots({ kind: 'stairs', direction: 'up', pos: { x: 0, y: 0 } });
    expect(slots[0]).toBe('climb');
    expect(slots[2]).toBe('examine');
  });

  it('trap — step_over (primary) + disarm + examine', () => {
    const slots = resolveSlots({ kind: 'trap', pos: { x: 0, y: 0 }, trapKind: 'spike' });
    expect(slots[0]).toBe('step_over');
    expect(slots[1]).toBe('disarm');
    expect(slots[2]).toBe('examine');
  });

  it('wall — no verbs', () => {
    const slots = resolveSlots({ kind: 'wall', pos: { x: 0, y: 0 } });
    for (const s of slots) expect(s).toBeNull();
    expect(slotCount(slots)).toBe(0);
    expect(hasAnyVerb(slots)).toBe(false);
  });
});

describe('resolveVerbForKey', () => {
  const self: Target = { kind: 'self' };
  const enemy: Target = { kind: 'enemy', pos: { x: 0, y: 0 }, enemyId: 1 };

  it('"." on self → wait', () => {
    expect(resolveVerbForKey(self, '.')).toBe('wait');
  });

  it('"q" on self → search', () => {
    expect(resolveVerbForKey(self, 'q')).toBe('search');
  });

  it('"i" on self → open_inventory', () => {
    expect(resolveVerbForKey(self, 'i')).toBe('open_inventory');
  });

  it('case-insensitive', () => {
    expect(resolveVerbForKey(self, 'I')).toBe('open_inventory');
  });

  it('"u" on enemy → null (Use is not on the enemy wheel)', () => {
    expect(resolveVerbForKey(enemy, 'u')).toBeNull();
  });

  it('unknown key returns null', () => {
    expect(resolveVerbForKey(self, 'x')).toBeNull();
    expect(resolveVerbForKey(self, '')).toBeNull();
  });
});

describe('resolveVerbForNumericKey', () => {
  const self: Target = { kind: 'self' };
  it('1 on self → wait (12 o\'clock = primary)', () => {
    expect(resolveVerbForNumericKey(self, 1)).toBe('wait');
  });
  it('2 on self → search', () => {
    expect(resolveVerbForNumericKey(self, 2)).toBe('search');
  });
  it('5 on self → null (empty slot)', () => {
    expect(resolveVerbForNumericKey(self, 5)).toBeNull();
  });
  it('out of range → null', () => {
    expect(resolveVerbForNumericKey(self, 0)).toBeNull();
    expect(resolveVerbForNumericKey(self, 7)).toBeNull();
    expect(resolveVerbForNumericKey(self, -1)).toBeNull();
  });
});
