import Phaser from 'phaser';

export interface HpBarOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Origin x — defaults 0 (left). */
  originX?: number;
  /** Origin y — defaults 0.5 (vertical centre). */
  originY?: number;
}

const COLOR_BORDER = 0x1a1a24;
const COLOR_TRACK = 0x2a1d12;
const COLOR_FULL = 0x6aa84a; // green
const COLOR_MID = 0xd4a24c; // amber
const COLOR_LOW = 0xb84a4a; // red

/**
 * Pixel-art horizontal hit-points bar. Origin defaults to (0, 0.5) so it lines
 * up alongside adjacent HUD text. `setHp(current, max)` updates the fill width
 * and shifts colour green → amber → red as hp falls.
 */
export class HpBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly innerW: number;

  constructor(opts: HpBarOptions) {
    super(opts.scene, opts.x, opts.y);
    const w = opts.width;
    const h = opts.height;
    const ox = opts.originX ?? 0;
    const oy = opts.originY ?? 0.5;
    // Origin offset for children — children are positioned relative to the
    // container's local 0,0; we shift them so the visual origin matches `(ox, oy)`.
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

  setHp(current: number, max: number): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.fill.width = Math.max(0, this.innerW * pct);
    this.fill.fillColor = pct > 0.55 ? COLOR_FULL : pct > 0.25 ? COLOR_MID : COLOR_LOW;
  }
}
