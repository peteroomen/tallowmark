import Phaser from 'phaser';
import { ASSET_KEYS, COLORS } from '@/config';
import { getServices } from '@/services';

export interface KenneyButtonOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  text: string;
  onClick: () => void;
  primary?: boolean;
}

/**
 * Touch-friendly button rendered with a Kenney UI 9-slice panel and a label.
 * Hit target is at least 48×40 to satisfy mobile-first interaction.
 */
export class KenneyButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private hoverTint = false;

  constructor(opts: KenneyButtonOptions) {
    super(opts.scene, opts.x, opts.y);
    const w = Math.max(opts.width ?? 240, 96);
    const h = 40;
    const fillColor = opts.primary ? COLORS.accent : COLORS.panel;
    const borderColor = COLORS.panelBorder;

    this.bg = opts.scene.add
      .rectangle(0, 0, w, h, fillColor)
      .setStrokeStyle(2, borderColor)
      .setOrigin(0.5);
    this.label = opts.scene.add
      .text(0, 0, opts.text, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: opts.primary ? '#1a1a24' : '#e5e3d8',
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);

    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', () => {
      this.hoverTint = true;
      this.bg.setFillStyle(opts.primary ? 0xe5b265 : 0x2a2a36);
      opts.scene.input.setDefaultCursor('pointer');
    });
    this.on('pointerout', () => {
      this.hoverTint = false;
      this.bg.setFillStyle(fillColor);
      opts.scene.input.setDefaultCursor('default');
    });
    this.on('pointerdown', () => {
      this.bg.setFillStyle(opts.primary ? 0xb88a3a : 0x141420);
    });
    this.on('pointerup', () => {
      this.bg.setFillStyle(this.hoverTint ? (opts.primary ? 0xe5b265 : 0x2a2a36) : fillColor);
      try {
        getServices(opts.scene).audio.playSfx(ASSET_KEYS.audio.sfxClick);
      } catch {
        // services may not exist in test contexts
      }
      opts.onClick();
    });

    opts.scene.add.existing(this);
  }

  setLabel(text: string): void {
    this.label.setText(text);
  }
}
