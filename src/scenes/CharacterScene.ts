import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { getServices } from '@/services';

interface CharacterSceneData {
  returnTo?: string;
}

export class CharacterScene extends Phaser.Scene {
  private returnTo: string = SCENE_KEYS.Town;

  constructor() {
    super(SCENE_KEYS.Character);
  }

  create(data: CharacterSceneData = {}): void {
    this.returnTo = data.returnTo ?? SCENE_KEYS.Town;
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
      ['Embers (meta)', `${services.persistent.metaCurrency}`],
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
      onClick: () => this.close(),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.close());
    this.input.keyboard?.once('keydown-c', () => this.close());
  }

  private close(): void {
    this.scene.resume(this.returnTo);
    this.scene.stop();
  }
}
