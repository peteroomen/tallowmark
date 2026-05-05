import Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import { UiLarge } from '@/world/FrameCatalog';

export type PanelVariant = 'wood' | 'slate' | 'dark';

export interface KenneyPanelOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  /**
   * Visual grammar:
   *   'wood'  — friendly menus (Inventory, Character, Settings, friendly confirms)
   *   'slate' — neutral / paused / cancel-able (Pause, "Stay" confirm)
   *   'dark'  — dangerous / final (DeathSummary, destructive confirms)
   */
  variant?: PanelVariant;
}

const FRAME_BY_VARIANT: Record<PanelVariant, number> = {
  wood: UiLarge.buttonBrown,
  slate: UiLarge.buttonGrey,
  dark: UiLarge.buttonDark,
};

const TITLE_COLOR_BY_VARIANT: Record<PanelVariant, string> = {
  wood: '#3a2a1f',
  slate: '#e5e3d8',
  dark: '#d4a24c',
};

const BORDER = 8;

/**
 * Panel rendered using Phaser's built-in 9-slice scaling on a single Kenney
 * UI button frame. Corners stay crisp; the middle stretches to fill.
 * Origin centered.
 */
export class KenneyPanel extends Phaser.GameObjects.Container {
  constructor(opts: KenneyPanelOptions) {
    super(opts.scene, opts.x, opts.y);
    const variant = opts.variant ?? 'wood';
    const frame = FRAME_BY_VARIANT[variant];

    const slice = opts.scene.add.nineslice(
      0,
      0,
      ASSET_KEYS.ui.large,
      frame,
      opts.width,
      opts.height,
      BORDER,
      BORDER,
      BORDER,
      BORDER,
    );
    slice.setOrigin(0.5);
    this.add(slice);

    if (opts.title) {
      const titleY = -opts.height / 2 + 22;
      const t = opts.scene.add
        .text(0, titleY, opts.title, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: TITLE_COLOR_BY_VARIANT[variant],
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.add(t);
    }

    opts.scene.add.existing(this);
  }
}
