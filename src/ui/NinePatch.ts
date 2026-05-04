import Phaser from 'phaser';

export interface NineSliceFrames {
  tl: number;
  t: number;
  tr: number;
  l: number;
  c: number;
  r: number;
  bl: number;
  b: number;
  br: number;
}

export interface NinePatchOptions {
  scene: Phaser.Scene;
  textureKey: string;
  frames: NineSliceFrames;
  /** Width in tiles (corners count as 1 tile each, edges count as +1 each, body fills the middle). */
  cols: number;
  /** Height in tiles. */
  rows: number;
  /** Source tile size (16 for the small UI sheet, 32 for the large UI sheet). */
  tileSize: number;
  /** Render scale (so `cols * tileSize * scale` is the on-screen pixel width). */
  scale: number;
}

/**
 * Renders a 9-slice from a Phaser spritesheet. Cheap and correct: places
 * `cols × rows` tiles, picking the corner / edge / center frame for each cell.
 *
 * Origin is (0,0) — the container's top-left. Use `.setPosition()` after
 * construction to place it.
 */
export class NinePatch extends Phaser.GameObjects.Container {
  readonly patchWidth: number;
  readonly patchHeight: number;

  constructor(opts: NinePatchOptions) {
    super(opts.scene, 0, 0);
    if (opts.cols < 2 || opts.rows < 2) {
      throw new RangeError('NinePatch needs at least 2 cols and 2 rows');
    }

    const cellPx = opts.tileSize * opts.scale;
    this.patchWidth = opts.cols * cellPx;
    this.patchHeight = opts.rows * cellPx;

    const f = opts.frames;
    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        const isLeft = c === 0;
        const isRight = c === opts.cols - 1;
        const isTop = r === 0;
        const isBottom = r === opts.rows - 1;
        let frame: number;
        if (isTop && isLeft) frame = f.tl;
        else if (isTop && isRight) frame = f.tr;
        else if (isBottom && isLeft) frame = f.bl;
        else if (isBottom && isRight) frame = f.br;
        else if (isTop) frame = f.t;
        else if (isBottom) frame = f.b;
        else if (isLeft) frame = f.l;
        else if (isRight) frame = f.r;
        else frame = f.c;

        const px = c * cellPx + cellPx / 2;
        const py = r * cellPx + cellPx / 2;
        const img = opts.scene.add
          .image(px, py, opts.textureKey, frame)
          .setScale(opts.scale)
          .setOrigin(0.5);
        this.add(img);
      }
    }

    opts.scene.add.existing(this);
  }
}
