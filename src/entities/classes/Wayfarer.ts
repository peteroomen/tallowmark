/**
 * The Wayfarer — iter-2's default starting class.
 *
 * Stats per refinement-001 / roadmap iter-2 stage 11. Starting kit is
 * 1× Hardtack (so the player has at least a snack) plus 1× random
 * unidentified potion (so the very first inventory has the
 * identification mystery from turn one).
 */

import type { ClassBlueprint } from './ClassBlueprint';

export const Wayfarer: ClassBlueprint = {
  id: 'wayfarer',
  displayName: 'Wayfarer',
  tagline: 'Walked here. Will walk back, if able.',
  baseStats: {
    hp: 30,
    hpMax: 30,
    power: 5,
    armor: 1,
    perception: 0.3,
  },
  food: 200,
  foodMax: 200,
  startingKit: [
    { kind: 'fixed', defId: 'food_hardtack', count: 1 },
    {
      kind: 'pickOne',
      pool: ['potion_healing', 'potion_fortitude', 'potion_poison'],
      count: 1,
    },
  ],
};
