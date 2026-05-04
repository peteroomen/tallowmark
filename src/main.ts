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
import { DebugSheetScene, DEBUG_SHEET_SCENE_KEY } from '@/scenes/DebugSheetScene';

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
    DebugSheetScene,
  ],
};

const game = new Phaser.Game(config);
game.scene.start(SCENE_KEYS.Boot);

// Dev-only: F9 from anywhere opens the sheet inspector.
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F9') {
      e.preventDefault();
      const active = game.scene.getScenes(true)[0];
      const returnTo = active?.scene.key ?? SCENE_KEYS.MainMenu;
      if (returnTo === DEBUG_SHEET_SCENE_KEY) return;
      game.scene.stop(returnTo);
      game.scene.start(DEBUG_SHEET_SCENE_KEY, { returnTo });
    }
  });
}
