/**
 * Game state for the current run. Wiped on death.
 *
 * Stored on disk so the player can quit mid-run and resume — but never carried
 * across deaths. The RunState is fully reproducible from `seed` plus the player's
 * action history; we persist intermediate state for convenience and quit/resume.
 */

import type { Point } from '@/core/Grid';

export const RUN_SCHEMA_VERSION = 1;

export interface PlayerStats {
  hp: number;
  hpMax: number;
  power: number; // base attack power
  armor: number;
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
  /** Set when the run has ended; UIs check this to route to the death summary. */
  ended: { reason: 'death' | 'victory'; turn: number } | null;
}

export function newRunState(seed: number, startPos: Point): RunState {
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    seed,
    floor: 1,
    turn: 0,
    kills: 0,
    exploredTiles: [],
    playerPos: { x: startPos.x, y: startPos.y },
    player: { hp: 20, hpMax: 20, power: 4, armor: 1 },
    ended: null,
  };
}
