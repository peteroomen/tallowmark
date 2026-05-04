/**
 * Single source of truth for which sprite-sheet frame represents what.
 *
 * Frame indices marked CONFIRMED were verified against the labeled DebugSheetScene
 * (F9 in dev). Frames marked TODO are educated guesses that need a visual pass —
 * use the debug scene to re-pick them.
 *
 * Sheets:
 *   - rpg-pack ............ 57 cols × 31 rows  (16px tiles, 1px gutter)
 *   - chars  .............. 54 cols × 12 rows  (16px tiles, 1px gutter)
 *   - ui large (packed) ... 13 cols × 7 rows   (32px tiles, no gutter)
 *   - ui small (packed) ... 23 cols × 7 rows   (16px tiles, no gutter)
 *   - input prompts ....... 34 cols × 24 rows  (16px tiles, no gutter)
 */

const RPG_COLS = 57;
const CHARS_COLS = 54;
const UI_LARGE_COLS = 13;
const UI_SMALL_COLS = 23;
const INPUT_COLS = 34;

const rpg = (col: number, row: number): number => row * RPG_COLS + col;
const chars = (col: number, row: number): number => row * CHARS_COLS + col;
const uiL = (col: number, row: number): number => row * UI_LARGE_COLS + col;
const inp = (col: number, row: number): number => row * INPUT_COLS + col;

export const RPG_GRID = { cols: RPG_COLS, rows: 31 } as const;
export const CHARS_GRID = { cols: CHARS_COLS, rows: 12 } as const;
export const UI_LARGE_GRID = { cols: UI_LARGE_COLS, rows: 7 } as const;
export const UI_SMALL_GRID = { cols: UI_SMALL_COLS, rows: 7 } as const;
export const INPUT_GRID = { cols: INPUT_COLS, rows: 24 } as const;

/**
 * World tiles from the rpg-pack.
 *
 * CONFIRMED: grass, water, trees — visually verified at scale 4× in DebugSheetScene.
 * TODO: walls, doors, stairs frames need to be re-picked via the debug scene.
 *       For now, scenes draw walls/buildings as palette-tinted rectangles instead
 *       of relying on guessed frames.
 */
export const TilesRPG = {
  // CONFIRMED — outdoor terrain
  grass: rpg(5, 0),
  grassAlt: rpg(4, 0),
  dirt: rpg(7, 0),
  pathStone: rpg(8, 0),
  water: rpg(3, 1),
  tree: rpg(13, 10),
  treeDark: rpg(14, 10),

  // TODO — these still need eyeballing in the debug scene before they look right.
  // Until then, scenes that need these elements should draw rectangles instead.
  flower: rpg(0, 9),
  signpost: rpg(33, 6),
  fenceH: rpg(2, 22),
  fenceV: rpg(3, 22),
  stoneFloor: rpg(7, 13),
  stoneFloorAlt: rpg(8, 13),
  stoneWall: rpg(10, 17),
  stoneWallTop: rpg(10, 16),
  stoneArch: rpg(20, 13),
  woodWall: rpg(1, 9),
  brickWall: rpg(2, 9),
  roofRedTL: rpg(0, 19),
  roofRedT: rpg(1, 19),
  roofRedTR: rpg(2, 19),
  roofRedBL: rpg(0, 21),
  roofRedB: rpg(1, 21),
  roofRedBR: rpg(2, 21),
  doorClosed: rpg(15, 4),
  doorOpen: rpg(15, 3),
  windowSquare: rpg(20, 4),
  windowArch: rpg(21, 4),
  stairsDown: rpg(33, 13),
  stairsUp: rpg(34, 13),
  potionRed: rpg(40, 9),
  potionBlue: rpg(41, 9),
  scroll: rpg(43, 8),
  swordBasic: rpg(45, 9),
  shieldBasic: rpg(48, 9),
  coin: rpg(41, 10),
} as const;

/**
 * Characters and enemies from the chars-pack. CONFIRMED via debug scene.
 *
 * - Column 0 of the chars sheet is full-body composed character sprites.
 * - Frame 432 (col 0, row 8) = bearded warrior in red — used as the player.
 * - Frame 162 (col 0, row 3) = green goblin — used as the v1 enemy.
 */
export const CharsSheet = {
  player: chars(0, 8),
  goblin: chars(0, 3),
  warriorBlue: chars(0, 9),
  oldMan: chars(0, 5),
  villagerOrange: chars(0, 4),
  villagerBald: chars(0, 0),
} as const;

/**
 * UI Large sheet — single-tile complete buttons. Use Phaser's `add.nineslice`
 * with one of these as the source frame to make resizable buttons/panels with
 * crisp corners.
 */
export const UiLarge = {
  buttonCream: uiL(0, 0),
  buttonBrown: uiL(1, 0),
  buttonBlue: uiL(2, 0),
  buttonGrey: uiL(3, 0),
} as const;

/**
 * Input-prompt frames for the controls hint footer.
 * TODO: confirm these via the debug scene.
 */
export const Inputs = {
  keyW: inp(17, 9),
  keyA: inp(13, 9),
  keyS: inp(15, 9),
  keyD: inp(16, 9),
  keyEsc: inp(0, 9),
  keyI: inp(20, 9),
  keyC: inp(15, 9),
  arrowUp: inp(13, 0),
  arrowDown: inp(15, 0),
  arrowLeft: inp(14, 0),
  arrowRight: inp(16, 0),
  mouseLeft: inp(0, 17),
  mouseRight: inp(1, 17),
} as const;
