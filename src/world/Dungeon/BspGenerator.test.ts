import { describe, expect, it } from 'vitest';
import { generateBspDungeon } from './BspGenerator';
import { Rng } from '@/core/Rng';
import { TileKind } from '@/world/Tile';

describe('generateBspDungeon', () => {
  it('is deterministic for the same seed', () => {
    const a = generateBspDungeon(40, 30, Rng.fromSeed(42));
    const b = generateBspDungeon(40, 30, Rng.fromSeed(42));
    expect(a.rooms).toEqual(b.rooms);
    expect(a.playerStart).toEqual(b.playerStart);
    expect(a.stairsDown).toEqual(b.stairsDown);
    a.tiles.forEach((v, x, y) => expect(b.tiles.get(x, y)).toBe(v));
  });

  it('produces at least 2 rooms', () => {
    const d = generateBspDungeon(50, 35, Rng.fromSeed(1));
    expect(d.rooms.length).toBeGreaterThanOrEqual(2);
  });

  it('places player and stairs on walkable tiles', () => {
    const d = generateBspDungeon(50, 35, Rng.fromSeed(7));
    const startTile = d.tiles.get(d.playerStart.x, d.playerStart.y);
    expect(startTile === TileKind.Floor || startTile === TileKind.StairsUp).toBe(true);
    expect(d.tiles.get(d.stairsDown.x, d.stairsDown.y)).toBe(TileKind.StairsDown);
  });

  it('carves at least 10% of cells as floor', () => {
    const d = generateBspDungeon(60, 40, Rng.fromSeed(3));
    let floorCount = 0;
    let total = 0;
    d.tiles.forEach((v) => {
      total += 1;
      if (v === TileKind.Floor || v === TileKind.StairsDown) floorCount++;
    });
    expect(floorCount / total).toBeGreaterThan(0.1);
  });
});
