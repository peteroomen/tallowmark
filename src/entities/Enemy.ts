import type { Point } from '@/core/Grid';
import { Entity, type CombatStats } from './Entity';

export interface EnemyAi {
  /** Called once per world tick. Returns true if the enemy acted. */
  takeTurn(self: Enemy, ctx: EnemyAiContext): boolean;
}

export interface EnemyAiContext {
  isWalkable: (x: number, y: number) => boolean;
  enemyAt: (x: number, y: number) => Enemy | null;
  playerPos: Point;
  attackPlayer: (attacker: Enemy) => void;
  moveEnemy: (enemy: Enemy, to: Point) => void;
}

export class Enemy extends Entity {
  constructor(
    pos: Point,
    stats: CombatStats,
    private readonly _kind: string,
    private readonly _displayName: string,
    public ai: EnemyAi,
  ) {
    super(pos, stats);
  }

  override get kind(): string {
    return this._kind;
  }
  override get displayName(): string {
    return this._displayName;
  }
}
