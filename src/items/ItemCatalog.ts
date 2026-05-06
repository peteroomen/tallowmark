import { TilesRPG } from '@/world/FrameCatalog';
import type { Item, ItemKind } from './Item';

/**
 * Static catalog of every item type the game knows about. Items in inventories
 * are runtime `Item` objects produced from these defs by `makeItem(defId, …)`.
 *
 * Effects are *intent* descriptors — pure data. The actual effect resolution
 * lives in `UseEffects.ts`, which switches on `defId`. Keeping catalog and
 * resolver separate means the catalog is JSON-serialisable and trivially
 * testable, and adding a new item is a 2-line edit (catalog + resolver branch).
 */

export type PotionEffect = 'healing' | 'fortitude' | 'poison';
export type ScrollEffect = 'mapping' | 'blinking' | 'identification';

export interface ItemDef {
  id: string;
  kind: ItemKind;
  trueName: string;
  iconFrame: number;
  stackable: boolean;
  description: string;
  /** True for items whose true identity is hidden until identified (potions/scrolls). */
  needsIdentification: boolean;
  /**
   * Spawn weight for procedural placement. Higher = more common. 0 means
   * "never spawns naturally" (e.g. starting kit only).
   */
  spawnWeight: number;
  /** First floor on which this can spawn. Defaults to 1. */
  minFloor?: number;
}

export const ITEM_CATALOG: Record<string, ItemDef> = {
  // ----- Potions (3) -----
  potion_healing: {
    id: 'potion_healing',
    kind: 'potion',
    trueName: 'Potion of Healing',
    iconFrame: TilesRPG.potionRed,
    stackable: true,
    description: 'Restores 25% of your max HP when drunk.',
    needsIdentification: true,
    spawnWeight: 8,
  },
  potion_fortitude: {
    id: 'potion_fortitude',
    kind: 'potion',
    trueName: 'Potion of Fortitude',
    iconFrame: TilesRPG.potionBlue,
    stackable: true,
    description: 'Grants +2 Armor for 20 turns.',
    needsIdentification: true,
    spawnWeight: 5,
  },
  potion_poison: {
    id: 'potion_poison',
    kind: 'potion',
    trueName: 'Potion of Poison',
    iconFrame: TilesRPG.potionBlue,
    stackable: true,
    description: 'Tastes vile. Inflicts Poisoned for 5 turns.',
    needsIdentification: true,
    spawnWeight: 3,
  },

  // ----- Scrolls (3) -----
  scroll_mapping: {
    id: 'scroll_mapping',
    kind: 'scroll',
    trueName: 'Scroll of Mapping',
    iconFrame: TilesRPG.scroll,
    stackable: true,
    description: 'Reveals every wall and trap on this floor.',
    needsIdentification: true,
    spawnWeight: 5,
  },
  scroll_blinking: {
    id: 'scroll_blinking',
    kind: 'scroll',
    trueName: 'Scroll of Blinking',
    iconFrame: TilesRPG.scroll,
    stackable: true,
    description: 'Teleports you to a random visible tile.',
    needsIdentification: true,
    spawnWeight: 4,
  },
  scroll_identification: {
    id: 'scroll_identification',
    kind: 'scroll',
    trueName: 'Scroll of Identification',
    iconFrame: TilesRPG.scroll,
    stackable: true,
    description: 'Identifies one unidentified item type.',
    needsIdentification: true,
    spawnWeight: 4,
  },

  // ----- Food + Rune (2) -----
  food_hardtack: {
    id: 'food_hardtack',
    kind: 'food',
    trueName: 'Hardtack',
    iconFrame: TilesRPG.coin, // TODO: dedicated bread frame
    stackable: true,
    description: 'Stale but filling. Restores 80 food.',
    needsIdentification: false,
    spawnWeight: 6,
  },
  rune_ember: {
    id: 'rune_ember',
    kind: 'misc',
    trueName: 'Ember Rune',
    iconFrame: TilesRPG.coin,
    stackable: true,
    description: 'A glowing shard. Worth 10–20 Embers when carried out alive.',
    needsIdentification: false,
    spawnWeight: 4,
    minFloor: 2,
  },
};

export const ALL_DEF_IDS: ReadonlyArray<string> = Object.keys(ITEM_CATALOG);

export function getItemDef(defId: string): ItemDef | undefined {
  return ITEM_CATALOG[defId];
}

/** Construct a runtime Item from a catalog def. */
export function makeItem(defId: string): Item {
  const def = ITEM_CATALOG[defId];
  if (!def) throw new Error(`Unknown item def: ${defId}`);
  return {
    id: def.id,
    kind: def.kind,
    trueName: def.trueName,
    iconFrame: def.iconFrame,
    stackable: def.stackable,
    description: def.description,
  };
}
