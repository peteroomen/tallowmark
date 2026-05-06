/**
 * Trap placement on a freshly-generated BSP dungeon.
 *
 * Roughly 1 trap per 3 rooms, weighted equally across the trap kinds.
 * Avoids the player start, the stairs, and any tile already taken by an
 * item or enemy. Floor 1 stays light on traps (one or two) so the new
 * mechanic eases the player in.
 */

import type { Rng } from '@/core/Rng';
import type { Point } from '@/core/Grid';
import type { TrapState } from '@/state/RunState';
import type { GeneratedDungeon } from './BspGenerator';
import { ALL_TRAP_KINDS } from './TrapCatalog';

export interface PlaceTrapsOpts {
  floor: number;
  /** Override the default count heuristic (1 per ~3 rooms). */
  count?: number;
  /** Tiles already occupied — items, enemies, etc. */
  occupied?: ReadonlyArray<Point>;
}

export function placeTraps(
  dungeon: GeneratedDungeon,
  rng: Rng,
  opts: PlaceTrapsOpts,
): TrapState[] {
  const baseCount = Math.max(1, Math.floor(dungeon.rooms.length / 3));
  // Floor 1 caps at 2 traps so the new mechanic doesn't ambush a first-time
  // player. Deeper floors lean on the room-density formula.
  const cap = opts.floor <= 1 ? 2 : Number.POSITIVE_INFINITY;
  const count = Math.min(opts.count ?? baseCount, cap);

  const occupied = new Set<string>();
  for (const p of opts.occupied ?? []) occupied.add(`${p.x},${p.y}`);
  occupied.add(`${dungeon.playerStart.x},${dungeon.playerStart.y}`);
  occupied.add(`${dungeon.stairsDown.x},${dungeon.stairsDown.y}`);

  const traps: TrapState[] = [];
  // Skip room 0 (the player start room) entirely — even if the player isn't
  // on the centre tile, a trap in their starting room reads as unfair.
  const roomPool = dungeon.rooms.length > 1 ? dungeon.rooms.slice(1) : dungeon.rooms;
  for (let i = 0; i < count; i++) {
    const room = rng.pick(roomPool);
    const x = rng.intInclusive(room.x1, room.x2);
    const y = rng.intInclusive(room.y1, room.y2);
    const key = `${x},${y}`;
    if (occupied.has(key)) continue;
    occupied.add(key);
    traps.push({ pos: { x, y }, kind: rng.pick(ALL_TRAP_KINDS), revealed: false });
  }
  return traps;
}
