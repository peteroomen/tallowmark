import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, SCENE_KEYS } from '@/config';
import { BootScene } from '@/scenes/BootScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { TownScene } from '@/scenes/TownScene';
import { DungeonScene } from '@/scenes/DungeonScene';
import { UIScene } from '@/scenes/UIScene';
import { PauseScene } from '@/scenes/PauseScene';
import { InventoryScene } from '@/scenes/InventoryScene';
import { EquipmentScene } from '@/scenes/EquipmentScene';
import { CharacterScene } from '@/scenes/CharacterScene';
import { DeathSummaryScene } from '@/scenes/DeathSummaryScene';
import { ConfirmDialogScene } from '@/scenes/ConfirmDialogScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: {
    disableWebAudio: false,
  },
  scene: [
    BootScene,
    MainMenuScene,
    SettingsScene,
    TownScene,
    DungeonScene,
    UIScene,
    PauseScene,
    InventoryScene,
    EquipmentScene,
    CharacterScene,
    DeathSummaryScene,
    ConfirmDialogScene,
  ],
};

new Phaser.Game(config).scene.start(SCENE_KEYS.Boot);
