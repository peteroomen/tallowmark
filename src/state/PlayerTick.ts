/**
 * Per-turn updates to the player's hunger and active statuses.
 *
 * Pure functions over `RunState` — Phaser-free, fully unit-testable. The
 * scene wires these in as world-tick handlers and translates the returned
 * "events" into log lines + floating text.
 *
 * The status framework here is intentionally minimal — just what stage 6
 * needs (Fortitude armor bonus, Poisoned HP/turn). Stage 7 generalises
 * this into a proper `StatusEffect` interface with a per-entity map,
 * stack rules, and HUD icons.
 */

import type { RunState, ActiveStatus } from './RunState';

export const STARVATION_THRESHOLD = 40;
export const STARVATION_INTERVAL = 5;

export interface TickEvent {
  kind: 'hungerDanger' | 'statusExpired' | 'starvationDamage' | 'poisonDamage';
  statusId?: string;
  damage?: number;
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
    // Already starving: 1 HP every STARVATION_INTERVAL turns. Use turn % to
    // pace evenly. state.turn is incremented elsewhere; we read post-increment.
    if (state.turn % STARVATION_INTERVAL === 0 && state.player.hp > 0) {
      state.player.hp = Math.max(0, state.player.hp - 1);
      events.push({ kind: 'starvationDamage', damage: 1 });
    }
  }
  return events;
}

/** Decrement statuses, apply tick effects (Poisoned), expire timed-out ones. */
export function tickStatuses(state: RunState): TickEvent[] {
  const events: TickEvent[] = [];
  const remaining: ActiveStatus[] = [];
  for (const s of state.activeStatuses) {
    if (s.id === 'poisoned' && state.player.hp > 0) {
      state.player.hp = Math.max(0, state.player.hp - 1);
      events.push({ kind: 'poisonDamage', damage: 1 });
    }
    s.turnsRemaining -= 1;
    if (s.turnsRemaining > 0) remaining.push(s);
    else events.push({ kind: 'statusExpired', statusId: s.id });
  }
  state.activeStatuses = remaining;
  return events;
}

/** Sum of armor bonuses from all active statuses. */
export function statusArmorBonus(state: RunState): number {
  let bonus = 0;
  for (const s of state.activeStatuses) {
    if (s.id === 'fortitude') bonus += 2;
  }
  return bonus;
}

/** Apply (or refresh) a status. Refresh-with-extension: longer remaining time wins. */
export function applyStatus(state: RunState, id: string, turns: number): void {
  const existing = state.activeStatuses.find((s) => s.id === id);
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    return;
  }
  state.activeStatuses.push({ id, turnsRemaining: turns });
}
