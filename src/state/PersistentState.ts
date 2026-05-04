/**
 * Game state that survives death. Shaped for JSON serialization (no class instances).
 * Bumping the schema version triggers a migration in SaveStore.
 */

export const PERSISTENT_SCHEMA_VERSION = 1;

export interface AudioSettings {
  master: number; // 0..1
  music: number; // 0..1
  sfx: number; // 0..1
}

export interface PersistentState {
  schemaVersion: typeof PERSISTENT_SCHEMA_VERSION;
  metaCurrency: number;
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
    metaCurrency: 0,
    rescuedFounders: [],
    unlockedItemPool: [],
    townUpgrades: {},
    audio: { master: 0.8, music: 0.6, sfx: 0.8 },
    hasCompletedFirstRun: false,
  };
}
