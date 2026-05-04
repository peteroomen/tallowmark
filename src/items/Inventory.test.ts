import { describe, expect, it } from 'vitest';
import { Inventory } from './Inventory';
import type { Item } from './Item';

const potion = (): Item => ({
  id: 'potion_health',
  kind: 'potion',
  trueName: 'Potion of Healing',
  iconFrame: 0,
  stackable: true,
});

const sword = (): Item => ({
  id: 'sword_iron',
  kind: 'weapon',
  trueName: 'Iron Sword',
  iconFrame: 1,
  stackable: false,
});

describe('Inventory', () => {
  it('starts empty with the given capacity', () => {
    const inv = new Inventory(8);
    expect(inv.size).toBe(0);
    expect(inv.capacity).toBe(8);
  });

  it('stacks stackable items into one slot', () => {
    const inv = new Inventory();
    inv.add(potion());
    inv.add(potion());
    inv.add(potion());
    expect(inv.size).toBe(1);
    expect(inv.list()[0]!.count).toBe(3);
  });

  it('does not stack non-stackable items', () => {
    const inv = new Inventory();
    inv.add(sword());
    inv.add(sword());
    expect(inv.size).toBe(2);
  });

  it('rejects adds when at capacity', () => {
    const inv = new Inventory(2);
    expect(inv.add(sword())).toBe(true);
    expect(inv.add(sword())).toBe(true);
    expect(inv.add(sword())).toBe(false);
    expect(inv.size).toBe(2);
  });

  it('removeAt decrements stacks before removing the slot', () => {
    const inv = new Inventory();
    inv.add(potion());
    inv.add(potion());
    expect(inv.list()[0]!.count).toBe(2);
    inv.removeAt(0);
    expect(inv.list()[0]!.count).toBe(1);
    inv.removeAt(0);
    expect(inv.size).toBe(0);
  });

  it('removeAt returns null on bad index', () => {
    const inv = new Inventory();
    expect(inv.removeAt(0)).toBeNull();
  });
});
