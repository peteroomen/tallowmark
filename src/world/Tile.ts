import { TilesRPG } from './FrameCatalog';

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
  /** Sprite frame index in the rpg-pack spritesheet. */
  iconFrame: number;
}

export const TILES: Record<TileKind, TileDef> = {
  [TileKind.Wall]: { kind: TileKind.Wall, walkable: false, opaque: true, iconFrame: TilesRPG.stoneWall },
  [TileKind.Floor]: { kind: TileKind.Floor, walkable: true, opaque: false, iconFrame: TilesRPG.stoneFloor },
  [TileKind.Door]: { kind: TileKind.Door, walkable: true, opaque: false, iconFrame: TilesRPG.doorWood },
  [TileKind.StairsDown]: {
    kind: TileKind.StairsDown,
    walkable: true,
    opaque: false,
    iconFrame: TilesRPG.stairsDown,
  },
  [TileKind.StairsUp]: {
    kind: TileKind.StairsUp,
    walkable: true,
    opaque: false,
    iconFrame: TilesRPG.stairsUp,
  },
};
