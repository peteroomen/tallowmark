import Phaser from 'phaser';
import { ASSET_KEYS } from '@/config';
import { UiLarge } from '@/world/FrameCatalog';
import { getServices } from '@/services';

export interface KenneyButtonOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  onClick: () => void;
  /** Primary uses the brown wood frame; otherwise grey. */
  primary?: boolean;
}

const BORDER = 8;
const DEFAULT_W = 240;
const DEFAULT_H = 56;

/**
 * Touch-friendly button rendered using Phaser's built-in 9-slice on a single
 * Kenney UI button frame. Corners stay crisp; the middle stretches.
 *
 * Hit target is the full panel; minimum 48px tall by default for touch use.
 */
export class KenneyButton extends Phaser.GameObjects.Container {
  private readonly slice: Phaser.GameObjects.NineSlice;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitW: number;
  private readonly hitH: number;

  constructor(opts: KenneyButtonOptions) {
    super(opts.scene, opts.x, opts.y);
    this.hitW = opts.width ?? DEFAULT_W;
    this.hitH = opts.height ?? DEFAULT_H;
    const frame = opts.primary ? UiLarge.buttonBrown : UiLarge.buttonGrey;

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
    this.add(this.slice);

    this.label = opts.scene.add
      .text(0, 0, opts.text, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: opts.primary ? '#3a2a1f' : '#e5e3d8',
        fontStyle: opts.primary ? 'bold' : 'normal',
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
