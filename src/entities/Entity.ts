import type { Point } from '@/core/Grid';

export interface CombatStats {
  hp: number;
  hpMax: number;
  power: number;
  armor: number;
}

let nextId = 1;
export const nextEntityId = (): number => nextId++;

/**
 * Base actor on the grid. Plain data with a few helpers — no rendering, no Phaser.
 */
export abstract class Entity {
  readonly id: number;
  pos: Point;
  stats: CombatStats;
  alive = true;

  constructor(pos: Point, stats: CombatStats) {
    this.id = nextEntityId();
    this.pos = { x: pos.x, y: pos.y };
    this.stats = { ...stats };
  }

  abstract get kind(): string;
  abstract get displayName(): string;
}
