/**
 * Verb resolver — the architectural prize of iter-3 stage 4.
 *
 * Per refinement-002 §K's "for eng" callout: the wheel is dumb, the
 * keyboard is dumb, both ask THIS file for the valid verbs given a
 * target. Adding a verb in iter-4 = one entry here + one entry in
 * `Verbs.ts`. The wheel re-renders without a code change in the
 * widget itself.
 *
 * Returns a `WheelSlots` shape: 6 fixed clock-face positions (12, 2, 4,
 * 6, 8, 10), each either a verb or `null` (empty / dimmed slot). Keeps
 * spatial memory consistent — "Use is at 12 o'clock for items in bag",
 * always.
 *
 * The 12-o'clock slot is always the **primary action** for the target
 * — players learn "long-press, top button = the obvious thing." The
 * resolver enforces this.
 */

import type { Target } from './Targets';
import { VERBS, type VerbId } from './Verbs';

/** Six fixed clock-face slots. null = empty / dimmed. */
export type WheelSlots = [
  /** 12 o'clock — primary action */
  VerbId | null,
  /** 2 o'clock */
  VerbId | null,
  /** 4 o'clock */
  VerbId | null,
  /** 6 o'clock */
  VerbId | null,
  /** 8 o'clock */
  VerbId | null,
  /** 10 o'clock */
  VerbId | null,
];

/** Build an empty wheel (all null). Helper. */
const empty = (): WheelSlots => [null, null, null, null, null, null];

/** Per-target verb tables from refinement-002 §K. */
export function resolveSlots(target: Target): WheelSlots {
  const slots = empty();
  switch (target.kind) {
    case 'self':
      slots[0] = 'wait';
      slots[1] = 'search';
      slots[2] = 'open_inventory';
      slots[3] = 'open_character';
      return slots;

    case 'floor_tile':
      slots[0] = 'walk_to';
      slots[1] = 'search';
      slots[2] = 'examine';
      return slots;

    case 'enemy':
      slots[0] = 'attack';
      slots[1] = 'examine';
      // slot 5 (10 o'clock) reserved for 'cast' — wired iter 4 when wands ship.
      return slots;

    case 'item_on_floor':
      slots[0] = 'pick_up';
      slots[1] = 'examine';
      slots[2] = 'step_over';
      return slots;

    case 'item_in_bag':
      slots[0] = 'use';
      slots[1] = 'drop';
      slots[2] = 'examine';
      return slots;

    case 'stairs':
      // 12 = obvious thing for the direction. Climb only valid up; descend
      // only valid down. Examine is always available.
      if (target.direction === 'down') {
        slots[0] = 'descend';
      } else {
        slots[0] = 'climb';
      }
      slots[2] = 'examine';
      return slots;

    case 'trap':
      slots[0] = 'step_over';
      slots[1] = 'disarm'; // iter 4 — meanwhile the wheel just dims this
      slots[2] = 'examine';
      return slots;

    case 'wall':
      // No verbs — wheel will not open per the §K empty-state rule
      return slots;
  }
}

/**
 * Direct-key dispatch — given a key the player pressed AND the target
 * they're addressing, return the verb to fire (if any). The keyboard is
 * a peer projection of the same resolver: same target + same default key
 * mapping → same verb fires.
 *
 * Match rule: case-insensitive against `Verbs[v].defaultKey` for every
 * populated slot. If no populated slot has a matching key, returns null
 * (caller falls through to scene-level handlers like movement).
 */
export function resolveVerbForKey(target: Target, key: string): VerbId | null {
  const lower = (key ?? '').toLowerCase();
  if (!lower) return null;
  for (const slot of resolveSlots(target)) {
    if (!slot) continue;
    const def = VERBS[slot];
    if (def.defaultKey && def.defaultKey.toLowerCase() === lower) {
      return slot;
    }
  }
  return null;
}

/**
 * Numeric-slot dispatch — keys 1-6 fire the slot at clock-face position
 * 12 / 2 / 4 / 6 / 8 / 10 respectively (when the wheel is open and the
 * target context is established).
 *
 * Returns null if the slot is empty.
 */
export function resolveVerbForNumericKey(target: Target, slotNumber: number): VerbId | null {
  if (slotNumber < 1 || slotNumber > 6) return null;
  return resolveSlots(target)[slotNumber - 1] ?? null;
}

/** Number of populated (non-null) slots in a WheelSlots. Useful for the §K empty-state rule. */
export function slotCount(slots: WheelSlots): number {
  let n = 0;
  for (const s of slots) if (s !== null) n++;
  return n;
}

/** Returns true if the wheel has any populated slot (not all-null). */
export function hasAnyVerb(slots: WheelSlots): boolean {
  return slotCount(slots) > 0;
}
