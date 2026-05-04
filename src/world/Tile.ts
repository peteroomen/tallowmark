export const enum TileKind {
  Wall = 0,
  Floor = 1,
  Door = 2,
  StairsDown = 3,
  StairsUp = 4,
}

export interface TileDef {
  kind: TileKind;
  walkable: boolean;
  opaque: boolean;
  /** Sprite frame index in the RPG spritesheet (1024 frames at 16x16). */
  iconFrame: number;
}

// Frame indices reference the kenney_roguelike-rpg-pack sheet
// (57 cols × 31 rows, 1px gutter). These are reasonable defaults; we can
// re-pick after we render the sheet and eyeball it.
const FLOOR_FRAME = 6 * 57 + 0; // a generic stone floor
const WALL_FRAME = 9 * 57 + 10; // a generic wall block
const DOOR_FRAME = 7 * 57 + 14;
const STAIRS_DOWN_FRAME = 8 * 57 + 13;
const STAIRS_UP_FRAME = 8 * 57 + 12;

export const TILES: Record<TileKind, TileDef> = {
  [TileKind.Wall]: { kind: TileKind.Wall, walkable: false, opaque: true, iconFrame: WALL_FRAME },
  [TileKind.Floor]: { kind: TileKind.Floor, walkable: true, opaque: false, iconFrame: FLOOR_FRAME },
  [TileKind.Door]: { kind: TileKind.Door, walkable: true, opaque: false, iconFrame: DOOR_FRAME },
  [TileKind.StairsDown]: {
    kind: TileKind.StairsDown,
    walkable: true,
    opaque: false,
    iconFrame: STAIRS_DOWN_FRAME,
  },
  [TileKind.StairsUp]: {
    kind: TileKind.StairsUp,
    walkable: true,
    opaque: false,
    iconFrame: STAIRS_UP_FRAME,
  },
};
