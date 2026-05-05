import Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import { UiLarge } from '@/world/FrameCatalog';
import { getServices } from '@/services';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface KenneyButtonOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  onClick: () => void;
  /**
   * Visual grammar — applied site-wide:
   *   'primary'     → amber / wood (confirm, proceed)
   *   'secondary'   → slate (cancel, back, neutral)
   *   'destructive' → wood + red tint (Reset Save, Abandon Run)
   *
   * Backwards-compat: passing `primary: true` is treated as variant: 'primary'.
   */
  variant?: ButtonVariant;
  /** @deprecated use `variant` */
  primary?: boolean;
}

const BORDER = 6;
const DEFAULT_W = 180;
const DEFAULT_H = 36;

const FRAME_BY_VARIANT: Record<ButtonVariant, number> = {
  primary: UiLarge.buttonBrown,
  secondary: UiLarge.buttonGrey,
  destructive: UiLarge.buttonBrown,
};

const TEXT_COLOR_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: '#3a2a1f',
  secondary: '#e5e3d8',
  destructive: '#fbe6e6',
};

const TINT_BY_VARIANT: Record<ButtonVariant, number | undefined> = {
  primary: undefined,
  secondary: undefined,
  destructive: 0xb84a4a, // muted red overlay on the wood frame
};

/**
 * Touch-friendly button rendered using Phaser's built-in 9-slice on a single
 * Kenney UI button frame. Variants set both the frame and the text colour so
 * the call-site doesn't have to spell out colours.
 *
 * Hit area is the full panel rectangle, matching the visual bounds.
 */
export class KenneyButton extends Phaser.GameObjects.Container {
  private readonly slice: Phaser.GameObjects.NineSlice;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitW: number;
  private readonly hitH: number;
  private readonly variant: ButtonVariant;

  constructor(opts: KenneyButtonOptions) {
    super(opts.scene, opts.x, opts.y);
    this.hitW = opts.width ?? DEFAULT_W;
    this.hitH = opts.height ?? DEFAULT_H;
    this.variant = opts.variant ?? (opts.primary ? 'primary' : 'secondary');

    const frame = FRAME_BY_VARIANT[this.variant];
    this.slice = opts.scene.add.nineslice(
      0,
      0,
      ASSET_KEYS.ui.large,
      frame,
      this.hitW,
      this.hitH,
      BORDER,
      BORDER,
      BORDER,
      BORDER,
    );
    this.slice.setOrigin(0.5);
    const tint = TINT_BY_VARIANT[this.variant];
    if (tint !== undefined) this.slice.setTint(tint);
    this.add(this.slice);

    this.label = opts.scene.add
      .text(0, 0, opts.text, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: TEXT_COLOR_BY_VARIANT[this.variant],
        fontStyle: this.variant !== 'secondary' ? 'bold' : 'normal',
      })
      .setOrigin(0.5);
    this.add(this.label);

    this.setSize(this.hitW, this.hitH);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.hitW / 2, -this.hitH / 2, this.hitW, this.hitH),
      Phaser.Geom.Rectangle.Contains,
    );

    this.on('pointerover', () => {
      this.slice.setAlpha(0.92);
      opts.scene.input.setDefaultCursor('pointer');
    });
    this.on('pointerout', () => {
      this.slice.setAlpha(1);
      opts.scene.input.setDefaultCursor('default');
    });
    this.on('pointerdown', () => {
      this.slice.setAlpha(0.78);
      this.label.setY(2);
    });
    this.on('pointerup', () => {
      this.slice.setAlpha(1);
      this.label.setY(0);
      try {
        getServices(opts.scene).audio.playSfx(ASSET_KEYS.audio.sfxClick);
      } catch {
        /* services not available in test contexts */
      }
      opts.onClick();
    });

    opts.scene.add.existing(this);
  }

  setLabel(text: string): void {
    this.label.setText(text);
  }
}
