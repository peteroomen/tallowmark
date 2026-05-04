import type { Rng } from '@/core/Rng';
import type { CombatStats } from '@/entities/Entity';

export interface DamageResult {
  damage: number;
  attackerRoll: number;
  defenderMitigation: number;
  killed: boolean;
}

/**
 * Bump-combat damage resolution.
 *
 * Final damage = max(1, (attackerPower + 1d4) - (defenderArmor + 1d3 mitigation))
 *
 * Minimum 1 damage on a successful hit so combat never deadlocks. The ±1d3
 * mitigation roll provides variance so identical stats don't produce identical
 * fights.
 */
export class CombatSystem {
  constructor(private readonly rng: Rng) {}

  resolveAttack(attacker: CombatStats, defender: CombatStats): DamageResult {
    const attackerRoll = this.rng.roll(1, 4);
    const defenderMitigation = this.rng.roll(1, 3);
    const raw = attacker.power + attackerRoll - (defender.armor + defenderMitigation);
    const damage = Math.max(1, raw);
    const killed = defender.hp - damage <= 0;
    return { damage, attackerRoll, defenderMitigation, killed };
  }

  /** Apply damage to a stats record in place. Returns the same DamageResult for chaining. */
  applyDamage(target: CombatStats, result: DamageResult): DamageResult {
    target.hp = Math.max(0, target.hp - result.damage);
    return result;
  }
}
