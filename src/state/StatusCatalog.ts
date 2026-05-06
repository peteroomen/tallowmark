/**
 * Status-effect catalog. Pairs each StatusId with its per-tick behaviour,
 * static modifiers, and HUD presentation.
 *
 * The catalog is *runtime-only* — it holds lambdas that mutate entities.
 * The matching JSON-serialisable instance shape is `ActiveStatus`
 * (`{ id, turnsRemaining }`) on `RunState` and on each `Enemy`.
 *
 * Adding a new status = one entry here + one branch in any code that
 * cares about the status by name (e.g. movement mirror for `confused`).
 */

import { TilesRPG } from '@/world/FrameCatalog';

export type StatusId = 'healing' | 'fortitude' | 'poisoned' | 'confused' | 'bleed';

/**
 * Minimal interface a status's `tick` function uses to affect its target.
 * The same tick code drives the player and enemies — the target wraps the
 * relevant entity's stats and exposes only `damage` and `heal`.
 */
export interface StatusTarget {
  /** Apply N damage to the target. Returns the actual amount dealt (clamped). */
  damage: (amount: number) => number;
  /** Restore N HP. Returns the actual amount healed (clamped to maxHP). */
  heal: (amount: number) => number;
  /** True if the target died from a tick this round. */
  isDead: () => boolean;
}

export interface StatusDef {
  id: StatusId;
  /** Short HUD label, e.g. "Fort" or "Psn". */
  label: string;
  /** Sprite frame for the 16×16 HUD icon. */
  iconFrame: number;
  /** Hex colour for the icon tint + countdown text. */
  color: string;
  /** Per-turn tick. Return true to expire early. */
  tick?: (target: StatusTarget) => boolean | void;
  /** Static +armor bonus applied while active. */
  armorBonus?: number;
}

export const STATUS_CATALOG: Record<StatusId, StatusDef> = {
  healing: {
    id: 'healing',
    label: 'Reg',
    iconFrame: TilesRPG.potionRed,
    color: '#6aa84a',
    tick: (t) => {
      t.heal(1);
    },
  },
  fortitude: {
    id: 'fortitude',
    label: 'Fort',
    iconFrame: TilesRPG.shieldBasic,
    color: '#d4a24c',
    armorBonus: 2,
  },
  poisoned: {
    id: 'poisoned',
    label: 'Psn',
    iconFrame: TilesRPG.potionBlue,
    color: '#7ac74c',
    tick: (t) => {
      t.damage(1);
    },
  },
  confused: {
    id: 'confused',
    label: 'Cnf',
    iconFrame: TilesRPG.scroll,
    color: '#a06ad4',
  },
  bleed: {
    id: 'bleed',
    label: 'Bld',
    iconFrame: TilesRPG.potionRed,
    color: '#d44a4a',
    tick: (t) => {
      t.damage(1);
    },
  },
};

export const ALL_STATUS_IDS: ReadonlyArray<StatusId> = Object.keys(STATUS_CATALOG) as StatusId[];
