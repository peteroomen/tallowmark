import Phaser from 'phaser';

export interface HungerBarOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  originX?: number;
  originY?: number;
}

const COLOR_BORDER = 0x1a1a24;
const COLOR_TRACK = 0x2a1d12;
const COLOR_FULL = 0xc9a06b; // wheat — fed
const COLOR_MID = 0xd4a24c; // amber — peckish
const COLOR_LOW = 0xb84a4a; // red — starving

/**
 * Hunger bar. Mirrors `HpBar` but warmer-toned. Drives the visual cue for
 * the hunger clock — colour shifts red as `food` approaches the starvation
 * threshold so the player feels the pressure without reading a number.
 */
export class HungerBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly innerW: number;

  constructor(opts: HungerBarOptions) {
    super(opts.scene, opts.x, opts.y);
    const w = opts.width;
    const h = opts.height;
    const ox = opts.originX ?? 0;
    const oy = opts.originY ?? 0.5;
    const dx = -ox * w;
    const dy = -oy * h;
    this.innerW = w - 4;

    const border = opts.scene.add.rectangle(dx, dy, w, h, COLOR_BORDER).setOrigin(0, 0);
    const track = opts.scene.add.rectangle(dx + 2, dy + 2, this.innerW, h - 4, COLOR_TRACK).setOrigin(0, 0);
    this.fill = opts.scene.add
      .rectangle(dx + 2, dy + 2, this.innerW, h - 4, COLOR_FULL)
      .setOrigin(0, 0);
    this.add([border, track, this.fill]);

    opts.scene.add.existing(this);
  }

  setFood(current: number, max: number): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.fill.width = Math.max(0, this.innerW * pct);
    this.fill.fillColor = pct > 0.5 ? COLOR_FULL : pct > 0.2 ? COLOR_MID : COLOR_LOW;
  }
}
