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
  rows: number;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  tileSize: number;
}

interface SpanOptions {
  rowChunks?: number;
  colChunks?: number;
}

function span(
  key: string,
  label: string,
  grid: { cols: number; rows: number },
  tile: number,
  opts: SpanOptions = {},
): SheetView[] {
  const rowChunks = opts.rowChunks ?? 1;
  const colChunks = opts.colChunks ?? 1;
  const out: SheetView[] = [];
  const rowsPerChunk = Math.ceil(grid.rows / rowChunks);
  const colsPerChunk = Math.ceil(grid.cols / colChunks);
  for (let ri = 0; ri < rowChunks; ri++) {
    for (let ci = 0; ci < colChunks; ci++) {
      const rowStart = ri * rowsPerChunk;
      const rowEnd = Math.min(grid.rows, rowStart + rowsPerChunk);
      const colStart = ci * colsPerChunk;
      const colEnd = Math.min(grid.cols, colStart + colsPerChunk);
      const labelParts: string[] = [];
      if (rowChunks > 1) labelParts.push(`r ${rowStart}–${rowEnd - 1}`);
      if (colChunks > 1) labelParts.push(`c ${colStart}–${colEnd - 1}`);
      out.push({
        key,
        label: labelParts.length ? `${label} ${labelParts.join(' ')}` : label,
        cols: grid.cols,
        rows: grid.rows,
        rowStart,
        rowEnd,
        colStart,
        colEnd,
        tileSize: tile,
      });
    }
  }
  return out;
}

// rpg-pack chunked into 3 row-bands × 3 col-bands so each tile is readable at
// 4× zoom with frame-index labels.
const SHEETS: SheetView[] = [
  ...span(ASSET_KEYS.sprites.rpg, 'rpg', RPG_GRID, 16, { rowChunks: 3, colChunks: 3 }),
  ...span(ASSET_KEYS.sprites.chars, 'chars', CHARS_GRID, 16),
  ...span(ASSET_KEYS.ui.large, 'ui-large', UI_LARGE_GRID, 32),
  ...span(ASSET_KEYS.ui.small, 'ui-small', UI_SMALL_GRID, 16),
  ...span(ASSET_KEYS.ui.inputs, 'inputs', INPUT_GRID, 16, { rowChunks: 3 }),
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
    const visibleCols = view.colEnd - view.colStart;
    const sheetPxW = visibleCols * view.tileSize;
    const sheetPxH = visibleRows * view.tileSize;
    const maxW = GAME_WIDTH - 32;
    const maxH = GAME_HEIGHT - 80;
    const scale = Math.max(1, Math.min(Math.floor(maxW / sheetPxW), Math.floor(maxH / sheetPxH)));

    const cellPx = view.tileSize * scale;
    const totalW = visibleCols * cellPx;
    const totalH = visibleRows * cellPx;
    const ox = Math.floor((GAME_WIDTH - totalW) / 2);
    const oy = Math.floor((GAME_HEIGHT - totalH) / 2) + 8;

    this.headerText.setText(
      `[${this.idx + 1}/${SHEETS.length}] ${view.label} — ${visibleCols}×${visibleRows} cells @ ${scale}×`,
    );

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x222230, 0.6);
    for (let c = 0; c <= visibleCols; c++) grid.lineBetween(ox + c * cellPx, oy, ox + c * cellPx, oy + totalH);
    for (let r = 0; r <= visibleRows; r++) grid.lineBetween(ox, oy + r * cellPx, ox + totalW, oy + r * cellPx);
    this.container.add(grid);

    for (let r = view.rowStart; r < view.rowEnd; r++) {
      for (let c = view.colStart; c < view.colEnd; c++) {
        const frameIdx = r * view.cols + c;
        const screenR = r - view.rowStart;
        const screenC = c - view.colStart;
        const px = ox + screenC * cellPx + cellPx / 2;
        const py = oy + screenR * cellPx + cellPx / 2;
        const img = this.add.image(px, py, view.key, frameIdx).setScale(scale).setOrigin(0.5);
        this.container.add(img);
        if (cellPx >= 24) {
          const t = this.add
            .text(ox + screenC * cellPx + 1, oy + screenR * cellPx + 1, `${frameIdx}`, {
              fontFamily: 'monospace',
              fontSize: cellPx >= 48 ? '10px' : '8px',
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
