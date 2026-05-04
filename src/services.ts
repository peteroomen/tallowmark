import type Phaser from 'phaser';
import { AudioManager } from '@/audio/AudioManager';
import { SaveStore } from '@/core/SaveStore';
import type { PersistentState } from '@/state/PersistentState';

const REG_KEY = 'tallowmark.services';

export interface Services {
  save: SaveStore;
  audio: AudioManager;
  /** A live, mutable reference to the persistent state. Update via `setPersistent`. */
  persistent: PersistentState;
  setPersistent(updater: (s: PersistentState) => void): void;
}

/**
 * Lazily creates and stores the cross-scene service bag in Phaser's game registry,
 * which is shared by every scene attached to the same Game instance.
 */
export function getServices(scene: Phaser.Scene): Services {
  const registry = scene.game.registry;
  const existing = registry.get(REG_KEY) as Services | undefined;
  if (existing) return existing;

  const save = new SaveStore();
  const persistent = save.loadPersistent();
  const audio = new AudioManager(scene.sound, persistent.audio);

  const services: Services = {
    save,
    audio,
    persistent,
    setPersistent(updater) {
      updater(services.persistent);
      save.savePersistent(services.persistent);
      audio.applySettings(services.persistent.audio);
    },
  };

  registry.set(REG_KEY, services);
  return services;
}
