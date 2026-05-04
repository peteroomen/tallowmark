import Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import { UiLarge } from '@/world/FrameCatalog';

export interface KenneyPanelOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  /**
   * 'wood'  — brown beveled panel  (frame UiLarge.buttonBrown)
   * 'light' — cream beveled panel  (frame UiLarge.buttonCream)
   * 'inset' — grey beveled panel   (frame UiLarge.buttonGrey)
   */
  variant?: 'wood' | 'light' | 'inset';
}

const FRAME_BY_VARIANT: Record<NonNullable<KenneyPanelOptions['variant']>, number> = {
  wood: UiLarge.buttonBrown,
  light: UiLarge.buttonCream,
  inset: UiLarge.buttonGrey,
};

// Each Kenney UI Large tile is a 32×32 button with a ~6px bevel border.
const BORDER = 8;

/**
 * Panel rendered using Phaser's built-in 9-slice scaling on a single Kenney
 * UI button frame. Corners stay crisp; the middle stretches to fill.
 * Origin is centered.
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
          color: variant === 'inset' ? '#e5e3d8' : '#3a2a1f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.add(t);
    }

    opts.scene.add.existing(this);
  }
}
