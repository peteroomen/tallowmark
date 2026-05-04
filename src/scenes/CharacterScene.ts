import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { getServices } from '@/services';

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Character);
  }

  create(): void {
    const services = getServices(this);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 480,
      height: 420,
      title: 'CHARACTER',
    });

    const run = services.save.loadRun();
    const stats = run?.player ?? { hp: 20, hpMax: 20, power: 4, armor: 1 };

    const lines: ReadonlyArray<readonly [string, string]> = [
      ['Class', 'Wanderer (placeholder)'],
      ['HP', `${stats.hp} / ${stats.hpMax}`],
      ['Attack Power', `${stats.power}`],
      ['Armor', `${stats.armor}`],
      ['Hunger', '(coming iteration 2)'],
      ['Souls (meta)', `${services.persistent.metaCurrency}`],
    ];

    let y = GAME_HEIGHT / 2 - 110;
    for (const [k, v] of lines) {
      this.add
        .text(GAME_WIDTH / 2 - 180, y, k, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#9a988e',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(GAME_WIDTH / 2 + 180, y, v, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e5e3d8',
        })
        .setOrigin(1, 0.5);
      y += 32;
    }

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 150,
      width: 180,
      text: 'Close',
      primary: true,
      onClick: () => this.scene.stop(),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.scene.stop());
    this.input.keyboard?.once('keydown-c', () => this.scene.stop());
  }
}
