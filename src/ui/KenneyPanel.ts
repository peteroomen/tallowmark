import Phaser from 'phaser';
import { COLORS } from '@/config';

export interface KenneyPanelOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
}

/**
 * A flat, dark panel with the project's accent border. Used as the backdrop for
 * menu screens, dialogs, and the HUD. Will be upgraded to a true 9-slice from
 * the Kenney UI sheet in a later polish pass.
 */
export class KenneyPanel extends Phaser.GameObjects.Container {
  constructor(opts: KenneyPanelOptions) {
    super(opts.scene, opts.x, opts.y);
    const bg = opts.scene.add
      .rectangle(0, 0, opts.width, opts.height, COLORS.panel, 0.96)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setOrigin(0.5);
    this.add(bg);

    if (opts.title) {
      const title = opts.scene.add
        .text(0, -opts.height / 2 + 18, opts.title, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#d4a24c',
        })
        .setOrigin(0.5);
      this.add(title);
    }

    opts.scene.add.existing(this);
  }
}
