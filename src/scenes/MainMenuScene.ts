import Phaser from 'phaser';
import { ASSET_KEYS, COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { getServices } from '@/services';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MainMenu);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('menu');

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 200, 'TALLOWMARK', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#d4a24c',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'a turn-based descent', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#9a988e',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const btnX = GAME_WIDTH / 2;
    let y = GAME_HEIGHT / 2 - 40;
    const dy = 70;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'New Game',
      primary: true,
      onClick: () => this.startNewGame(),
    });
    y += dy;

    const continueBtn = new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: services.save.loadRun() ? 'Continue' : 'Continue (no save)',
      onClick: () => {
        if (services.save.loadRun()) this.continueRun();
      },
    });
    if (!services.save.loadRun()) {
      continueBtn.setAlpha(0.5);
    }
    y += dy;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'Settings',
      onClick: () => this.scene.start(SCENE_KEYS.Settings),
    });
    y += dy;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'Quit',
      onClick: () => {
        // Browsers won't actually allow window.close; show a friendly message.
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, 'Close the tab to quit.', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#9a988e',
          })
          .setOrigin(0.5);
      },
    });

    // Hint footer
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 16, `seed-based runs · keyboard or mouse · 8-dir`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#5a5848',
      })
      .setOrigin(0.5);

    void ASSET_KEYS.audio.sfxClick; // ensure import remains tree-shakable
  }

  private startNewGame(): void {
    const services = getServices(this);
    services.save.clearRun();
    this.scene.start(SCENE_KEYS.Town, { fresh: true });
  }

  private continueRun(): void {
    // If there's an in-progress dungeon run, jump back into it; otherwise to town.
    const run = getServices(this).save.loadRun();
    if (run) {
      this.scene.start(SCENE_KEYS.Dungeon, { resume: true });
    } else {
      this.scene.start(SCENE_KEYS.Town, { fresh: false });
    }
  }
}
