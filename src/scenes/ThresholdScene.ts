import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { getServices } from '@/services';

/**
 * The Threshold — replaces the bare "Descend?" confirm dialog.
 *
 * Per refinement-002 §4.1: a one-screen world-state card. Shows what
 * the dungeon offers today (open shops, banked Embers, drop pool gates),
 * one big descent button. Not a menu — a doorway. Speed-runners dismiss
 * with one input; new players read it.
 *
 * Iter-2 ships the framework. The optional Goal layer comes in iter-4
 * alongside Feats.
 */
export class ThresholdScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Threshold);
  }

  create(): void {
    const services = getServices(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 560,
      height: 440,
      title: 'THE DESCENT',
      variant: 'wood',
    });

    // Heading — flavour-first, no "Are you sure?"
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, 'You stand at the threshold.', {
        fontFamily: 'serif',
        fontSize: '20px',
        fontStyle: 'italic',
        color: '#d4a24c',
      })
      .setOrigin(0.5);

    // Today's state card — three lines, ledger-style.
    const meta = services.persistent.resources.embers;
    const founders =
      services.persistent.rescuedFounders.length > 0
        ? services.persistent.rescuedFounders.join(', ')
        : 'none';
    const completedFirstRun = services.persistent.hasCompletedFirstRun;

    const lines: ReadonlyArray<readonly [string, string]> = [
      ['Embers banked', `${meta}`],
      ['Founders rescued', founders],
      ['Status', completedFirstRun ? 'Veteran walker' : 'First descent'],
    ];

    let y = GAME_HEIGHT / 2 - 100;
    for (const [k, v] of lines) {
      this.add
        .text(GAME_WIDTH / 2 - 220, y, k, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#9a988e',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(GAME_WIDTH / 2 + 220, y, v, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e5e3d8',
        })
        .setOrigin(1, 0.5);
      y += 28;
    }

    // Drop-pool teaser — empty for now (placeholder for iter-3 Founders)
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 30,
        completedFirstRun
          ? "What you'll find changes as the town grows."
          : 'You carry only what you brought.',
        {
          fontFamily: 'serif',
          fontSize: '14px',
          fontStyle: 'italic',
          color: '#9a988e',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    // The big descent button — singular. The button itself is the commitment.
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 110,
      width: 240,
      height: 48,
      text: 'Descend',
      variant: 'primary',
      onClick: () => this.descend(),
    });

    // Quiet "stay" link — small, secondary; no commitment to leave town.
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 168,
      width: 160,
      height: 40,
      text: 'Not yet',
      variant: 'secondary',
      onClick: () => this.cancel(),
    });

    // Keyboard parity — Space / Enter = descend, Esc = cancel.
    this.input.keyboard?.once('keydown-SPACE', () => this.descend());
    this.input.keyboard?.once('keydown-ENTER', () => this.descend());
    this.input.keyboard?.once('keydown-ESC', () => this.cancel());
  }

  private descend(): void {
    this.scene.start(SCENE_KEYS.Dungeon, { fresh: true });
  }

  private cancel(): void {
    this.scene.stop();
    this.scene.resume(SCENE_KEYS.Town);
  }
}
