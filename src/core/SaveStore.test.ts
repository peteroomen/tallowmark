import { beforeEach, describe, expect, it } from 'vitest';
import { SaveStore } from './SaveStore';
import { defaultPersistentState } from '@/state/PersistentState';
import { newRunState } from '@/state/RunState';
import { SAVE_KEY } from '@/config';

class MemStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('SaveStore', () => {
  let storage: MemStorage;
  let store: SaveStore;

  beforeEach(() => {
    storage = new MemStorage();
    store = new SaveStore(storage);
  });

  it('returns defaults when nothing is saved', () => {
    const p = store.loadPersistent();
    expect(p).toEqual(defaultPersistentState());
    expect(store.loadRun()).toBeNull();
  });

  it('round-trips persistent state', () => {
    const p = defaultPersistentState();
    p.resources.embers = 250;
    p.rescuedFounders.push('Apothecary');
    store.savePersistent(p);
    expect(store.loadPersistent()).toEqual(p);
  });

  it('persistent and run are stored independently in the same blob', () => {
    const p = defaultPersistentState();
    p.resources.embers = 99;
    store.savePersistent(p);

    const r = newRunState(42, { x: 5, y: 5 });
    store.saveRun(r);

    expect(store.loadPersistent()).toEqual(p);
    expect(store.loadRun()).toEqual(r);
  });

  it('clearRun wipes only the run half', () => {
    const p = defaultPersistentState();
    p.resources.embers = 5;
    store.savePersistent(p);
    store.saveRun(newRunState(1, { x: 0, y: 0 }));
    store.clearRun();
    expect(store.loadRun()).toBeNull();
    expect(store.loadPersistent().resources.embers).toBe(5);
  });

  it('migrates v1 persistent saves: metaCurrency → resources.embers', () => {
    // Schema 1 had `metaCurrency: number`; schema 2 has `resources.embers`.
    // Old players should keep their banked Embers across the schema bump.
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        persistent: {
          schemaVersion: 1,
          metaCurrency: 173,
          rescuedFounders: ['Apothecary'],
          unlockedItemPool: [],
          townUpgrades: {},
          audio: { master: 0.8, music: 0.6, sfx: 0.8 },
          hasCompletedFirstRun: true,
        },
        run: null,
      }),
    );
    const loaded = store.loadPersistent();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.resources.embers).toBe(173);
    expect(loaded.rescuedFounders).toEqual(['Apothecary']);
    expect(loaded.hasCompletedFirstRun).toBe(true);
  });

  it('clearAll wipes the save key entirely', () => {
    store.savePersistent(defaultPersistentState());
    store.clearAll();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('returns defaults when the saved blob is corrupt JSON', () => {
    storage.setItem(SAVE_KEY, '{not valid json');
    expect(store.loadPersistent()).toEqual(defaultPersistentState());
    expect(store.loadRun()).toBeNull();
  });

  it('returns defaults when the schema version mismatches', () => {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ persistent: { schemaVersion: 999, metaCurrency: 1 }, run: null }),
    );
    expect(store.loadPersistent()).toEqual(defaultPersistentState());
  });

  it('clamps audio levels read from disk', () => {
    const p = defaultPersistentState();
    // Force a bad value through.
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ persistent: { ...p, audio: { master: 5, music: -1, sfx: 'loud' } }, run: null }),
    );
    const loaded = store.loadPersistent();
    expect(loaded.audio.master).toBe(0.8);
    expect(loaded.audio.music).toBe(0.6);
    expect(loaded.audio.sfx).toBe(0.8);
  });
});
