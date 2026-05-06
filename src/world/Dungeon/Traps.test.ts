import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/Rng';
import { generateBspDungeon } from './BspGenerator';
import { placeTraps } from './TrapPlacement';
import { isAdjacent, rollPerception, triggerTrap } from './Traps';
import type { TrapState } from '@/state/RunState';

describe('placeTraps', () => {
  it('places at least 1 trap on a typical dungeon', () => {
    const rng = Rng.fromSeed(1);
    const d = generateBspDungeon(40, 30, rng);
    const traps = placeTraps(d, rng, { floor: 1 });
    expect(traps.length).toBeGreaterThan(0);
  });

  it('caps floor 1 at 2 traps', () => {
    const rng = Rng.fromSeed(7);
    const d = generateBspDungeon(40, 30, rng);
    const traps = placeTraps(d, rng, { floor: 1, count: 99 });
    expect(traps.length).toBeLessThanOrEqual(2);
  });

  it('avoids the player start and stairs tiles', () => {
    const rng = Rng.fromSeed(99);
    const d = generateBspDungeon(40, 30, rng);
    const traps = placeTraps(d, rng, { floor: 5, count: 30 });
    for (const t of traps) {
      expect(`${t.pos.x},${t.pos.y}`).not.toBe(`${d.playerStart.x},${d.playerStart.y}`);
      expect(`${t.pos.x},${t.pos.y}`).not.toBe(`${d.stairsDown.x},${d.stairsDown.y}`);
    }
  });

  it('all placed traps start hidden', () => {
    const rng = Rng.fromSeed(42);
    const d = generateBspDungeon(40, 30, rng);
    const traps = placeTraps(d, rng, { floor: 3 });
    for (const t of traps) expect(t.revealed).toBe(false);
  });

  it('produces deterministic output for the same seed', () => {
    const a = placeTraps(
      generateBspDungeon(40, 30, Rng.fromSeed(42)),
      Rng.fromSeed(42),
      { floor: 3 },
    );
    const b = placeTraps(
      generateBspDungeon(40, 30, Rng.fromSeed(42)),
      Rng.fromSeed(42),
      { floor: 3 },
    );
    expect(a).toEqual(b);
  });
});

describe('triggerTrap', () => {
  const rng = Rng.fromSeed(123);

  it('spike trap: 5–8 damage and bleed status', () => {
    const trap: TrapState = { pos: { x: 0, y: 0 }, kind: 'spike', revealed: false };
    const r = triggerTrap(trap, rng);
    expect(r.damage).toBeGreaterThanOrEqual(5);
    expect(r.damage).toBeLessThanOrEqual(8);
    expect(r.applyStatusToTrigger?.id).toBe('bleed');
    expect(r.consumed).toBe(true);
  });

  it('gas trap: 0 damage, 3x3 AoE, poisoned status', () => {
    const trap: TrapState = { pos: { x: 5, y: 5 }, kind: 'gas', revealed: false };
    const r = triggerTrap(trap, rng);
    expect(r.damage).toBe(0);
    expect(r.aoeTiles?.length).toBe(9);
    expect(r.applyStatusToAoe?.id).toBe('poisoned');
  });

  it('alarm trap: 0 damage, alarm radius 10', () => {
    const trap: TrapState = { pos: { x: 0, y: 0 }, kind: 'alarm', revealed: false };
    const r = triggerTrap(trap, rng);
    expect(r.damage).toBe(0);
    expect(r.alarmRadius).toBe(10);
    expect(r.applyStatusToTrigger).toBeUndefined();
  });
});

describe('rollPerception', () => {
  it('always succeeds at perception 1', () => {
    const rng = Rng.fromSeed(1);
    for (let i = 0; i < 20; i++) expect(rollPerception(1, rng)).toBe(true);
  });
  it('always fails at perception 0', () => {
    const rng = Rng.fromSeed(1);
    for (let i = 0; i < 20; i++) expect(rollPerception(0, rng)).toBe(false);
  });
  it('mid-range produces a mix', () => {
    const rng = Rng.fromSeed(1);
    let hits = 0;
    for (let i = 0; i < 200; i++) if (rollPerception(0.5, rng)) hits++;
    expect(hits).toBeGreaterThan(50);
    expect(hits).toBeLessThan(150);
  });
});

describe('isAdjacent', () => {
  it('same tile counts as adjacent', () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
  });
  it('cardinal neighbour is adjacent', () => {
    expect(isAdjacent({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
  it('diagonal neighbour is adjacent', () => {
    expect(isAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
  });
  it('two tiles away is not adjacent', () => {
    expect(isAdjacent({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });
});
