/**
 * Action targets — the things a player can perform a verb on.
 *
 * The discriminated union below is what `Resolver.resolve(target)` consumes
 * to produce a slot list. Adding a new target kind in iter-4+ (e.g. 'spell'
 * for cast surfaces) = one entry here + one resolver branch.
 *
 * Pure data — no Phaser refs, no scene refs. Targets are *descriptions*
 * of game-state things (a tile coord, an enemy id, an inventory slot
 * index), not the rendered objects themselves.
 */

import type { Point } from '@/core/Grid';

/**
 * The player themself — used by the bottom-right "Action" button on the
 * HUD which opens a self-target wheel (Wait / Search / Inventory / etc.)
 */
export interface SelfTarget {
  kind: 'self';
}

/** A specific tile on the dungeon floor (no enemy / item / trap on it). */
export interface FloorTileTarget {
  kind: 'floor_tile';
  pos: Point;
}

/** A live, visible enemy. */
export interface EnemyTarget {
  kind: 'enemy';
  pos: Point;
  enemyId: number;
}

/** An item lying on the floor (revealed, in current FoV). */
export interface ItemOnFloorTarget {
  kind: 'item_on_floor';
  pos: Point;
  defId: string;
}

/** An inventory slot — the player long-pressed a slot in the bag UI. */
export interface ItemInBagTarget {
  kind: 'item_in_bag';
  slotIndex: number;
  defId: string;
}

/** A stairs tile (up or down). */
export interface StairsTarget {
  kind: 'stairs';
  direction: 'down' | 'up';
  pos: Point;
}

/** A revealed trap on the floor. */
export interface TrapTarget {
  kind: 'trap';
  pos: Point;
  trapKind: 'spike' | 'gas' | 'alarm';
}

/** A wall / unwalkable tile (typically returns no verbs). */
export interface WallTarget {
  kind: 'wall';
  pos: Point;
}

export type Target =
  | SelfTarget
  | FloorTileTarget
  | EnemyTarget
  | ItemOnFloorTarget
  | ItemInBagTarget
  | StairsTarget
  | TrapTarget
  | WallTarget;
