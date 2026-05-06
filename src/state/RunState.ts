/**
 * Game state for the current run. Wiped on death.
 *
 * Stored on disk so the player can quit mid-run and resume — but never carried
 * across deaths. The RunState is fully reproducible from `seed` plus the player's
 * action history; we persist intermediate state for convenience and quit/resume.
 */

import type { Point } from '@/core/Grid';
import type { Identifications } from '@/items/Identification';
import type { StatusId } from './StatusCatalog';

export const RUN_SCHEMA_VERSION = 2;

export interface PlayerStats {
  hp: number;
  hpMax: number;
  power: number; // base attack power
  armor: number;
}

/** Plain-data inventory entry — runtime `Inventory` class is rehydrated from these on load. */
export interface InventorySlotData {
  defId: string;
  count: number;
}

/**
 * Active-status instance. JSON-serialisable; the runtime behaviour
 * (tick fn, armor bonus, icon frame) lives on `StatusDef` in
 * `state/StatusCatalog.ts` and is looked up by `id`.
 */
export interface ActiveStatus {
  id: StatusId;
  turnsRemaining: number;
}

export interface RunState {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  seed: number;
  floor: number;
  turn: number;
  /** Total enemies killed across this run, persisted across save/load. */
  kills: number;
  /**
   * Tiles the player has ever seen on the current floor — "x,y" string keys.
   * Persists across save/load. Used by the fog-of-war renderer in Stage 4.
   *
   * Stored as a string[] for JSON serialisation; rehydrated to a Set inside
   * the renderer on load.
   */
  exploredTiles: string[];
  playerPos: Point;
  player: PlayerStats;
  /** Hunger clock. Decrements each turn; <40 triggers starvation damage. */
  food: number;
  foodMax: number;
  /** Per-run inventory state. Class instance is rehydrated from this. */
  inventory: InventorySlotData[];
  /** Per-run unidentified labels + identified-defs set. */
  identifications: Identifications;
  /** Active statuses on the player (Fortitude, Poisoned, …). */
  activeStatuses: ActiveStatus[];
  /** Set when the run has ended; UIs check this to route to the death summary. */
  ended: { reason: 'death' | 'victory'; turn: number } | null;
}

export function newRunState(
  seed: number,
  startPos: Point,
  identifications: Identifications = { labels: {}, identified: [] },
): RunState {
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    seed,
    floor: 1,
    turn: 0,
    kills: 0,
    exploredTiles: [],
    playerPos: { x: startPos.x, y: startPos.y },
    // HP/power bumps are deferred to stage 11 (Wayfarer class). Keep iter-2
    // baseline so manual playtest balance is unchanged this stage.
    player: { hp: 20, hpMax: 20, power: 4, armor: 1 },
    food: 200,
    foodMax: 200,
    inventory: [{ defId: 'food_hardtack', count: 1 }],
    identifications,
    activeStatuses: [],
    ended: null,
  };
}
