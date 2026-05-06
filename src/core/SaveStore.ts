import { SAVE_KEY } from '@/config';
import {
  defaultPersistentState,
  PERSISTENT_SCHEMA_VERSION,
  type PersistentState,
} from '@/state/PersistentState';
import { RUN_SCHEMA_VERSION, type RunState } from '@/state/RunState';

interface SaveBlob {
  persistent: PersistentState;
  run: RunState | null;
}

/**
 * The only module allowed to touch localStorage. Versioned blob with two halves:
 *   - persistent: survives death
 *   - run:        wiped when run ends
 *
 * Reads are tolerant: a corrupt or missing save returns defaults; future schema
 * migrations are added by version-checking and transforming the blob in place.
 */
export class SaveStore {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  loadPersistent(): PersistentState {
    const blob = this.readBlob();
    return blob?.persistent ?? defaultPersistentState();
  }

  savePersistent(state: PersistentState): void {
    const existing = this.readBlob() ?? { persistent: defaultPersistentState(), run: null };
    existing.persistent = state;
    this.writeBlob(existing);
  }

  loadRun(): RunState | null {
    const blob = this.readBlob();
    return blob?.run ?? null;
  }

  saveRun(state: RunState | null): void {
    const existing = this.readBlob() ?? { persistent: defaultPersistentState(), run: null };
    existing.run = state;
    this.writeBlob(existing);
  }

  /** Wipe the in-progress run (e.g. on death). Persistent state is preserved. */
  clearRun(): void {
    this.saveRun(null);
  }

  /** Nuclear: wipe everything. Used by Settings → "reset save". */
  clearAll(): void {
    this.storage.removeItem(SAVE_KEY);
  }

  private readBlob(): SaveBlob | null {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SaveBlob>;
      if (!parsed || typeof parsed !== 'object') return null;
      const persistent = this.migratePersistent(parsed.persistent);
      const run = this.migrateRun(parsed.run ?? null);
      return { persistent, run };
    } catch {
      return null;
    }
  }

  private writeBlob(blob: SaveBlob): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(blob));
  }

  private migratePersistent(input: unknown): PersistentState {
    const def = defaultPersistentState();
    if (!input || typeof input !== 'object') return def;
    const p = input as Partial<PersistentState>;
    if (p.schemaVersion !== PERSISTENT_SCHEMA_VERSION) return def;
    return {
      schemaVersion: PERSISTENT_SCHEMA_VERSION,
      metaCurrency: typeof p.metaCurrency === 'number' ? p.metaCurrency : 0,
      rescuedFounders: Array.isArray(p.rescuedFounders) ? p.rescuedFounders.filter((s) => typeof s === 'string') : [],
      unlockedItemPool: Array.isArray(p.unlockedItemPool)
        ? p.unlockedItemPool.filter((s) => typeof s === 'string')
        : [],
      townUpgrades: p.townUpgrades && typeof p.townUpgrades === 'object' ? { ...p.townUpgrades } : {},
      audio: {
        master: clamp01(p.audio?.master, def.audio.master),
        music: clamp01(p.audio?.music, def.audio.music),
        sfx: clamp01(p.audio?.sfx, def.audio.sfx),
      },
      hasCompletedFirstRun: !!p.hasCompletedFirstRun,
    };
  }

  private migrateRun(input: unknown): RunState | null {
    if (!input || typeof input !== 'object') return null;
    const r = input as Partial<RunState>;
    if (r.schemaVersion !== RUN_SCHEMA_VERSION) return null;
    // Default newly-added fields so older in-flight saves load cleanly.
    return {
      ...r,
      kills: r.kills ?? 0,
      exploredTiles: Array.isArray(r.exploredTiles) ? r.exploredTiles : [],
    } as RunState;
  }
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
}
