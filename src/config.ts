/** Game-wide constants. Anything tunable lives here. */

export const TILE_SIZE_SOURCE = 16;
export const RENDER_SCALE = 3;
export const TILE_SIZE = TILE_SIZE_SOURCE * RENDER_SCALE; // 48px effective

export const VIEWPORT_TILES_W = 24;
export const VIEWPORT_TILES_H = 16;

export const GAME_WIDTH = VIEWPORT_TILES_W * TILE_SIZE;
export const GAME_HEIGHT = VIEWPORT_TILES_H * TILE_SIZE;

export const SAVE_KEY = 'tallowmark:save:v1';

export const DUNGEON_W = 60;
export const DUNGEON_H = 40;

export const COLORS = {
  bg: 0x0b0b10,
  panel: 0x1a1a24,
  panelBorder: 0x3a3a4a,
  text: 0xe5e3d8,
  textDim: 0x9a988e,
  accent: 0xd4a24c,
  danger: 0xb84a4a,
  success: 0x6aa84a,
} as const;

export const SCENE_KEYS = {
  Boot: 'Boot',
  MainMenu: 'MainMenu',
  Settings: 'Settings',
  Town: 'Town',
  Dungeon: 'Dungeon',
  UI: 'UI',
  Pause: 'Pause',
  Inventory: 'Inventory',
  Equipment: 'Equipment',
  Character: 'Character',
  DeathSummary: 'DeathSummary',
  ConfirmDialog: 'ConfirmDialog',
} as const;

export const ASSET_KEYS = {
  sprites: {
    rpg: 'sprite-rpg',
    chars: 'sprite-chars',
    indoors: 'sprite-indoors',
  },
  ui: {
    large: 'ui-large',
    small: 'ui-small',
    inputs: 'ui-inputs',
  },
  audio: {
    musicMenu: 'music-menu',
    musicTown: 'music-town',
    musicDungeon: 'music-dungeon',
    sfxClick: 'sfx-click',
    sfxStep: 'sfx-step',
    sfxHit: 'sfx-hit',
    sfxDeath: 'sfx-death',
  },
} as const;
