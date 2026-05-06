/**
 * Pure trap trigger + perception-roll logic.
 *
 * `triggerTrap` describes what *should happen* when a trap fires (damage,
 * status applied, gas-cloud tiles, alarm radius) — it does not know about
 * sprites or animations. The renderer in `DungeonScene` consumes the
 * result and translates it into floating text, log lines, status applies,
 * and AI state changes.
 *
 * `rollPerception` is a single-tile spot check for the player's perception
 * stat against an unrevealed trap. The dungeon scene calls it for each
 * unrevealed trap within 1 tile of the player at the start of every turn.
 */

import type { Rng } from '@/core/Rng';
import type { Point } from '@/core/Grid';
import type { TrapState } from '@/state/RunState';
import type { StatusId } from '@/state/StatusCatalog';

export interface TrapTriggerResult {
  /** Direct HP damage to the entity that stepped on the trap. */
  damage: number;
  /** Status applied to the triggering entity. */
  applyStatusToTrigger?: { id: StatusId; turns: number };
  /** Tiles affected by an AoE effect (gas cloud). Anyone in these tiles also gets the status. */
  aoeTiles?: Point[];
  /** Status applied to every entity in `aoeTiles`. */
  applyStatusToAoe?: { id: StatusId; turns: number };
  /** Radius around the trap in which to alert enemies (force-aggro). */
  alarmRadius?: number;
  /** True if the trap is single-use and should be removed after triggering. */
  consumed: boolean;
}

const SPIKE_DMG_MIN = 5;
const SPIKE_DMG_MAX = 8;

/** Resolve a trap trigger into a result the scene can render. */
export function triggerTrap(trap: TrapState, rng: Rng): TrapTriggerResult {
  switch (trap.kind) {
    case 'spike':
      return {
        damage: rng.intInclusive(SPIKE_DMG_MIN, SPIKE_DMG_MAX),
        applyStatusToTrigger: { id: 'bleed', turns: 3 },
        consumed: true,
      };
    case 'gas':
      return {
        damage: 0,
        aoeTiles: aoe3x3(trap.pos),
        applyStatusToAoe: { id: 'poisoned', turns: 5 },
        consumed: true,
      };
    case 'alarm':
      return {
        damage: 0,
        alarmRadius: 10,
        consumed: true,
      };
  }
}

/** Returns the 3×3 tile cluster centred on `p`. */
function aoe3x3(p: Point): Point[] {
  const out: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      out.push({ x: p.x + dx, y: p.y + dy });
    }
  }
  return out;
}

/**
 * Roll the player's perception against a single nearby trap. Returns true if
 * the trap should now be revealed. The scene calls this once per unrevealed
 * adjacent trap each turn.
 */
export function rollPerception(perception: number, rng: Rng): boolean {
  return rng.next() < Math.max(0, Math.min(1, perception));
}

/** Chebyshev-distance 1 (cardinal + diagonal neighbours, plus the centre). */
export function isAdjacent(a: Point, b: Point): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}
