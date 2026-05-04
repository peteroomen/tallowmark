import { describe, expect, it } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { Rng } from '@/core/Rng';

describe('CombatSystem', () => {
  it('produces deterministic damage for the same seed', () => {
    const cs1 = new CombatSystem(Rng.fromSeed(1));
    const cs2 = new CombatSystem(Rng.fromSeed(1));
    const a = { hp: 10, hpMax: 10, power: 5, armor: 1 };
    const d = { hp: 10, hpMax: 10, power: 0, armor: 2 };
    const r1 = cs1.resolveAttack(a, d);
    const r2 = cs2.resolveAttack(a, d);
    expect(r1).toEqual(r2);
  });

  it('always inflicts at least 1 damage on a hit', () => {
    const cs = new CombatSystem(Rng.fromSeed(7));
    const weak = { hp: 10, hpMax: 10, power: 0, armor: 0 };
    const tank = { hp: 10, hpMax: 10, power: 0, armor: 99 };
    for (let i = 0; i < 100; i++) {
      const r = cs.resolveAttack(weak, tank);
      expect(r.damage).toBeGreaterThanOrEqual(1);
    }
  });

  it('flags killed when damage meets or exceeds defender hp', () => {
    const cs = new CombatSystem(Rng.fromSeed(2));
    const a = { hp: 10, hpMax: 10, power: 100, armor: 0 };
    const d = { hp: 1, hpMax: 1, power: 0, armor: 0 };
    expect(cs.resolveAttack(a, d).killed).toBe(true);
  });

  it('applyDamage reduces hp without going below 0', () => {
    const cs = new CombatSystem(Rng.fromSeed(3));
    const target = { hp: 5, hpMax: 10, power: 0, armor: 0 };
    cs.applyDamage(target, { damage: 100, attackerRoll: 0, defenderMitigation: 0, killed: true });
    expect(target.hp).toBe(0);
  });
});
