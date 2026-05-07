/**
 * Class blueprint shape — a player class is data: starting stats + a
 * starting inventory recipe.
 *
 * Iter 2 ships exactly one class (Wayfarer); the iter-4 classes
 * (Brigand / Acolyte / Ironclad) slot into the same shape so unlocking
 * a new class is a content add, not engineering work.
 */

import type { PlayerStats } from '@/state/RunState';
import type { Rng } from '@/core/Rng';

/** A line in the starting-kit recipe — either fixed or a random pick from a pool. */
export type StartingKitEntry =
  | { kind: 'fixed'; defId: string; count?: number }
  | { kind: 'pickOne'; pool: ReadonlyArray<string>; count?: number };

export interface ClassBlueprint {
  /** Stable id used by SaveStore + UI. */
  id: string;
  /** Display name in CharacterScene + Threshold. */
  displayName: string;
  /** Short tagline shown alongside the class name. */
  tagline: string;
  /** Base stats applied at run start. */
  baseStats: PlayerStats;
  /** Starting food / foodMax. */
  food: number;
  foodMax: number;
  /** Starting kit recipe — resolved at run-start to concrete inventory entries. */
  startingKit: ReadonlyArray<StartingKitEntry>;
}

/**
 * Resolve a class's startingKit recipe into concrete inventory entries
 * using the run's seeded RNG so picks are reproducible per seed.
 */
export function resolveStartingKit(
  blueprint: ClassBlueprint,
  rng: Rng,
): Array<{ defId: string; count: number }> {
  const out: Array<{ defId: string; count: number }> = [];
  for (const entry of blueprint.startingKit) {
    const count = entry.count ?? 1;
    if (entry.kind === 'fixed') {
      out.push({ defId: entry.defId, count });
    } else {
      const picked = rng.pick(entry.pool);
      out.push({ defId: picked, count });
    }
  }
  return out;
}
