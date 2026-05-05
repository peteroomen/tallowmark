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

    const embers = Math.max(1, data.floor * 5 + Math.floor(data.turn / 3) + data.kills * 2);
    services.setPersistent((s) => {
      s.metaCurrency += embers;
    });
    services.save.clearRun();

    // Darken the entire screen for the death moment.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a10);

    // Dark slate panel — visual finality.
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 540,
      height: 420,
      variant: 'dark',
    });

    // Title in bold red — replaces the panel's built-in title (which uses
    // amber for dark variant) so the moment reads as final.
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 178, 'YOU DIED', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#d44a4a',
        fontStyle: 'bold',
        stroke: '#1a0a0a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, 'The dungeon claims another soul.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9a988e',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const lines: ReadonlyArray<readonly [string, string, string]> = [
      ['Floor reached', `${data.floor}`, '#cfcfd5'],
      ['Turns survived', `${data.turn}`, '#cfcfd5'],
      ['Kills', `${data.kills}`, '#cfcfd5'],
      ['Embers earned', `+${embers}`, '#d4a24c'], // highlighted — the takeaway
      ['Total embers', `${services.persistent.metaCurrency}`, '#cfcfd5'],
    ];
    let y = GAME_HEIGHT / 2 - 70;
    for (const [k, v, vColor] of lines) {
      this.add
        .text(GAME_WIDTH / 2 - 180, y, k, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#7a7880',
        })
        .setOrigin(0, 0.5);
      const isHighlight = vColor !== '#cfcfd5';
      this.add
        .text(GAME_WIDTH / 2 + 180, y, v, {
          fontFamily: 'monospace',
          fontSize: isHighlight ? '16px' : '14px',
          color: vColor,
          fontStyle: isHighlight ? 'bold' : 'normal',
        })
        .setOrigin(1, 0.5);
      y += 28;
    }

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 150,
      width: 320,
      height: 44,
      text: 'Return to Tallowmark',
      variant: 'primary',
      onClick: () => this.scene.start(SCENE_KEYS.Town),
    });

    void COLORS;
  }
}
