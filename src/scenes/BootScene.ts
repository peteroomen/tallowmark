import Phaser from 'phaser';
import { SCENE_KEYS, ASSET_KEYS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/config';

// rpg-pack, chars, indoors are the GUTTER versions of the source sheets:
// 16x16 frames, 1px gutter between tiles.
const SHEET_16_GUTTER = { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 1 };

// UI pack and input-prompts are the PACKED versions: no gutter, no margin.
const UI_LARGE_PACKED = { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 };
const UI_SMALL_PACKED = { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 };
const INPUT_PACKED = { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 };

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    this.drawLoadingBar();

    this.load.spritesheet(ASSET_KEYS.sprites.rpg, 'assets/sprites/rpg.png', SHEET_16_GUTTER);
    this.load.spritesheet(ASSET_KEYS.sprites.chars, 'assets/sprites/chars.png', SHEET_16_GUTTER);
    this.load.spritesheet(ASSET_KEYS.sprites.indoors, 'assets/sprites/indoors.png', SHEET_16_GUTTER);

    this.load.spritesheet(ASSET_KEYS.ui.large, 'assets/ui/ui_large.png', UI_LARGE_PACKED);
    this.load.spritesheet(ASSET_KEYS.ui.small, 'assets/ui/ui_small.png', UI_SMALL_PACKED);
    this.load.spritesheet(ASSET_KEYS.ui.inputs, 'assets/ui/inputs.png', INPUT_PACKED);

    this.load.audio(ASSET_KEYS.audio.musicMenu, 'assets/audio/music_menu.wav');
    this.load.audio(ASSET_KEYS.audio.musicTown, 'assets/audio/music_town.wav');
    this.load.audio(ASSET_KEYS.audio.musicDungeon, 'assets/audio/music_dungeon.wav');
    this.load.audio(ASSET_KEYS.audio.sfxClick, 'assets/audio/sfx_click.wav');
    this.load.audio(ASSET_KEYS.audio.sfxStep, 'assets/audio/sfx_step.wav');
    this.load.audio(ASSET_KEYS.audio.sfxHit, 'assets/audio/sfx_hit.wav');
    this.load.audio(ASSET_KEYS.audio.sfxDeath, 'assets/audio/sfx_death.wav');

    // Iter-3 stage 1: load the Tiled-format town map (.tmj). Phaser fetches
    // the file and the tileset (.tsj) it references. Currently a minimal
    // grass + horizontal road map; stage 2 authors the full town in Tiled
    // with 3-tier buildings. The in-house painter stays as a dev-only
    // fallback during the migration.
    this.load.tilemapTiledJSON(ASSET_KEYS.maps.town, 'assets/maps/town.tmj');
  }

  create(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  private drawLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const w = Math.min(GAME_WIDTH * 0.6, 480);
    const h = 16;

    this.add
      .text(cx, cy - 40, 'Tallowmark', { fontSize: '32px', color: '#e5e3d8', fontFamily: 'monospace' })
      .setOrigin(0.5);

    const border = this.add.rectangle(cx, cy, w + 4, h + 4, COLORS.panelBorder).setOrigin(0.5);
    border.setStrokeStyle(1, COLORS.panelBorder);
    const bg = this.add.rectangle(cx, cy, w, h, COLORS.panel).setOrigin(0.5);
    const bar = this.add.rectangle(cx - w / 2, cy, 1, h, COLORS.accent).setOrigin(0, 0.5);

    this.load.on('progress', (p: number) => {
      bar.width = Math.max(1, w * p);
    });
    this.load.on('complete', () => {
      bg.destroy();
      border.destroy();
      bar.destroy();
    });
  }
}
