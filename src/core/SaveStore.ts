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
    // Persistent schema bumped 1 → 2 in iter-3 stage 5b for the multi-resource
    // refactor. Schema 1 saves had `metaCurrency: number`; schema 2 saves have
    // `resources.embers: number`. The migration accepts either and produces
    // schema 2 — old players don't lose their banked Embers.
    const p = input as Omit<Partial<PersistentState>, 'schemaVersion'> & {
      schemaVersion?: number;
      metaCurrency?: number;
    };
    if (p.schemaVersion !== 1 && p.schemaVersion !== PERSISTENT_SCHEMA_VERSION) return def;
    const wallet =
      p.resources && typeof p.resources === 'object'
        ? {
            embers: typeof p.resources.embers === 'number' ? p.resources.embers : 0,
            ...(typeof p.resources.ore === 'number' ? { ore: p.resources.ore } : {}),
            ...(typeof p.resources.bone === 'number' ? { bone: p.resources.bone } : {}),
            ...(typeof p.resources.glass === 'number' ? { glass: p.resources.glass } : {}),
          }
        : { embers: typeof p.metaCurrency === 'number' ? p.metaCurrency : 0 };
    return {
      schemaVersion: PERSISTENT_SCHEMA_VERSION,
      resources: wallet,
      rescuedFounders: Array.isArray(p.rescuedFounders) ? p.rescuedFounders.filter((s) => typeof s === 'string') : [],
      unlockedItemPool: Array.isArray(p.unlockedItemPool)
        ? p.unlockedItemPool.filter((s) => typeof s === 'string')
        : [],
      townUpgrades: p.townUpgrades && typeof p.townUpgrades === 'object' ? { ...p.townUpgrades } : {},
      pendingStatuses: Array.isArray(p.pendingStatuses)
        ? p.pendingStatuses.filter(
            (s) => !!s && typeof s.id === 'string' && typeof s.turnsRemaining === 'number',
          )
        : [],
      audio: {
        master: clamp01(p.audio?.master, def.audio.master),
        music: clamp01(p.audio?.music, def.audio.music),
        sfx: clamp01(p.audio?.sfx, def.audio.sfx),
      },
      hasCompletedFirstRun: !!p.hasCompletedFirstRun,
      descentCount: typeof p.descentCount === 'number' ? p.descentCount : 0,
    };
  }

  private migrateRun(input: unknown): RunState | null {
    if (!input || typeof input !== 'object') return null;
    const r = input as Omit<Partial<RunState>, 'schemaVersion'> & { schemaVersion?: number };
    // Schema 1 → 2: introduce hunger / inventory / identifications /
    // activeStatuses. Old in-flight runs load with sensible defaults rather
    // than getting wiped — losing a run mid-floor to a schema bump would be
    // miserable. Newly-added fields can be undefined on the input.
    if (r.schemaVersion !== 1 && r.schemaVersion !== RUN_SCHEMA_VERSION) return null;
    return {
      ...r,
      schemaVersion: RUN_SCHEMA_VERSION,
      kills: r.kills ?? 0,
      exploredTiles: Array.isArray(r.exploredTiles) ? r.exploredTiles : [],
      food: typeof r.food === 'number' ? r.food : 200,
      foodMax: typeof r.foodMax === 'number' ? r.foodMax : 200,
      inventory: Array.isArray(r.inventory)
        ? r.inventory.filter(
            (s): s is { defId: string; count: number } =>
              !!s && typeof s.defId === 'string' && typeof s.count === 'number',
          )
        : [],
      identifications:
        r.identifications && typeof r.identifications === 'object'
          ? {
              labels:
                r.identifications.labels && typeof r.identifications.labels === 'object'
                  ? { ...r.identifications.labels }
                  : {},
              identified: Array.isArray(r.identifications.identified)
                ? r.identifications.identified.filter((s) => typeof s === 'string')
                : [],
            }
          : { labels: {}, identified: [] },
      activeStatuses: Array.isArray(r.activeStatuses)
        ? r.activeStatuses.filter(
            (s) => !!s && typeof s.id === 'string' && typeof s.turnsRemaining === 'number',
          )
        : [],
      traps: Array.isArray(r.traps)
        ? r.traps.filter(
            (t) =>
              !!t &&
              t.pos &&
              typeof t.pos.x === 'number' &&
              typeof t.pos.y === 'number' &&
              typeof t.kind === 'string' &&
              typeof t.revealed === 'boolean',
          )
        : [],
      floorDescriptor:
        typeof r.floorDescriptor === 'string' &&
        ['Quiet', 'Cramped', 'Open', 'Trapped', 'Hungry'].includes(r.floorDescriptor)
          ? r.floorDescriptor
          : 'Quiet',
      player: r.player
        ? {
            hp: typeof r.player.hp === 'number' ? r.player.hp : 20,
            hpMax: typeof r.player.hpMax === 'number' ? r.player.hpMax : 20,
            power: typeof r.player.power === 'number' ? r.player.power : 4,
            armor: typeof r.player.armor === 'number' ? r.player.armor : 1,
            perception:
              typeof r.player.perception === 'number' ? r.player.perception : 0.3,
          }
        : { hp: 20, hpMax: 20, power: 4, armor: 1, perception: 0.3 },
    } as RunState;
  }
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
}
