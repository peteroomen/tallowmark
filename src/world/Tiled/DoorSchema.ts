/**
 * Tiled door object schema per refinement-002 §N.
 *
 * Every door in `town.tmj` (and later, dungeon room templates) is authored
 * as an object with the name `door:<id>[:<lock_condition>]` plus four
 * custom properties:
 *
 *   target_scene  — the scene to transition to when the player walks the door
 *   founder_id    — optional; the founder this door belongs to (T0/T1/T2 gate)
 *   locked_visual — how the locked door renders ('boarded' | 'chained' | 'mist' | 'bricked')
 *   open_pos      — optional spawn point in the target scene (for re-entry alignment)
 *
 * Renderer flow (TownScene):
 *   1. Walk the `objects` Tiled layer.
 *   2. parseObjectName → ObjectKind === 'door'.
 *   3. Read custom properties → DoorObject.
 *   4. LockCheck.isMet(lock_condition, ctx) decides:
 *        - met   → render T1/T2 door, walking onto it triggers transition
 *        - unmet → render `locked_visual` blocker (with mist overlay), Examine
 *                  on interaction. Walking onto the door tile is blocked
 *                  (treated as a wall).
 *
 * One door schema, all gating. Iter-7 secret doors hang off this with no
 * code changes — just new objects in Tiled.
 */

export type LockedVisual = 'boarded' | 'chained' | 'mist' | 'bricked';

/** Plain Tiled object (subset of the full Tiled spec we care about). */
export interface TiledObject {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Array<{ name: string; type?: string; value: unknown }>;
}

export interface DoorObject {
  /** Stable id from `door:<id>...` */
  id: string;
  /** Tile column the door sits on (south face of the building). */
  tileX: number;
  /** Tile row. */
  tileY: number;
  /** Phaser scene key to transition to. */
  targetScene: string;
  /** Optional founder this door's open-state depends on. */
  founderId?: string;
  /** Lock condition string (parsed by LockCheck.isMet). May be empty/null. */
  lockCondition: string | null;
  /** How the locked door renders. */
  lockedVisual: LockedVisual;
}

/**
 * Convert a Tiled object into a strongly-typed DoorObject. Returns null
 * if the object isn't a valid door (missing name / wrong shape) — caller
 * should skip silently.
 *
 * Tile coordinates are derived from pixel coords + tile size.
 */
export function readDoorObject(
  obj: TiledObject,
  tileSize: number,
  parsedId: string,
  parsedModifier: string | undefined,
): DoorObject | null {
  if (!parsedId) return null;
  const tileX = Math.floor(obj.x / tileSize);
  const tileY = Math.floor(obj.y / tileSize);
  const props = readProperties(obj);
  const targetScene = (props['target_scene'] as string | undefined) ?? '';
  if (!targetScene) return null;
  return {
    id: parsedId,
    tileX,
    tileY,
    targetScene,
    founderId: (props['founder_id'] as string | undefined) ?? undefined,
    lockCondition: parsedModifier ?? null,
    lockedVisual: validateVisual(props['locked_visual']),
  };
}

function readProperties(obj: TiledObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of obj.properties ?? []) {
    out[p.name] = p.value;
  }
  return out;
}

function validateVisual(v: unknown): LockedVisual {
  if (v === 'boarded' || v === 'chained' || v === 'mist' || v === 'bricked') return v;
  return 'boarded';
}
