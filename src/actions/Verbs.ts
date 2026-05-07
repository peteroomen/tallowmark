/**
 * Action verb catalog. Pure data; no Phaser, no scene refs.
 *
 * Per refinement-002 §K — every verb has a stable id, a short label
 * (HUD / Action Wheel slot), a glyph hint (drawn programmatically by
 * the wheel widget — see ui/ActionWheel.ts), and a default keyboard
 * binding for desktop.
 *
 * Adding a new verb in iter-4+ (e.g. 'cast') = one entry here + one
 * resolver branch in Resolver.ts. The wheel asks the resolver and
 * renders the answer; the verb catalog tells it what to draw.
 */

export type VerbId =
  // Self
  | 'wait'
  | 'search'
  | 'open_inventory'
  | 'open_character'
  // Floor tile
  | 'walk_to'
  | 'examine'
  // Enemy
  | 'attack'
  | 'cast' // iter 4
  // Item on floor
  | 'pick_up'
  | 'step_over'
  // Item in bag
  | 'use'
  | 'drop'
  // Stairs
  | 'descend'
  | 'climb'
  // Trap (revealed)
  | 'disarm' // iter 4
  // Puzzle / locked content
  | 'apply'; // iter 3.5c — "Apply X to tile Y"

/** Glyph drawn at the centre of the wheel slot. Same vocab as StatusIcon. */
export type VerbGlyph =
  | 'hourglass'
  | 'magnifier'
  | 'magnifier_sparkle'
  | 'pouch_in'
  | 'pouch_out'
  | 'sword'
  | 'spark_palm'
  | 'footprints'
  | 'stairs_down'
  | 'stairs_up'
  | 'tiptoe'
  | 'wrench'
  | 'wand'
  | 'inventory_bag'
  | 'character_silhouette';

export interface VerbDef {
  id: VerbId;
  label: string;
  glyph: VerbGlyph;
  /** Default keyboard shortcut. Resolver-fired (bypass wheel). */
  defaultKey?: string;
}

export const VERBS: Record<VerbId, VerbDef> = {
  wait: { id: 'wait', label: 'Wait', glyph: 'hourglass', defaultKey: '.' },
  search: { id: 'search', label: 'Search', glyph: 'magnifier_sparkle', defaultKey: 'q' },
  open_inventory: { id: 'open_inventory', label: 'Bag', glyph: 'inventory_bag', defaultKey: 'i' },
  open_character: { id: 'open_character', label: 'Self', glyph: 'character_silhouette', defaultKey: 'c' },
  walk_to: { id: 'walk_to', label: 'Walk', glyph: 'footprints' },
  examine: { id: 'examine', label: 'Examine', glyph: 'magnifier' },
  attack: { id: 'attack', label: 'Attack', glyph: 'sword' },
  cast: { id: 'cast', label: 'Cast', glyph: 'spark_palm' },
  pick_up: { id: 'pick_up', label: 'Pick Up', glyph: 'pouch_in', defaultKey: 'g' },
  step_over: { id: 'step_over', label: 'Step Over', glyph: 'tiptoe' },
  use: { id: 'use', label: 'Use', glyph: 'wand', defaultKey: 'u' },
  drop: { id: 'drop', label: 'Drop', glyph: 'pouch_out', defaultKey: 'd' },
  descend: { id: 'descend', label: 'Descend', glyph: 'stairs_down' },
  climb: { id: 'climb', label: 'Climb', glyph: 'stairs_up' },
  disarm: { id: 'disarm', label: 'Disarm', glyph: 'wrench' },
  apply: { id: 'apply', label: 'Apply', glyph: 'wrench' },
};

/** Look up a verb def. Throws on unknown id (caller bug). */
export function getVerb(id: VerbId): VerbDef {
  const def = VERBS[id];
  if (!def) throw new Error(`Unknown verb id: ${id}`);
  return def;
}
