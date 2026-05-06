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
      variant: 'slate',
    });

    // Controls reference — pause is the single place a player can look up
    // every binding. Replaces the per-screen footer hints (which only show
    // 1-2 keys) for the moments when the player is genuinely lost.
    const controlsLines = [
      'WASD / arrows / hjkl  — move',
      'yubn                  — diagonals',
      '.  / numpad 5         — wait one turn',
      'click tile             — auto-path',
      'click enemy            — bump-attack',
      'I  — inventory     C  — character',
      'F8 — town editor   F9 — sprite sheet',
    ];
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, controlsLines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cfcfd5',
        align: 'left',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 70,
      text: 'Resume',
      primary: true,
      onClick: () => this.resume(),
    });

    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 122,
      text: 'Abandon Run',
      variant: 'destructive',
      onClick: () =>
        this.scene.launch(SCENE_KEYS.ConfirmDialog, {
          title: 'Abandon this run?',
          body: 'Your dungeon progress will be lost.\nEmbers you earned are kept.',
          tone: 'destructive',
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
