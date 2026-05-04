import type { Point } from '@/core/Grid';
import { Entity, type CombatStats } from './Entity';

export class Player extends Entity {
  override get kind(): string {
    return 'player';
  }
  override get displayName(): string {
    return 'You';
  }

  constructor(pos: Point, stats: CombatStats) {
    super(pos, stats);
  }
}
