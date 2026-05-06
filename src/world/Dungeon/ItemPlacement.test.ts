import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/Rng';
import { generateBspDungeon } from './BspGenerator';
import { placeItems } from './ItemPlacement';
import { getItemDef } from '@/items/ItemCatalog';

describe('placeItems', () => {
  it('places the requested count of items on walkable tiles', () => {
    const rng = Rng.fromSeed(123);
    const d = generateBspDungeon(40, 30, rng);
    const items = placeItems(d, rng, { floor: 1, count: 5 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    for (const it of items) {
      // Item position is within the dungeon bounds.
      expect(it.pos.x).toBeGreaterThanOrEqual(0);
      expect(it.pos.x).toBeLessThan(40);
      expect(it.pos.y).toBeGreaterThanOrEqual(0);
      expect(it.pos.y).toBeLessThan(30);
      // Resolves to a real def.
      expect(getItemDef(it.defId)).toBeTruthy();
    }
  });

  it('never places on the player start or stairs tiles', () => {
    const rng = Rng.fromSeed(7);
    const d = generateBspDungeon(40, 30, rng);
    const items = placeItems(d, rng, { floor: 1, count: 30 });
    for (const it of items) {
      expect(`${it.pos.x},${it.pos.y}`).not.toBe(`${d.playerStart.x},${d.playerStart.y}`);
      expect(`${it.pos.x},${it.pos.y}`).not.toBe(`${d.stairsDown.x},${d.stairsDown.y}`);
    }
  });

  it('respects minFloor gating', () => {
    const rng = Rng.fromSeed(99);
    const d = generateBspDungeon(40, 30, rng);
    const items = placeItems(d, rng, { floor: 1, count: 50 });
    // Ember Rune has minFloor: 2 — should never appear on floor 1.
    expect(items.find((it) => it.defId === 'rune_ember')).toBeUndefined();
  });

  it('produces deterministic output for the same seed', () => {
    const a = placeItems(generateBspDungeon(40, 30, Rng.fromSeed(42)), Rng.fromSeed(42), {
      floor: 1,
      count: 10,
    });
    const b = placeItems(generateBspDungeon(40, 30, Rng.fromSeed(42)), Rng.fromSeed(42), {
      floor: 1,
      count: 10,
    });
    expect(a).toEqual(b);
  });
});
