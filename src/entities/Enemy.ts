import type { Point } from '@/core/Grid';
import type { ActiveStatus } from '@/state/RunState';
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
  /** Optional — supplied by DungeonScene to support ranged AIs (Archer). */
  isOpaque?: (x: number, y: number) => boolean;
  fireProjectile?: (self: Enemy, target: Point) => void;
}

export class Enemy extends Entity {
  /**
   * Active statuses on this enemy (poisoned, bleed, etc.). Populated when
   * the player applies a status via combat (e.g. a Poison-rune weapon)
   * or a thrown potion. Ticks happen on the world tick alongside player
   * statuses; `DungeonScene.runEnemyTurns` ticks each enemy's bag.
   */
  public statuses: ActiveStatus[] = [];

  /**
   * Force-aggro counter: while > 0, AI chases the player regardless of
   * sight radius or LoS. Decremented per world tick in DungeonScene. Set
   * by the alarm trap (and future stage-9 ranged-tag mechanics).
   */
  public alarmedTurns = 0;

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
