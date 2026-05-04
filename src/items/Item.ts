/**
 * Item data model. v1 implements only the interfaces and a stub potion;
 * the identification, runes, and scroll libraries land in iterations 2–4.
 */

export type ItemKind = 'potion' | 'scroll' | 'weapon' | 'armor' | 'food' | 'misc';

export interface Item {
  id: string;
  kind: ItemKind;
  /** True name. UIs should display `Inventory.displayName(item)` instead of this directly. */
  trueName: string;
  /** Sprite frame index in the RPG spritesheet. */
  iconFrame: number;
  stackable: boolean;
  description?: string;
}
