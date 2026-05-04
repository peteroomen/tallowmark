import type { Item } from './Item';

export type EquipmentSlot = 'weapon' | 'armor' | 'offhand' | 'amulet' | 'ring';

export class Equipment {
  private readonly slots = new Map<EquipmentSlot, Item>();

  get(slot: EquipmentSlot): Item | undefined {
    return this.slots.get(slot);
  }

  equip(slot: EquipmentSlot, item: Item): Item | undefined {
    const previous = this.slots.get(slot);
    this.slots.set(slot, item);
    return previous;
  }

  unequip(slot: EquipmentSlot): Item | undefined {
    const previous = this.slots.get(slot);
    this.slots.delete(slot);
    return previous;
  }

  entries(): Array<[EquipmentSlot, Item]> {
    return Array.from(this.slots.entries());
  }
}
