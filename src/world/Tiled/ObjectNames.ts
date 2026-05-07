/**
 * Tiled object-name parser per refinement-002 §N.
 *
 * Tiled object names are encoded as `kind:id[:modifier]` and dispatched by
 * `kind`. The renderer walks the `objects` layer and asks for each object's
 * parsed shape; unknown kinds are reported but don't crash.
 *
 * Examples (from the iter-3 + iter-7 spec):
 *   door:apothecary_main
 *   door:secret_passage:feat_identify_100
 *   npc:wandering_merchant:renown_3
 *   trigger:dungeon_arch_1:none
 *   trigger:dungeon_arch_2:renown_3
 *   trigger:world_map_portal:renown_7
 *   spawn:player_default
 *   decoration:fountain
 *
 * Adding a new kind in iter-7 = add one entry to KNOWN_KINDS + one
 * dispatch branch wherever consumers care.
 */

export type ObjectKind =
  | 'door'
  | 'npc'
  | 'trigger'
  | 'spawn'
  | 'decoration'
  | 'sign'
  /** Unknown — parser fell through. Don't crash; let the renderer skip. */
  | 'unknown';

const KNOWN_KINDS: ReadonlyArray<ObjectKind> = [
  'door',
  'npc',
  'trigger',
  'spawn',
  'decoration',
  'sign',
];

export interface ParsedObjectName {
  kind: ObjectKind;
  /** Stable id for the object (e.g. `apothecary_main`). */
  id: string;
  /** Optional modifier — typically a lock-condition string for doors/triggers. */
  modifier?: string;
  /** Original name string. Useful for diagnostics. */
  raw: string;
}

/**
 * Parse a Tiled object name. Returns `kind: 'unknown'` for malformed or
 * unrecognised names — never throws. Callers check `kind` before dispatch.
 */
export function parseObjectName(raw: string): ParsedObjectName {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { kind: 'unknown', id: '', raw };
  }
  const parts = trimmed.split(':');
  const kindStr = parts[0]!.toLowerCase();
  const kind: ObjectKind = (KNOWN_KINDS as ReadonlyArray<string>).includes(kindStr)
    ? (kindStr as ObjectKind)
    : 'unknown';
  const id = parts[1] ?? '';
  const modifier = parts[2];
  return { kind, id, modifier, raw };
}
