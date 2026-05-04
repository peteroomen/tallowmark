import * as ROT from 'rot-js';
import type { Point } from './Grid';

export type OpaqueFn = (x: number, y: number) => boolean;

/**
 * Computes the set of tiles visible from a given origin within radius.
 * Backed by rot.js precise shadowcasting.
 *
 * v1 callers may not actually use this (full reveal), but the implementation
 * is wired so that turning FOV on later is a one-line change.
 */
export function computeFov(origin: Point, radius: number, isOpaque: OpaqueFn): Set<string> {
  const visible = new Set<string>();
  const fov = new ROT.FOV.PreciseShadowcasting((x, y) => !isOpaque(x, y));
  fov.compute(origin.x, origin.y, radius, (x, y) => {
    visible.add(`${x},${y}`);
  });
  return visible;
}

export const fovKey = (x: number, y: number): string => `${x},${y}`;
