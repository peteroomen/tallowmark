import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { getServices } from '@/services';

interface DeathData {
  turn: number;
  floor: number;
  kills: number;
}

export class DeathSummaryScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.DeathSummary);
  }

  create(data: DeathData): void {
    const services = getServices(this);

    // Calculate Embers earned from depth + survival.
    const embers = Math.max(1, data.floor * 5 + Math.floor(data.turn / 3) + data.kills * 2);
    services.setPersistent((s) => {
      s.metaCurrency += embers;
    });
    services.save.clearRun();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 540,
      height: 420,
      title: 'YOU DIED',
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, 'The dungeon claims another soul.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9a988e',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const lines: ReadonlyArray<readonly [string, string]> = [
      ['Floor reached', `${data.floor}`],
      ['Turns survived', `${data.turn}`],
      ['Kills', `${data.kills}`],
      ['Embers earned', `+${embers}`],
      ['Total embers', `${services.persistent.metaCurrency}`],
    ];
    let y = GAME_HEIGHT / 2 - 40;
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
      y += 28;
    }

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 150,
      width: 240,
      text: 'Return to Tallowmark',
      primary: true,
      onClick: () => this.scene.start(SCENE_KEYS.Town),
    });
  }
}
