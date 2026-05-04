import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { Slider } from '@/ui/Slider';
import { getServices } from '@/services';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Settings);
  }

  create(): void {
    const services = getServices(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 560,
      height: 460,
      title: 'SETTINGS',
    });

    const startX = GAME_WIDTH / 2 - 220;
    const labelX = GAME_WIDTH / 2 - 220;
    let y = GAME_HEIGHT / 2 - 130;
    const dy = 60;

    const addRow = (label: string, key: 'master' | 'music' | 'sfx') => {
      this.add
        .text(labelX, y - 16, label, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#e5e3d8',
        })
        .setOrigin(0, 0.5);
      const valText = this.add
        .text(labelX + 420, y - 16, percent(services.persistent.audio[key]), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#9a988e',
        })
        .setOrigin(1, 0.5);
      new Slider({
        scene: this,
        x: startX,
        y: y + 6,
        width: 420,
        value: services.persistent.audio[key],
        onChange: (v) => {
          services.setPersistent((s) => {
            s.audio[key] = v;
          });
          valText.setText(percent(v));
        },
      });
      y += dy;
    };

    addRow('Master Volume', 'master');
    addRow('Music Volume', 'music');
    addRow('SFX Volume', 'sfx');

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 - 100,
      y: GAME_HEIGHT / 2 + 160,
      width: 180,
      text: 'Reset Save',
      onClick: () => this.confirmReset(),
    });

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 + 100,
      y: GAME_HEIGHT / 2 + 160,
      width: 180,
      text: 'Back',
      primary: true,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.MainMenu));
  }

  private confirmReset(): void {
    this.scene.launch(SCENE_KEYS.ConfirmDialog, {
      title: 'Reset all save data?',
      body: 'This wipes meta-currency, unlocks, and any in-progress run.\nThis cannot be undone.',
      confirmText: 'Reset',
      cancelText: 'Keep',
      onConfirm: () => {
        const services = getServices(this);
        services.save.clearAll();
        const fresh = services.save.loadPersistent();
        services.setPersistent((s) => {
          s.metaCurrency = fresh.metaCurrency;
          s.rescuedFounders = fresh.rescuedFounders;
          s.unlockedItemPool = fresh.unlockedItemPool;
          s.townUpgrades = fresh.townUpgrades;
          s.audio = fresh.audio;
          s.hasCompletedFirstRun = fresh.hasCompletedFirstRun;
        });
        this.scene.restart();
      },
    });
  }
}

function percent(v: number): string {
  return `${Math.round(v * 100)}%`;
}
