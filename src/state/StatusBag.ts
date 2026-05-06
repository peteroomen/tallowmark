/**
 * Pure functions over an `ActiveStatus[]` list. Drives the per-tick
 * behaviour of statuses on the player and on enemies. The list itself is
 * JSON-serialisable so it round-trips through `SaveStore` cleanly.
 *
 * `tickStatusList` adapts a generic `StatusTarget` so the same code
 * works for both the player (tick → mutate `RunState.player`) and an
 * `Enemy` (tick → mutate `enemy.stats`). The events it returns are
 * tone- and statusId-tagged so the rendering scene can fire the right
 * floating-text colour and log line per status without the data layer
 * knowing anything about Phaser.
 */

import type { ActiveStatus } from './RunState';
import { STATUS_CATALOG, type StatusDef, type StatusId, type StatusTarget } from './StatusCatalog';

export interface StatusTickEvent {
  /** What happened this tick. */
  kind: 'damage' | 'heal' | 'expired';
  statusId: StatusId;
  /** Damage / heal amount (omitted for expired). */
  amount?: number;
}

/** Apply a status. Refresh-with-extension: longer remaining time wins. */
export function applyStatusTo(list: ActiveStatus[], id: StatusId, turns: number): void {
  const existing = list.find((s) => s.id === id);
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    return;
  }
  list.push({ id, turnsRemaining: turns });
}

export function hasStatus(list: ActiveStatus[], id: StatusId): boolean {
  return list.some((s) => s.id === id);
}

export function removeStatus(list: ActiveStatus[], id: StatusId): void {
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list.splice(i, 1);
}

/** Sum of armorBonus across all currently-active statuses. */
export function statusArmorBonus(list: ActiveStatus[]): number {
  let bonus = 0;
  for (const s of list) {
    const def = STATUS_CATALOG[s.id];
    if (def?.armorBonus) bonus += def.armorBonus;
  }
  return bonus;
}

/**
 * Run one tick of every status in `list` against `target`.
 *
 * Each status's `tick` (if any) fires first, then `turnsRemaining`
 * decrements, then the status expires if it ran out. Statuses that
 * killed the target stop further ticks for this round.
 */
export function tickStatusList(list: ActiveStatus[], target: StatusTarget): StatusTickEvent[] {
  const events: StatusTickEvent[] = [];
  const remaining: ActiveStatus[] = [];
  for (const s of list) {
    const def: StatusDef | undefined = STATUS_CATALOG[s.id];
    if (!def) continue; // unknown status id — drop it silently

    if (def.tick && !target.isDead()) {
      const wrapped: StatusTarget = {
        damage: (n) => {
          const dealt = target.damage(n);
          events.push({ kind: 'damage', statusId: s.id, amount: dealt });
          return dealt;
        },
        heal: (n) => {
          const healed = target.heal(n);
          events.push({ kind: 'heal', statusId: s.id, amount: healed });
          return healed;
        },
        isDead: () => target.isDead(),
      };
      const expireEarly = def.tick(wrapped);
      if (expireEarly) {
        events.push({ kind: 'expired', statusId: s.id });
        continue;
      }
    }
    s.turnsRemaining -= 1;
    if (s.turnsRemaining > 0) remaining.push(s);
    else events.push({ kind: 'expired', statusId: s.id });
  }
  // Mutate in place so callers that hold references (e.g. a renderer
  // bound to RunState.activeStatuses) don't need to reseat their pointer.
  list.length = 0;
  for (const s of remaining) list.push(s);
  return events;
}
