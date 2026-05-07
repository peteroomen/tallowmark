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
import type { TrapKind } from '@/world/Dungeon/TrapCatalog';
import type { ClassBlueprint } from '@/entities/classes/ClassBlueprint';

export const RUN_SCHEMA_VERSION = 2;

export interface PlayerStats {
  hp: number;
  hpMax: number;
  power: number; // base attack power
  armor: number;
  /**
   * Chance per turn (0..1) to spot an unrevealed trap on an adjacent tile.
   * Default 0.30. Boosted to ~0.80 for the turn after a Search action.
   * Optional so spreading `Player.stats` (which uses the looser CombatStats
   * shape) is type-compat with PlayerStats; readers default `undefined` → 0.30.
   */
  perception?: number;
}

/** Plain-data trap on the dungeon floor. JSON-serialisable for save/load. */
export interface TrapState {
  pos: Point;
  kind: TrapKind;
  /** True once the player has spotted it (perception roll or first step). */
  revealed: boolean;
}

/**
 * Floor descriptor — small flavour pool that gives every floor an identity
 * before iter-5's biome system lands. Picked deterministically per
 * (seed, floor). Affects gen-time choices: enemy budget, item budget,
 * trap density, food spawn weight.
 */
export type FloorDescriptor =
  | 'Quiet'
  | 'Cramped'
  | 'Open'
  | 'Trapped'
  | 'Hungry';

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
  /** Hidden traps on the current floor; regenerated when descending. */
  traps: TrapState[];
  /** Flavour descriptor for the current floor (Quiet / Cramped / Open / etc.). */
  floorDescriptor: FloorDescriptor;
  /** Set when the run has ended; UIs check this to route to the death summary. */
  ended: { reason: 'death' | 'victory'; turn: number } | null;
}

export function newRunState(
  seed: number,
  startPos: Point,
  identifications: Identifications = { labels: {}, identified: [] },
  classBlueprint?: ClassBlueprint,
  inventory?: Array<{ defId: string; count: number }>,
): RunState {
  // Default to Wayfarer if no blueprint supplied — keeps newRunState callable
  // from places that don't know about the class system (tests, save migration).
  const bp = classBlueprint ?? {
    baseStats: { hp: 30, hpMax: 30, power: 5, armor: 1, perception: 0.3 },
    food: 200,
    foodMax: 200,
  };
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    seed,
    floor: 1,
    turn: 0,
    kills: 0,
    exploredTiles: [],
    playerPos: { x: startPos.x, y: startPos.y },
    player: { ...bp.baseStats },
    food: bp.food,
    foodMax: bp.foodMax,
    inventory: inventory ?? [{ defId: 'food_hardtack', count: 1 }],
    identifications,
    activeStatuses: [],
    traps: [],
    floorDescriptor: 'Quiet',
    ended: null,
  };
}
