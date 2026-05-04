import * as ROT from 'rot-js';
import { Grid } from '@/core/Grid';
import type { Point } from '@/core/Grid';
import type { Rng } from '@/core/Rng';
import { TileKind } from '@/world/Tile';

export interface GeneratedDungeon {
  tiles: Grid<TileKind>;
  rooms: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }>;
  /** A walkable tile to place the player on. */
  playerStart: Point;
  /** A walkable tile far from the player to place stairs-down on. */
  stairsDown: Point;
}

/**
 * BSP-room generator backed by rot.js Map.Digger.
 * Produces rooms and corridors carved into a wall-filled grid.
 *
 * NOTE: rot.js generators have their own internal RNG. We feed it from our seeded
 * RNG via `ROT.RNG.setSeed(rng.next() * 0x7fffffff)` so the dungeon is reproducible
 * for a given seed without leaking that RNG state outside.
 */
export function generateBspDungeon(width: number, height: number, rng: Rng): GeneratedDungeon {
  const seedForRot = Math.floor(rng.next() * 0x7fffffff);
  const prevSeed = ROT.RNG.getSeed();
  ROT.RNG.setSeed(seedForRot);
  try {
    const digger = new ROT.Map.Digger(width, height, {
      roomWidth: [4, 9],
      roomHeight: [3, 6],
      corridorLength: [2, 7],
      dugPercentage: 0.25,
    });

    const tiles = new Grid<TileKind>(width, height, TileKind.Wall);
    digger.create((x, y, value) => {
      // value 0 = floor (carved), 1 = wall (untouched).
      tiles.set(x, y, value === 0 ? TileKind.Floor : TileKind.Wall);
    });

    const rooms = digger.getRooms().map((r) => ({
      x1: r.getLeft(),
      y1: r.getTop(),
      x2: r.getRight(),
      y2: r.getBottom(),
    }));

    if (rooms.length === 0) {
      throw new Error('BSP generator produced no rooms — bad parameters?');
    }

    const startRoom = rooms[0]!;
    const endRoom = rooms[rooms.length - 1]!;
    const playerStart: Point = roomCenter(startRoom);
    const stairsDown: Point = roomCenter(endRoom);
    tiles.set(stairsDown.x, stairsDown.y, TileKind.StairsDown);

    return { tiles, rooms, playerStart, stairsDown };
  } finally {
    ROT.RNG.setSeed(prevSeed);
  }
}

function roomCenter(r: { x1: number; y1: number; x2: number; y2: number }): Point {
  return {
    x: Math.floor((r.x1 + r.x2) / 2),
    y: Math.floor((r.y1 + r.y2) / 2),
  };
}
