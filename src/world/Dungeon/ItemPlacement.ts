/**
 * Pure item placement for a generated dungeon — picks (tile, defId) pairs
 * weighted by spawn weight + min-floor gating.
 *
 * Returns a list of placements; the scene layer turns each into a sprite +
 * runtime entity. No Phaser imports here so the placement logic is testable
 * in isolation.
 */

import type { Point } from '@/core/Grid';
import type { Rng } from '@/core/Rng';
import { ALL_DEF_IDS, getItemDef } from '@/items/ItemCatalog';
import type { GeneratedDungeon } from './BspGenerator';

export interface ItemPlacement {
  pos: Point;
  defId: string;
}

export interface PlaceItemsOpts {
  /** Floor number — items with `minFloor > floor` are filtered out. */
  floor: number;
  /** Number of items to place. Defaults to a floor-aware "1 per ~3 rooms" heuristic. */
  count?: number;
  /** Tiles already occupied (player start, stairs, enemies). Avoid these. */
  occupied?: ReadonlyArray<Point>;
}

export function placeItems(
  dungeon: GeneratedDungeon,
  rng: Rng,
  opts: PlaceItemsOpts,
): ItemPlacement[] {
  const count = opts.count ?? Math.max(2, Math.floor(dungeon.rooms.length / 2));
  const occupiedKeys = new Set<string>();
  for (const p of opts.occupied ?? []) occupiedKeys.add(`${p.x},${p.y}`);
  occupiedKeys.add(`${dungeon.playerStart.x},${dungeon.playerStart.y}`);
  occupiedKeys.add(`${dungeon.stairsDown.x},${dungeon.stairsDown.y}`);

  const eligibleDefs = ALL_DEF_IDS.flatMap((id) => {
    const def = getItemDef(id);
    if (!def) return [];
    if (def.spawnWeight <= 0) return [];
    if ((def.minFloor ?? 1) > opts.floor) return [];
    return [{ id, weight: def.spawnWeight }];
  });
  if (eligibleDefs.length === 0) return [];

  const placements: ItemPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const room = rng.pick(dungeon.rooms);
    const x = rng.intInclusive(room.x1, room.x2);
    const y = rng.intInclusive(room.y1, room.y2);
    const key = `${x},${y}`;
    if (occupiedKeys.has(key)) continue;
    occupiedKeys.add(key);
    placements.push({ pos: { x, y }, defId: pickWeighted(rng, eligibleDefs) });
  }
  return placements;
}

function pickWeighted(rng: Rng, items: ReadonlyArray<{ id: string; weight: number }>): string {
  const total = items.reduce((s, e) => s + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of items) {
    roll -= e.weight;
    if (roll <= 0) return e.id;
  }
  return items[items.length - 1]!.id;
}
