import type { Item } from './Item';

export interface InventorySlot {
  item: Item;
  count: number;
}

export class Inventory {
  private slots: InventorySlot[] = [];

  constructor(public readonly capacity: number = 16) {}

  get size(): number {
    return this.slots.length;
  }

  list(): readonly InventorySlot[] {
    return this.slots;
  }

  add(item: Item): boolean {
    if (item.stackable) {
      const existing = this.slots.find((s) => s.item.id === item.id);
      if (existing) {
        existing.count += 1;
        return true;
      }
    }
    if (this.slots.length >= this.capacity) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }

  removeAt(index: number): InventorySlot | null {
    const slot = this.slots[index];
    if (!slot) return null;
    if (slot.count > 1) {
      slot.count -= 1;
      return { item: slot.item, count: 1 };
    }
    this.slots.splice(index, 1);
    return { item: slot.item, count: 1 };
  }
}
