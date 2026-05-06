import type { Rng } from '@/core/Rng';
import { ITEM_CATALOG, type ItemDef } from './ItemCatalog';

/**
 * Per-run item identification state.
 *
 * Two parts:
 *   1. **Labels** — every potion / scroll def gets a randomised display name
 *      ("Cloudy Potion", "Scroll of KIR") via a seeded shuffle. Two runs with
 *      the same seed produce the same labels.
 *   2. **Identified set** — defIds that the player has identified this run
 *      (by drinking, by scroll, by NPC). Once identified, the trueName replaces
 *      the label everywhere, and all future drops of that type stack/spawn as
 *      identified.
 *
 * Identification is per-run state — it wipes on death and is part of `RunState`.
 */

const POTION_COLORS = [
  'Cloudy',
  'Crimson',
  'Azure',
  'Emerald',
  'Amber',
  'Inky',
  'Bubbling',
  'Silvery',
  'Murky',
  'Iridescent',
] as const;

const SCROLL_SYLLABLES = [
  'KIR',
  'OVA',
  'ZUN',
  'TAL',
  'MOR',
  'VEX',
  'NEH',
  'BRI',
  'GUL',
  'PHO',
] as const;

export interface Identifications {
  /** defId → display label while unidentified, e.g. "potion_healing" → "Cloudy Potion". */
  labels: Record<string, string>;
  /** defIds that are currently identified for this run. */
  identified: string[];
}

/**
 * Build a fresh identification table for a new run. Uses the seeded RNG so the
 * label assignment is reproducible.
 */
export function buildIdentifications(rng: Rng): Identifications {
  const labels: Record<string, string> = {};
  const potionDefs = Object.values(ITEM_CATALOG).filter((d) => d.kind === 'potion' && d.needsIdentification);
  const scrollDefs = Object.values(ITEM_CATALOG).filter((d) => d.kind === 'scroll' && d.needsIdentification);

  const colors = rng.shuffle(POTION_COLORS);
  for (let i = 0; i < potionDefs.length; i++) {
    labels[potionDefs[i]!.id] = `${colors[i % colors.length]} Potion`;
  }
  const syllables = rng.shuffle(SCROLL_SYLLABLES);
  for (let i = 0; i < scrollDefs.length; i++) {
    labels[scrollDefs[i]!.id] = `Scroll of ${syllables[i % syllables.length]}`;
  }
  return { labels, identified: [] };
}

/** True iff the def is currently identified for this run (or doesn't need ID). */
export function isIdentified(ids: Identifications, def: ItemDef): boolean {
  if (!def.needsIdentification) return true;
  return ids.identified.includes(def.id);
}

/** Display name to show in UI given current identification state. */
export function displayName(ids: Identifications, def: ItemDef): string {
  if (isIdentified(ids, def)) return def.trueName;
  return ids.labels[def.id] ?? def.trueName;
}

/** Mark a def as identified for the rest of the run. Idempotent. */
export function markIdentified(ids: Identifications, defId: string): void {
  if (!ids.identified.includes(defId)) ids.identified.push(defId);
}

