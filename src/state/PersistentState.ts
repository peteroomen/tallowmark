/**
 * Game state that survives death. Shaped for JSON serialization (no class instances).
 * Bumping the schema version triggers a migration in SaveStore.
 */

export const PERSISTENT_SCHEMA_VERSION = 2;

export interface AudioSettings {
  master: number; // 0..1
  music: number; // 0..1
  sfx: number; // 0..1
}

/**
 * Multi-resource economy. `embers` is the universal currency every biome
 * drops (think gold). Other resources are biome-specific drops gating
 * biome-specific upgrades — schema-reserved as optional now so adding
 * new biomes in iter-7 doesn't bump the schema again.
 */
export interface ResourceWallet {
  embers: number;
  /** Sunken Mines drops, Engineer's gear upgrades — iter 7. */
  ore?: number;
  /** Catacombs drops, Necromancer's bone armor — iter 7. */
  bone?: number;
  /** Glass Halls drops, Seer's mirror items — iter 7. */
  glass?: number;
}

export interface PersistentState {
  schemaVersion: typeof PERSISTENT_SCHEMA_VERSION;
  /**
   * Multi-resource wallet (per refinement-002 + iter-3 stage 5b spec).
   * Replaces the iter-1 `metaCurrency: number`. Migration in SaveStore
   * promotes the old number to `resources.embers`.
   */
  resources: ResourceWallet;
  /** Names of NPC specialists rescued from the dungeon and now living in town. */
  rescuedFounders: string[];
  /** Spell/scroll/potion ids unlocked across all runs (drop-pool entries). */
  unlockedItemPool: string[];
  /** Town-side upgrade levels keyed by upgrade id. */
  townUpgrades: Record<string, number>;
  audio: AudioSettings;
  /** True after a player has finished at least one full run. Used for menu state. */
  hasCompletedFirstRun: boolean;
}

export function defaultPersistentState(): PersistentState {
  return {
    schemaVersion: PERSISTENT_SCHEMA_VERSION,
    resources: { embers: 0 },
    rescuedFounders: [],
    unlockedItemPool: [],
    townUpgrades: {},
    audio: { master: 0.8, music: 0.6, sfx: 0.8 },
    hasCompletedFirstRun: false,
  };
}
