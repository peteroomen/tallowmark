import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';

export class InventoryScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Inventory);
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 480,
      height: 420,
      title: 'INVENTORY',
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '(empty)', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a988e',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Items, potions, scrolls, runes — coming in iteration 2.', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#5a5848',
        align: 'center',
      })
      .setOrigin(0.5);

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 140,
      width: 180,
      text: 'Close',
      primary: true,
      onClick: () => this.scene.stop(),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.scene.stop());
    this.input.keyboard?.once('keydown-i', () => this.scene.stop());
  }
}
