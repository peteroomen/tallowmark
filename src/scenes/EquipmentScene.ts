import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';

export class EquipmentScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Equipment);
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 480,
      height: 420,
      title: 'EQUIPMENT',
    });

    const slots = ['Weapon', 'Armor', 'Offhand', 'Amulet', 'Ring'];
    let y = GAME_HEIGHT / 2 - 110;
    for (const slot of slots) {
      this.add
        .text(GAME_WIDTH / 2 - 160, y, slot, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e5e3d8',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(GAME_WIDTH / 2 + 160, y, '(empty)', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#5a5848',
        })
        .setOrigin(1, 0.5);
      y += 36;
    }

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
  }
}
