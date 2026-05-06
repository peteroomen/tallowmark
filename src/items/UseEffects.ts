/**
 * Use-effect resolver. Pure functions over `RunState` + Inventory data.
 *
 * `useItem` returns a list of `UseIntent`s — high-level "what just happened"
 * descriptors that the rendering scene turns into log lines, floating text,
 * tile reveals, teleports, etc. The split keeps effect logic Phaser-free
 * and unit-testable.
 *
 * Identification scrolls return `identifyPicker`, which signals the scene
 * to open a target-selection mode rather than consuming the scroll
 * immediately — it's only consumed once the player picks a target via
 * `applyIdentifyTo`.
 */

import type { RunState } from '@/state/RunState';
import { applyStatus } from '@/state/PlayerTick';
import { getItemDef } from './ItemCatalog';
import { markIdentified } from './Identification';

export type UseIntent =
  | { kind: 'heal'; amount: number }
  | { kind: 'eat'; food: number }
  | { kind: 'embers'; amount: number }
  | { kind: 'applyStatus'; statusId: string; turns: number }
  | { kind: 'revealFloor' }
  | { kind: 'blink' }
  | { kind: 'identifyPicker' }
  | { kind: 'log'; message: string };

export interface UseResult {
  intents: UseIntent[];
  /** True if the slot count should decrement now. False for identify-picker (deferred). */
  consumed: boolean;
}

/** Resolve a use-action on the inventory slot at the given index. */
export function useItem(state: RunState, slotIndex: number, rng: { next: () => number }): UseResult {
  const slot = state.inventory[slotIndex];
  if (!slot) return { intents: [{ kind: 'log', message: 'Nothing there.' }], consumed: false };
  const def = getItemDef(slot.defId);
  if (!def) return { intents: [{ kind: 'log', message: 'Nothing there.' }], consumed: false };

  // Drinking/reading any unidentified item identifies that type for the rest
  // of the run. Even if the effect itself is "applyStatus poisoned", you now
  // know what the Cloudy Potion is.
  const wasUnidentified = !state.identifications.identified.includes(def.id) && def.needsIdentification;
  if (wasUnidentified) markIdentified(state.identifications, def.id);

  const intents: UseIntent[] = [];
  switch (def.id) {
    case 'potion_healing': {
      // S7: Healing applies a 1 HP/turn regen status for 10 turns rather than
      // an instant heal. Encourages drinking pre-fight rather than emergency
      // mid-fight, and gives the new status framework a positive effect to
      // surface in the HUD icon row.
      applyStatus(state, 'healing', 10);
      intents.push({ kind: 'applyStatus', statusId: 'healing', turns: 10 });
      intents.push({ kind: 'log', message: `You feel a slow warmth. Regen 1 HP/turn for 10 turns.` });
      return { intents, consumed: true };
    }
    case 'potion_fortitude': {
      applyStatus(state, 'fortitude', 20);
      intents.push({ kind: 'applyStatus', statusId: 'fortitude', turns: 20 });
      intents.push({ kind: 'log', message: `You feel hardier (+2 Armor, 20 turns).` });
      return { intents, consumed: true };
    }
    case 'potion_poison': {
      applyStatus(state, 'poisoned', 5);
      intents.push({ kind: 'applyStatus', statusId: 'poisoned', turns: 5 });
      intents.push({ kind: 'log', message: `Your stomach churns! You are Poisoned (5 turns).` });
      return { intents, consumed: true };
    }
    case 'scroll_mapping': {
      intents.push({ kind: 'revealFloor' });
      intents.push({ kind: 'log', message: 'The map of this floor unfolds in your mind.' });
      return { intents, consumed: true };
    }
    case 'scroll_blinking': {
      intents.push({ kind: 'blink' });
      intents.push({ kind: 'log', message: 'Reality blurs — you reappear elsewhere.' });
      return { intents, consumed: true };
    }
    case 'scroll_identification': {
      intents.push({ kind: 'identifyPicker' });
      // Not consumed yet — the scene's picker will call `applyIdentifyTo`.
      return { intents, consumed: false };
    }
    case 'food_hardtack': {
      const restore = Math.min(80, state.foodMax - state.food);
      intents.push({ kind: 'eat', food: restore });
      intents.push({ kind: 'log', message: `You gnaw on the hardtack. +${restore} food.` });
      return { intents, consumed: true };
    }
    case 'rune_ember': {
      const amount = 10 + Math.floor(rng.next() * 11); // 10..20
      intents.push({ kind: 'embers', amount });
      intents.push({ kind: 'log', message: `The rune dissolves. +${amount} Embers banked.` });
      return { intents, consumed: true };
    }
    default:
      return { intents: [{ kind: 'log', message: `${def.trueName} sits inert.` }], consumed: false };
  }
}

/** Identify a target def (called when the player picks a slot in identify mode). */
export function applyIdentifyTo(state: RunState, targetDefId: string): boolean {
  const def = getItemDef(targetDefId);
  if (!def || !def.needsIdentification) return false;
  if (state.identifications.identified.includes(targetDefId)) return false;
  markIdentified(state.identifications, targetDefId);
  return true;
}
