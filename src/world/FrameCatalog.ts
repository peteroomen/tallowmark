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
 * Frame indices verified at 3× scale via DebugSheetScene's chunked views
 * (rpg-pack rendered as a 3×3 grid of view chunks; F9 → TAB to walk through).
 *
 * The water and tree frames are the high-leverage decorative wins for the
 * town. Building wall/roof/door composition stays deferred — composing a
 * good-looking multi-tile building from individual tiles needs more
 * iteration than is worth right now; the rectangle buildings read as clean
 * placeholders and the surrounding decorations (trees, bushes, fences, rocks,
 * proper water) carry the visual weight.
 */
export const TilesRPG = {
  // Outdoor terrain (CONFIRMED)
  grass: rpg(5, 0),
  grassAlt: rpg(4, 0),
  dirt: rpg(7, 0),
  pathStone: rpg(8, 0),

  // Water 9-slice (CONFIRMED) — atlas at cols 2-4, rows 0-2.
  // Use these to draw a multi-tile water body with grass shores.
  waterTL: rpg(2, 0), // frame 2
  waterT: rpg(3, 0), // 3
  waterTR: rpg(4, 0), // 4
  waterL: rpg(2, 1), // 59
  waterC: rpg(3, 1), // 60 — also: full water alone
  waterR: rpg(4, 1), // 61
  waterBL: rpg(2, 2), // 116
  waterB: rpg(3, 2), // 117
  waterBR: rpg(4, 2), // 118
  /** Alias for the central water tile; useful when the renderer just wants water. */
  water: rpg(3, 1),

  // Trees (CONFIRMED) — overhead "world map" style.
  treeRound: rpg(13, 9), // 526 — full green round canopy
  treeOrangeRound: rpg(15, 9), // 528 — orange round canopy
  treeAutumn: rpg(13, 10), // 583 — small autumn-orange tree
  treePine: rpg(17, 10), // 587 — small green pine
  treePineDark: rpg(18, 10), // 588 — taller dark-green pine
  treeBare: rpg(27, 10), // 597 — bare leafless tree

  // Bushes / shrubs (CONFIRMED) — row 9 cols 19-25 area.
  bushGreen: rpg(19, 9), // 532
  bushOrange: rpg(20, 9), // 533 — pumpkin
  bushDarkGreen: rpg(22, 9), // 535
  bushSmall: rpg(23, 9), // 536

  // Fences (CONFIRMED) — row 23 cols 46-50 area.
  fenceH: rpg(46, 23), // 1357 — horizontal segment
  fenceHMid: rpg(47, 23), // 1358
  fenceHEnd: rpg(49, 23), // 1360 — end cap
  fencePost: rpg(50, 23), // 1361 — vertical post

  // Decoration (CONFIRMED) — rocks and debris.
  rockSmall: rpg(54, 22), // 1308

  // Dungeon entrance (CONFIRMED) — stone tomb arch, frame 624.
  dungeonStoneArch: rpg(54, 10),

  // Additional outdoor decorations — verified via DebugSheetScene at 3× scale.
  // Tents, campfire, anvil (row 0 cols 10-15)
  tentGreenL: rpg(10, 0), // 10 — left half of green tent
  tentGreenR: rpg(11, 0), // 11 — right half
  campfireUnlit: rpg(12, 0), // 12 — logs only
  campfireLit: rpg(13, 0), // 13 — small flame
  campfireBig: rpg(14, 0), // 14 — bigger flame
  anvil: rpg(15, 0), // 15

  // Barrels, crate, tent bases, market table (row 1 cols 5-12)
  barrelsH: rpg(5, 1), // 62 — pair of barrels
  crateWood: rpg(7, 1), // 64
  tentGreenBaseL: rpg(10, 1), // 67
  tentGreenBaseR: rpg(11, 1), // 68
  tableMkt: rpg(12, 1), // 69 — market table

  // Awning stripes (row 2 cols 10-12) — for market stalls
  awningStripeL: rpg(10, 2), // 124
  awningStripeC: rpg(11, 2), // 125
  awningStripeR: rpg(12, 2), // 126

  // Mushrooms (row 3 cols 5-6)
  mushroomSmall: rpg(5, 3), // 176
  mushroomTall: rpg(6, 3), // 177

  // Well (row 5 col 12)
  wellStone: rpg(12, 5), // 297

  // Flowers
  flowerWhite: rpg(0, 9), // 513
  flowerRed: rpg(0, 6), // 342

  // Gravestones (row 9 cols 7-9)
  gravestone1: rpg(7, 9), // 520
  gravestone2: rpg(8, 9), // 521
  gravestone3: rpg(9, 9), // 522

  // Stone crosses (row 10 cols 5-6)
  crossStone: rpg(5, 10), // 575
  crossWood: rpg(6, 10), // 576

  // Doors / windows (CONFIRMED at column 38+ in row 0)
  doorWood: rpg(38, 0), // 38
  doorWoodTall: rpg(40, 0),
  windowArch: rpg(44, 0),
  windowSquare: rpg(43, 1), // 100

  // Items — used by future inventory work; eyeballed and not yet verified.
  potionRed: rpg(40, 9),
  potionBlue: rpg(41, 9),
  scroll: rpg(43, 8),
  swordBasic: rpg(45, 9),
  shieldBasic: rpg(48, 9),
  coin: rpg(41, 10),

  // Dungeon (still TODO — wall/floor stay as rectangles in DungeonScene)
  stoneFloor: rpg(7, 13),
  stoneWall: rpg(10, 17),
  stairsDown: rpg(33, 13),
  stairsUp: rpg(34, 13),
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
 *
 * Frame indices verified at 2× scale via DebugSheetScene (F9 → TAB to ui-large).
 */
export const UiLarge = {
  // Beveled square buttons — base for nine-slice scaling.
  buttonCream: uiL(0, 0), // ivory / parchment
  buttonBrown: uiL(1, 0), // wood (primary)
  buttonSlate: uiL(2, 0), // light slate-blue
  buttonGrey: uiL(3, 0), // dark slate (secondary)
  buttonDark: uiL(8, 0), // near-black with bevel (dark variant base)
  // Red-outlined cream button — used for destructive actions when a tint
  // overlay isn't appropriate. Frame 33 in the sheet (col 7, row 2).
  buttonRedOutlined: uiL(7, 2),

  // Hexagon badges — for floor-number / status pills.
  hexCream: uiL(0, 5),
  hexBrown: uiL(1, 5),
  hexSlate: uiL(2, 5),
  hexDark: uiL(3, 5),
  hexRed: uiL(2, 6),
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
