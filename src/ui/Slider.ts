import Phaser from 'phaser';
import { COLORS } from '@/config';

export interface SliderOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  value: number; // 0..1
  onChange: (value: number) => void;
}

/**
 * Horizontal 0..1 slider. Drag the knob or click anywhere on the track.
 * Hit target on the knob is generous (24×24) for touch use.
 */
export class Slider extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly knob: Phaser.GameObjects.Rectangle;
  private dragging = false;
  private sliderValue: number;
  private readonly trackWidth: number;

  constructor(opts: SliderOptions) {
    super(opts.scene, opts.x, opts.y);
    this.trackWidth = opts.width;
    this.sliderValue = clamp01(opts.value);

    this.track = opts.scene.add
      .rectangle(0, 0, this.trackWidth, 6, COLORS.panelBorder)
      .setOrigin(0, 0.5);
    this.fill = opts.scene.add
      .rectangle(0, 0, this.trackWidth * this.sliderValue, 6, COLORS.accent)
      .setOrigin(0, 0.5);
    this.knob = opts.scene.add
      .rectangle(this.trackWidth * this.sliderValue, 0, 12, 24, COLORS.text)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setOrigin(0.5);
    this.add([this.track, this.fill, this.knob]);

    const hit = new Phaser.Geom.Rectangle(0, -16, this.trackWidth, 32);
    this.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.updateFromPointer(p, opts.onChange);
    });
    opts.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.updateFromPointer(p, opts.onChange);
    });
    opts.scene.input.on('pointerup', () => {
      this.dragging = false;
    });

    opts.scene.add.existing(this);
  }

  applyValue(v: number): void {
    this.sliderValue = clamp01(v);
    this.fill.width = this.trackWidth * this.sliderValue;
    this.knob.x = this.trackWidth * this.sliderValue;
  }

  private updateFromPointer(p: Phaser.Input.Pointer, onChange: (v: number) => void): void {
    const local = this.getLocalPoint(p.worldX, p.worldY);
    const v = clamp01(local.x / this.trackWidth);
    this.applyValue(v);
    onChange(v);
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
