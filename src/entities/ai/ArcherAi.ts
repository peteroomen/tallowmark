/**
 * Skeleton Archer AI — the iter-2 stage 9 archetype.
 *
 * Maintains 3-5 tile distance from the player. If player is in a straight
 * line of sight within 5 tiles → fire. If too close → retreat. If too far
 * → advance one tile. Glass cannon: low HP, decent ranged damage, no armour.
 *
 * The fire hook (`fireProjectile` on the AI context) is implementation-
 * specific to the scene since rendering an arrow tween + resolving damage
 * needs Phaser. The AI itself is Phaser-free and unit-testable.
 */

import type { Enemy, EnemyAi, EnemyAiContext } from '@/entities/Enemy';
import { chebyshev, DIRS_8, type Point } from '@/core/Grid';
import { hasLineOfSight } from '@/core/Bresenham';

const SIGHT_RADIUS = 8;
const FIRE_RANGE = 5;
const RETREAT_BAND = 3; // < this distance → retreat

export interface ArcherAiContext extends EnemyAiContext {
  /** Returns true if a tile blocks vision (walls, doors). */
  isOpaque: (x: number, y: number) => boolean;
  /** Spawn an arrow projectile from `self` to `target`, then deal damage. */
  fireProjectile: (self: Enemy, target: Point) => void;
}

export class ArcherAi implements EnemyAi {
  takeTurn(self: Enemy, ctx: EnemyAiContext): boolean {
    if (!self.alive) return false;
    // Narrow the context — the dungeon scene passes the extended interface.
    const ax = ctx as ArcherAiContext;
    if (!ax.isOpaque || !ax.fireProjectile) return false;

    const dist = chebyshev(self.pos, ctx.playerPos);
    if (dist > SIGHT_RADIUS && self.alarmedTurns <= 0) return false;

    // Fire if in range AND has clean line of sight.
    if (dist <= FIRE_RANGE && hasLineOfSight(self.pos, ctx.playerPos, ax.isOpaque)) {
      ax.fireProjectile(self, ctx.playerPos);
      return true;
    }

    // Too close → retreat (player is in melee distance).
    if (dist < RETREAT_BAND) {
      const fled = stepAwayFrom(self, ctx);
      if (fled) {
        ctx.moveEnemy(self, fled);
        return true;
      }
      // Cornered — fight back at point-blank if possible.
      if (dist === 1) {
        ctx.attackPlayer(self);
        return true;
      }
    }

    // Too far → close one step toward player so we can fire next turn.
    const closer = stepToward(self, ctx);
    if (closer) {
      ctx.moveEnemy(self, closer);
      return true;
    }

    return false;
  }
}

function stepAwayFrom(self: Enemy, ctx: EnemyAiContext): Point | null {
  let best: Point | null = null;
  let bestDist = chebyshev(self.pos, ctx.playerPos);
  for (const d of DIRS_8) {
    const cand = { x: self.pos.x + d.x, y: self.pos.y + d.y };
    if (!ctx.isWalkable(cand.x, cand.y)) continue;
    if (ctx.enemyAt(cand.x, cand.y)) continue;
    if (cand.x === ctx.playerPos.x && cand.y === ctx.playerPos.y) continue;
    const d2 = chebyshev(cand, ctx.playerPos);
    if (d2 > bestDist) {
      bestDist = d2;
      best = cand;
    }
  }
  return best;
}

function stepToward(self: Enemy, ctx: EnemyAiContext): Point | null {
  let best: Point | null = null;
  let bestDist = chebyshev(self.pos, ctx.playerPos);
  for (const d of DIRS_8) {
    const cand = { x: self.pos.x + d.x, y: self.pos.y + d.y };
    if (!ctx.isWalkable(cand.x, cand.y)) continue;
    if (ctx.enemyAt(cand.x, cand.y)) continue;
    const d2 = chebyshev(cand, ctx.playerPos);
    if (d2 < bestDist) {
      bestDist = d2;
      best = cand;
    }
  }
  return best;
}
