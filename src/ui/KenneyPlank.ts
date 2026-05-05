import Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import { UiLarge } from '@/world/FrameCatalog';

export type PlankVariant = 'wood' | 'slate' | 'dark';

export interface KenneyPlankOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  variant?: PlankVariant;
  /** Origin x — defaults 0 (left). */
  originX?: number;
  /** Origin y — defaults 0 (top). */
  originY?: number;
  /** Optional alpha (HUD planks read better at ~0.85). */
  alpha?: number;
}

const FRAME: Record<PlankVariant, number> = {
  wood: UiLarge.buttonBrown,
  slate: UiLarge.buttonGrey,
  dark: UiLarge.buttonDark,
};

const BORDER = 6;

/**
 * A small horizontal nine-slice strip used as a backing plate for HUD text.
 * Same source frames as KenneyPanel but treated as a low-contrast chrome
 * element (slightly transparent by default) so HUD text reads against any
 * tile background.
 */
export class KenneyPlank extends Phaser.GameObjects.NineSlice {
  constructor(opts: KenneyPlankOptions) {
    const frame = FRAME[opts.variant ?? 'wood'];
    super(
      opts.scene,
      opts.x,
      opts.y,
      ASSET_KEYS.ui.large,
      frame,
      opts.width,
      opts.height,
      BORDER,
      BORDER,
      BORDER,
      BORDER,
    );
    this.setOrigin(opts.originX ?? 0, opts.originY ?? 0);
    this.setAlpha(opts.alpha ?? 0.85);
    opts.scene.add.existing(this);
  }
}
