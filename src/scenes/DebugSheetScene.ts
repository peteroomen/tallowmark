import Phaser from 'phaser';
import { ASSET_KEYS, COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { CHARS_GRID, INPUT_GRID, RPG_GRID, UI_LARGE_GRID, UI_SMALL_GRID } from '@/world/FrameCatalog';

/**
 * Dev-only sheet inspector. TAB cycles through views; each view renders a
 * row-range of one sheet at fit-to-viewport scale with frame indices labeled.
 * ESC returns to the previous scene.
 */

interface SheetView {
  key: string;
  label: string;
  cols: number;
  rowStart: number;
  rowEnd: number;
  tileSize: number;
}

function span(key: string, label: string, grid: { cols: number; rows: number }, tile: number, chunks = 1): SheetView[] {
  const out: SheetView[] = [];
  const per = Math.ceil(grid.rows / chunks);
  for (let i = 0; i < chunks; i++) {
    const a = i * per;
    const b = Math.min(grid.rows, a + per);
    out.push({
      key,
      label: chunks > 1 ? `${label} rows ${a}–${b - 1}` : label,
      cols: grid.cols,
      rowStart: a,
      rowEnd: b,
      tileSize: tile,
    });
  }
  return out;
}

const SHEETS: SheetView[] = [
  ...span(ASSET_KEYS.sprites.rpg, 'rpg-pack', RPG_GRID, 16, 3),
  ...span(ASSET_KEYS.sprites.chars, 'chars', CHARS_GRID, 16, 1),
  ...span(ASSET_KEYS.ui.large, 'ui-large', UI_LARGE_GRID, 32, 1),
  ...span(ASSET_KEYS.ui.small, 'ui-small', UI_SMALL_GRID, 16, 1),
  ...span(ASSET_KEYS.ui.inputs, 'inputs', INPUT_GRID, 16, 3),
];

export const DEBUG_SHEET_SCENE_KEY = 'DebugSheet';

interface DebugSheetData {
  returnTo: string;
}

export class DebugSheetScene extends Phaser.Scene {
  private idx = 0;
  private container?: Phaser.GameObjects.Container;
  private headerText!: Phaser.GameObjects.Text;
  private returnTo = '';

  constructor() {
    super(DEBUG_SHEET_SCENE_KEY);
  }

  create(data: DebugSheetData): void {
    this.returnTo = data.returnTo;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    this.headerText = this.add
      .text(GAME_WIDTH / 2, 12, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d4a24c',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(1000);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'TAB cycle  ·  ESC exit', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9a988e',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(1000);

    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.idx = (this.idx + 1) % SHEETS.length;
      this.renderSheet();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop();
      this.scene.start(this.returnTo);
    });

    this.renderSheet();
  }

  private renderSheet(): void {
    this.container?.destroy();
    this.container = this.add.container(0, 0);

    const view = SHEETS[this.idx];
    if (!view) return;
    const tex = this.textures.get(view.key);
    if (!tex || tex.key === '__MISSING') {
      this.headerText.setText(`${view.label}: not loaded`);
      return;
    }

    const visibleRows = view.rowEnd - view.rowStart;
    const sheetPxW = view.cols * view.tileSize;
    const sheetPxH = visibleRows * view.tileSize;
    const maxW = GAME_WIDTH - 32;
    const maxH = GAME_HEIGHT - 80;
    const scale = Math.max(1, Math.min(Math.floor(maxW / sheetPxW), Math.floor(maxH / sheetPxH)));

    const cellPx = view.tileSize * scale;
    const totalW = view.cols * cellPx;
    const totalH = visibleRows * cellPx;
    const ox = Math.floor((GAME_WIDTH - totalW) / 2);
    const oy = Math.floor((GAME_HEIGHT - totalH) / 2) + 8;

    this.headerText.setText(
      `[${this.idx + 1}/${SHEETS.length}] ${view.label} — ${view.cols}×${view.rowEnd - view.rowStart} cells @ ${scale}× (frames ${view.rowStart * view.cols}..${view.rowEnd * view.cols - 1})`,
    );

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x222230, 0.6);
    for (let c = 0; c <= view.cols; c++) grid.lineBetween(ox + c * cellPx, oy, ox + c * cellPx, oy + totalH);
    for (let r = 0; r <= visibleRows; r++) grid.lineBetween(ox, oy + r * cellPx, ox + totalW, oy + r * cellPx);
    this.container.add(grid);

    for (let r = view.rowStart; r < view.rowEnd; r++) {
      for (let c = 0; c < view.cols; c++) {
        const frameIdx = r * view.cols + c;
        const screenR = r - view.rowStart;
        const px = ox + c * cellPx + cellPx / 2;
        const py = oy + screenR * cellPx + cellPx / 2;
        const img = this.add.image(px, py, view.key, frameIdx).setScale(scale).setOrigin(0.5);
        this.container.add(img);
        if (cellPx >= 24) {
          const t = this.add
            .text(ox + c * cellPx + 1, oy + screenR * cellPx + 1, `${frameIdx}`, {
              fontFamily: 'monospace',
              fontSize: '8px',
              color: '#ffd76a',
              backgroundColor: '#0009',
            })
            .setOrigin(0, 0);
          this.container.add(t);
        }
      }
    }
  }
}
