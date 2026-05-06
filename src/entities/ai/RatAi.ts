import type { Enemy, EnemyAi, EnemyAiContext } from '@/entities/Enemy';
import { chebyshev, DIRS_8, type Point } from '@/core/Grid';
import { findPath } from '@/core/Pathfinding';

const SIGHT_RADIUS = 8;

/**
 * Naive chase AI: if the player is within sight, take one step along an A* path
 * toward them. If adjacent, bump-attack. Otherwise idle.
 */
export class RatAi implements EnemyAi {
  takeTurn(self: Enemy, ctx: EnemyAiContext): boolean {
    if (!self.alive) return false;

    const dist = chebyshev(self.pos, ctx.playerPos);
    // Alarmed enemies ignore sight: an alarm trap broadcasted the player's
    // position so they chase regardless. Decrements per world tick.
    if (dist > SIGHT_RADIUS && self.alarmedTurns <= 0) return false;

    if (dist === 1) {
      ctx.attackPlayer(self);
      return true;
    }

    const isPathable = (x: number, y: number) => {
      if (!ctx.isWalkable(x, y)) return false;
      // Allow stepping into the player tile (we check adjacency above first;
      // if we're 2 tiles away the path's first step won't be onto the player).
      const occupant = ctx.enemyAt(x, y);
      if (occupant && occupant !== self) return false;
      return true;
    };

    const path = findPath(self.pos, ctx.playerPos, isPathable);
    // Path includes start at index 0, so the next step is index 1.
    const next = path[1];
    if (next && !ctx.enemyAt(next.x, next.y)) {
      ctx.moveEnemy(self, next);
      return true;
    }

    // Fallback: try a greedy step toward the player.
    let best: Point | null = null;
    let bestDist = dist;
    for (const d of DIRS_8) {
      const cand = { x: self.pos.x + d.x, y: self.pos.y + d.y };
      if (!isPathable(cand.x, cand.y)) continue;
      const cd = chebyshev(cand, ctx.playerPos);
      if (cd < bestDist) {
        bestDist = cd;
        best = cand;
      }
    }
    if (best) {
      ctx.moveEnemy(self, best);
      return true;
    }
    return false;
  }
}
