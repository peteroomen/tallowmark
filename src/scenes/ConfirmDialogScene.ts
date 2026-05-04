import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';

export interface ConfirmDialogData {
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export class ConfirmDialogScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.ConfirmDialog);
  }

  create(data: ConfirmDialogData): void {
    // Dim the underlying scene
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);

    const w = 520;
    const h = 240;
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: w,
      height: h,
      title: data.title,
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, data.body, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e5e3d8',
        align: 'center',
      })
      .setOrigin(0.5);

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 - 110,
      y: GAME_HEIGHT / 2 + 70,
      width: 180,
      text: data.cancelText ?? 'Cancel',
      onClick: () => {
        data.onCancel?.();
        this.scene.stop();
      },
    });

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 + 110,
      y: GAME_HEIGHT / 2 + 70,
      width: 180,
      text: data.confirmText ?? 'Confirm',
      primary: true,
      onClick: () => {
        data.onConfirm();
        this.scene.stop();
      },
    });

    this.input.keyboard?.once('keydown-ESC', () => {
      data.onCancel?.();
      this.scene.stop();
    });

    void COLORS;
  }
}
