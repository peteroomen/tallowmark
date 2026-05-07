/**
 * Status-effect catalog. Pairs each StatusId with its per-tick behaviour,
 * static modifiers, and HUD presentation.
 *
 * The catalog is *runtime-only* — it holds lambdas that mutate entities.
 * The matching JSON-serialisable instance shape is `ActiveStatus`
 * (`{ id, turnsRemaining }`) on `RunState` and on each `Enemy`.
 *
 * Adding a new status = one entry here + one branch in any code that
 * cares about the status by name (e.g. movement mirror for `confused`).
 *
 * **Visual grammar (per refinement-002 §B)** — every status has three
 * fields that drive the HUD icon:
 *   - `glyph`  — the *concept* (cross / shield / drop / swirl / …).
 *                Tied to category, not flavour. Bleed and Poisoned share
 *                'drop' because they're both fluid leaving you.
 *   - `color`  — the *valence* (green buff, red debuff, etc.). Same
 *                palette as the log-line tones so log + status read as
 *                one system.
 *   - `frameStyle` — the *kind* (solid = buff, dashed = debuff, double =
 *                control). Colourblind-safe duplicate of color.
 */

export type StatusId = 'healing' | 'fortitude' | 'poisoned' | 'confused' | 'bleed';

/** Drawing primitive for the icon's central glyph. */
export type GlyphId =
  | 'cross'
  | 'shield'
  | 'drop'
  | 'swirl'
  | 'flame'
  | 'snowflake'
  | 'star'
  | 'heart'
  | 'arrow_up'
  | 'arrow_down';

/** Border treatment for the icon — encodes status kind for colourblind safety. */
export type FrameStyle = 'solid' | 'dashed' | 'double';

/**
 * Minimal interface a status's `tick` function uses to affect its target.
 * The same tick code drives the player and enemies — the target wraps the
 * relevant entity's stats and exposes only `damage` and `heal`.
 */
export interface StatusTarget {
  /** Apply N damage to the target. Returns the actual amount dealt (clamped). */
  damage: (amount: number) => number;
  /** Restore N HP. Returns the actual amount healed (clamped to maxHP). */
  heal: (amount: number) => number;
  /** True if the target died from a tick this round. */
  isDead: () => boolean;
}

export interface StatusDef {
  id: StatusId;
  /** Short HUD label, e.g. "Fort" or "Psn". */
  label: string;
  /** Programmatic glyph drawn at the icon's centre. */
  glyph: GlyphId;
  /** Border treatment encoding category (buff / debuff / control). */
  frameStyle: FrameStyle;
  /** Hex colour for icon tint + countdown text + frame. */
  color: string;
  /** Per-turn tick. Return true to expire early. */
  tick?: (target: StatusTarget) => boolean | void;
  /** Static +armor bonus applied while active. */
  armorBonus?: number;
}

export const STATUS_CATALOG: Record<StatusId, StatusDef> = {
  healing: {
    id: 'healing',
    label: 'Reg',
    glyph: 'cross',
    frameStyle: 'solid',
    color: '#6fb84a',
    tick: (t) => {
      t.heal(1);
    },
  },
  fortitude: {
    id: 'fortitude',
    label: 'Fort',
    glyph: 'shield',
    frameStyle: 'solid',
    color: '#cfa64a',
    armorBonus: 2,
  },
  poisoned: {
    id: 'poisoned',
    label: 'Psn',
    glyph: 'drop',
    frameStyle: 'dashed',
    color: '#7a4ab8',
    tick: (t) => {
      t.damage(1);
    },
  },
  confused: {
    id: 'confused',
    label: 'Cnf',
    glyph: 'swirl',
    frameStyle: 'double',
    color: '#d6a64a',
  },
  bleed: {
    id: 'bleed',
    label: 'Bld',
    glyph: 'drop',
    frameStyle: 'dashed',
    color: '#b8403a',
    tick: (t) => {
      t.damage(1);
    },
  },
};

export const ALL_STATUS_IDS: ReadonlyArray<StatusId> = Object.keys(STATUS_CATALOG) as StatusId[];
