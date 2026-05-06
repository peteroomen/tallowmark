/**
 * Per-turn updates to the player's hunger and active statuses.
 *
 * Pure functions over `RunState` — Phaser-free, fully unit-testable. The
 * scene wires these in as world-tick handlers and translates the returned
 * "events" into log lines + floating text.
 *
 * The status mechanics live in `StatusBag` + `StatusCatalog`; this module
 * is the thin player-side adapter that wraps `RunState.player` as a
 * `StatusTarget` and re-tags the status events into the existing
 * scene-facing `TickEvent` enum so the renderer doesn't need to know
 * about every status by id.
 */

import type { RunState } from './RunState';
import { applyStatusTo, statusArmorBonus as bagArmorBonus, tickStatusList } from './StatusBag';
import type { StatusId, StatusTarget } from './StatusCatalog';

export const STARVATION_THRESHOLD = 40;
export const STARVATION_INTERVAL = 5;

export interface TickEvent {
  kind:
    | 'hungerDanger'
    | 'statusExpired'
    | 'starvationDamage'
    | 'poisonDamage'
    | 'bleedDamage'
    | 'regenHeal'
    | 'genericStatusDamage'
    | 'genericStatusHeal';
  statusId?: StatusId;
  /** Damage / heal amount. */
  amount?: number;
}

/** Decrement food by 1; on starvation, apply 1 damage every STARVATION_INTERVAL turns. */
export function tickHunger(state: RunState): TickEvent[] {
  const events: TickEvent[] = [];
  if (state.food > 0) {
    state.food = Math.max(0, state.food - 1);
    if (state.food === STARVATION_THRESHOLD) {
      events.push({ kind: 'hungerDanger' });
    }
  } else {
    if (state.turn % STARVATION_INTERVAL === 0 && state.player.hp > 0) {
      state.player.hp = Math.max(0, state.player.hp - 1);
      events.push({ kind: 'starvationDamage', amount: 1 });
    }
  }
  return events;
}

/** Wrap RunState.player as a StatusTarget for the StatusBag tick. */
function playerAsTarget(state: RunState): StatusTarget {
  return {
    damage: (n) => {
      const dealt = Math.min(n, state.player.hp);
      state.player.hp -= dealt;
      return dealt;
    },
    heal: (n) => {
      const headroom = state.player.hpMax - state.player.hp;
      const healed = Math.min(n, Math.max(0, headroom));
      state.player.hp += healed;
      return healed;
    },
    isDead: () => state.player.hp <= 0,
  };
}

/** Run one tick of every player status. Translates StatusBag events to TickEvents. */
export function tickStatuses(state: RunState): TickEvent[] {
  const out: TickEvent[] = [];
  const events = tickStatusList(state.activeStatuses, playerAsTarget(state));
  for (const e of events) {
    if (e.kind === 'expired') {
      out.push({ kind: 'statusExpired', statusId: e.statusId });
      continue;
    }
    if (e.kind === 'damage') {
      const kind: TickEvent['kind'] =
        e.statusId === 'poisoned'
          ? 'poisonDamage'
          : e.statusId === 'bleed'
            ? 'bleedDamage'
            : 'genericStatusDamage';
      out.push({ kind, statusId: e.statusId, amount: e.amount });
    } else if (e.kind === 'heal') {
      const kind: TickEvent['kind'] = e.statusId === 'healing' ? 'regenHeal' : 'genericStatusHeal';
      out.push({ kind, statusId: e.statusId, amount: e.amount });
    }
  }
  return out;
}

export function statusArmorBonus(state: RunState): number {
  return bagArmorBonus(state.activeStatuses);
}

/** Apply (or refresh) a status on the player. Refresh-with-extension. */
export function applyStatus(state: RunState, id: string, turns: number): void {
  applyStatusTo(state.activeStatuses, id as StatusId, turns);
}
