import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Pause);
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 400,
      height: 360,
      title: 'PAUSED',
    });

    let y = GAME_HEIGHT / 2 - 80;
    const dy = 56;

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y,
      text: 'Resume',
      primary: true,
      onClick: () => this.resume(),
    });
    y += dy;
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y,
      text: 'Inventory',
      onClick: () => this.scene.launch(SCENE_KEYS.Inventory),
    });
    y += dy;
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y,
      text: 'Character',
      onClick: () => this.scene.launch(SCENE_KEYS.Character),
    });
    y += dy;
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y,
      text: 'Abandon Run',
      onClick: () =>
        this.scene.launch(SCENE_KEYS.ConfirmDialog, {
          title: 'Abandon this run?',
          body: 'Your dungeon progress will be lost.\nMeta-currency you earned is kept.',
          confirmText: 'Abandon',
          cancelText: 'Keep going',
          onConfirm: () => {
            this.scene.stop(SCENE_KEYS.Dungeon);
            this.scene.stop();
            this.scene.start(SCENE_KEYS.Town);
          },
        }),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    this.scene.resume(SCENE_KEYS.Dungeon);
    this.scene.stop();
  }
}
