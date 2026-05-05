import Phaser from 'phaser';
import {
  ASSET_KEYS,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_SCALE,
  SCENE_KEYS,
  TILE_SIZE,
  TILE_SIZE_SOURCE,
} from '@/config';
import { CharsSheet, Inputs, TilesRPG, UiLarge } from '@/world/FrameCatalog';
import { KenneyPlank } from '@/ui/KenneyPlank';
import { getServices } from '@/services';
import {
  createEmptyMap,
  EMPTY_TILE,
  requireLayer,
  setTile,
  type MapData,
  type MapLayer,
} from '@/world/MapData';
import { MapEditor } from '@/editor/MapEditor';
import { buildPaintAction } from '@/editor/EditorAction';
import { downloadMapAsTiledJSON, loadMapFromLocal, saveMapToLocal, TOWN_MAP_KEY } from '@/editor/MapStore';
import { TOWN_PALETTE } from '@/editor/TownPalette';

const TOWN_W = Math.floor(GAME_WIDTH / TILE_SIZE);
const TOWN_H = Math.floor(GAME_HEIGHT / TILE_SIZE);
const STEP_TWEEN_MS = 130;
const TERRAIN_LAYER = 'terrain';

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  roof: number;
  wall: number;
}

const BUILDINGS: Building[] = [
  { x: 2, y: 2, w: 5, h: 4, label: 'Apothecary', roof: 0x8a3a3a, wall: 0xc9a06b },
  { x: 9, y: 2, w: 5, h: 4, label: 'Blacksmith', roof: 0x4a5a6a, wall: 0xc9a06b },
  { x: 16, y: 2, w: 5, h: 4, label: 'Inn', roof: 0x6a4a2f, wall: 0xc9a06b },
  { x: 2, y: 11, w: 5, h: 3, label: 'Upgrade Shrine', roof: 0x9a7a3a, wall: 0xc9a06b },
];

const LAKE = { x: 8, y: 10, w: 5, h: 4 };
const DUNGEON_ENTRANCE = { x: 17, y: 11, w: 4, h: 3 };

/**
 * Tallowmark — the hub town.
 *
 * Terrain (grass / dirt / decorations) loads from a `MapData` model — either
 * a saved one in localStorage, or a procedural default. Buildings, lake, and
 * dungeon entrance are still drawn procedurally on top.
 *
 * Press **F8** in dev mode to enter the in-game paint editor.
 */
export class TownScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Image;
  private playerTile = { x: 11, y: 8 };
  private moving = false;

  // Map data + editor.
  private mapData!: MapData;
  private editor!: MapEditor;
  private terrainSprites: Array<Array<Phaser.GameObjects.Image | undefined>> = [];

  // Edit mode state.
  private editing = false;
  private editorUi?: Phaser.GameObjects.Container;
  private hoverHighlight?: Phaser.GameObjects.Rectangle;
  private selectedFrame: number = TilesRPG.grass;
  private painting = false;
  private currentStrokeCells: Array<{ x: number; y: number; before: number; after: number }> = [];
  private editStatusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Town);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('town');

    // Load saved map → fall back to procedural default.
    this.mapData = loadMapFromLocal(TOWN_MAP_KEY) ?? this.buildDefaultMap();
    this.editor = new MapEditor(this.mapData);

    this.drawTerrain();
    this.drawLake();
    for (const b of BUILDINGS) this.drawBuilding(b);
    this.drawDungeonEntrance();
    this.drawPlayer();
    this.drawHud();

    this.input.keyboard?.on('keydown-ESC', () => this.onEsc());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  // ---------- Terrain (data-driven) ----------

  private buildDefaultMap(): MapData {
    const map = createEmptyMap({
      width: TOWN_W,
      height: TOWN_H,
      tileWidth: TILE_SIZE_SOURCE,
      tileHeight: TILE_SIZE_SOURCE,
      tileset: 'rpg',
    });
    const layer = requireLayer(map, TERRAIN_LAYER);
    for (let y = 0; y < TOWN_H; y++) {
      for (let x = 0; x < TOWN_W; x++) setTile(layer, x, y, TilesRPG.grass);
    }
    // Horizontal stone path across the middle.
    for (let x = 0; x < TOWN_W; x++) setTile(layer, x, 8, TilesRPG.dirt);
    // Vertical spur down to the dungeon arch.
    for (let y = 8; y < DUNGEON_ENTRANCE.y; y++) {
      setTile(layer, DUNGEON_ENTRANCE.x + 1, y, TilesRPG.dirt);
    }
    return map;
  }

  private drawTerrain(): void {
    const layer = requireLayer(this.mapData, TERRAIN_LAYER);
    this.terrainSprites = Array.from({ length: layer.height }, () => new Array(layer.width));
    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const frame = layer.data[y * layer.width + x] ?? EMPTY_TILE;
        if (frame === EMPTY_TILE) continue;
        this.terrainSprites[y]![x] = this.add
          .image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            ASSET_KEYS.sprites.rpg,
            frame,
          )
          .setScale(RENDER_SCALE);
      }
    }
  }

  /** Replace the visual at (x, y) to match the data layer. Called after edits. */
  private rerenderTile(x: number, y: number): void {
    const old = this.terrainSprites[y]?.[x];
    if (old) old.destroy();
    const layer = requireLayer(this.mapData, TERRAIN_LAYER);
    const frame = layer.data[y * layer.width + x] ?? EMPTY_TILE;
    if (frame === EMPTY_TILE) {
      if (this.terrainSprites[y]) this.terrainSprites[y]![x] = undefined;
      return;
    }
    if (!this.terrainSprites[y]) this.terrainSprites[y] = [];
    this.terrainSprites[y]![x] = this.add
      .image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, ASSET_KEYS.sprites.rpg, frame)
      .setScale(RENDER_SCALE)
      .setDepth(0);
  }

  // ---------- Procedural overlays (lake, buildings, dungeon arch) ----------

  private drawLake(): void {
    const px = LAKE.x * TILE_SIZE;
    const py = LAKE.y * TILE_SIZE;
    const pw = LAKE.w * TILE_SIZE;
    const ph = LAKE.h * TILE_SIZE;
    this.add.rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 4, 0x4a8aa8).setStrokeStyle(3, 0x2a5870);
    for (let i = 0; i < 4; i++) {
      const rx = px + 8 + Math.floor((i * 17) % (pw - 64));
      const ry = py + 12 + i * 28;
      this.add.rectangle(rx, ry, 24, 2, 0x6aa8c8).setOrigin(0, 0.5);
    }
    this.add
      .text(px + pw / 2, py - 6, 'Pond', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#cfe7f0',
        stroke: '#1a1a24',
        strokeThickness: 4,
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 1);
  }

  private drawBuilding(b: Building): void {
    const px = b.x * TILE_SIZE;
    const py = b.y * TILE_SIZE;
    const pw = b.w * TILE_SIZE;
    const ph = b.h * TILE_SIZE;
    const roofH = Math.floor(ph * 0.4);
    this.add.rectangle(px + pw / 2, py + roofH / 2, pw - 4, roofH - 2, b.roof).setStrokeStyle(2, 0x1a1a24);
    this.add
      .rectangle(px + pw / 2, py + roofH + (ph - roofH) / 2, pw - 4, ph - roofH - 2, b.wall)
      .setStrokeStyle(2, 0x1a1a24);
    const doorH = TILE_SIZE;
    this.add
      .rectangle(px + pw / 2, py + ph - doorH / 2 - 4, TILE_SIZE * 0.7, doorH, 0x3a2a1f)
      .setStrokeStyle(2, 0x1a1a24);
    const winY = py + roofH + (ph - roofH) * 0.35;
    this.add
      .rectangle(px + pw * 0.25, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8)
      .setStrokeStyle(2, 0x1a1a24);
    this.add
      .rectangle(px + pw * 0.75, winY, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xa0c8d8)
      .setStrokeStyle(2, 0x1a1a24);
    this.add
      .text(px + pw / 2, py - 6, b.label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
  }

  private drawDungeonEntrance(): void {
    const e = DUNGEON_ENTRANCE;
    const px = e.x * TILE_SIZE;
    const py = e.y * TILE_SIZE;
    const pw = e.w * TILE_SIZE;
    const ph = e.h * TILE_SIZE;
    this.add.rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 2, 0x4a4a52).setStrokeStyle(3, 0x1a1a24);
    this.add
      .rectangle(px + pw / 2, py + ph * 0.6, TILE_SIZE * 1.5, TILE_SIZE * 1.8, 0x14101a)
      .setStrokeStyle(2, 0x1a1a24);
    this.add
      .text(px + pw / 2, py - 6, 'TO THE DEEP ↓', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d4a24c',
        stroke: '#1a1a24',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
  }

  private drawPlayer(): void {
    const px = this.playerTile.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.playerTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.playerSprite = this.add
      .image(px, py, ASSET_KEYS.sprites.chars, CharsSheet.player)
      .setScale(RENDER_SCALE)
      .setDepth(10);
  }

  private drawHud(): void {
    const services = getServices(this);
    new KenneyPlank({ scene: this, x: 4, y: 4, width: 200, height: 50, variant: 'wood' }).setDepth(99);
    this.add
      .text(14, 12, 'TALLOWMARK', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d4a24c',
        fontStyle: 'bold',
        stroke: '#1a1a24',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(1000);
    this.add
      .text(14, 32, `Embers: ${services.persistent.metaCurrency}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        stroke: '#1a1a24',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(1000);
    this.drawHudIcons();
    this.drawFooter();
    void COLORS;
  }

  private drawHudIcons(): void {
    const items: Array<{ frame: number; key: string; onClick: () => void }> = [
      { frame: UiLarge.buttonGrey, key: 'I', onClick: () => this.openOverlay(SCENE_KEYS.Inventory) },
      { frame: UiLarge.buttonGrey, key: 'C', onClick: () => this.openOverlay(SCENE_KEYS.Character) },
    ];
    let x = GAME_WIDTH - 24;
    const y = 24;
    for (const it of items) {
      const slice = this.add
        .nineslice(x, y, ASSET_KEYS.ui.large, it.frame, 36, 36, 6, 6, 6, 6)
        .setOrigin(0.5)
        .setDepth(1000);
      this.add
        .text(x, y, it.key, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#3a2a1f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(1001);
      const zone = this.add
        .zone(x, y, 36, 36)
        .setOrigin(0.5)
        .setDepth(1002)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => slice.setAlpha(0.9));
      zone.on('pointerout', () => slice.setAlpha(1));
      zone.on('pointerdown', () => slice.setAlpha(0.78));
      zone.on('pointerup', () => {
        slice.setAlpha(1);
        try {
          getServices(this).audio.playSfx(ASSET_KEYS.audio.sfxClick);
        } catch {
          /* test contexts */
        }
        it.onClick();
      });
      x -= 42;
    }
  }

  private drawFooter(): void {
    const footerY = GAME_HEIGHT - 18;
    let fx = 10;
    const addPrompt = (frame: number, text: string) => {
      this.add.image(fx, footerY, ASSET_KEYS.ui.inputs, frame).setOrigin(0, 0.5).setScale(2).setDepth(1000);
      fx += 28;
      const t = this.add
        .text(fx, footerY, text, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e5e3d8',
          stroke: '#1a1a24',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5)
        .setDepth(1000);
      fx += t.width + 14;
    };
    addPrompt(Inputs.mouseLeft, 'walk');
    addPrompt(Inputs.keyEsc, 'menu');
  }

  // ---------- Input — gameplay or edit mode ----------

  private onEsc(): void {
    if (this.editing) {
      this.exitEditMode();
      return;
    }
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.editing) {
      this.startStroke(p);
      return;
    }
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.isInDungeonArch(tx, ty)) {
      this.promptDescend();
      return;
    }
    if (!this.inTownBounds(tx, ty)) return;
    this.movePlayerTo(tx, ty);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.editing) return;
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (!this.inTownBounds(tx, ty)) {
      this.hoverHighlight?.setVisible(false);
      return;
    }
    this.hoverHighlight
      ?.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2)
      .setVisible(true);
    if (this.painting) {
      this.extendStroke(tx, ty, p);
    }
  }

  private onPointerUp(): void {
    if (this.editing && this.painting) this.commitStroke();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'F8' && import.meta.env.DEV) {
      e.preventDefault();
      this.toggleEditMode();
      return;
    }
    // Edit mode owns the keyboard. Don't fall through to gameplay handlers
    // (movement, overlays, etc.) when the editor is active.
    if (this.editing) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const c = e.code;
    let dx = 0;
    let dy = 0;
    if (k === 'arrowup' || k === 'w' || c === 'ArrowUp' || c === 'KeyW') {
      dy = -1;
    } else if (k === 'arrowdown' || k === 's' || c === 'ArrowDown' || c === 'KeyS') {
      dy = 1;
    } else if (k === 'arrowleft' || k === 'a' || c === 'ArrowLeft' || c === 'KeyA') {
      dx = -1;
    } else if (k === 'arrowright' || k === 'd' || c === 'ArrowRight' || c === 'KeyD') {
      dx = 1;
    } else if (k === 'enter' || k === ' ' || c === 'Enter' || c === 'Space') {
      if (
        Math.abs(this.playerTile.x - (DUNGEON_ENTRANCE.x + DUNGEON_ENTRANCE.w / 2)) <= 2 &&
        Math.abs(this.playerTile.y - (DUNGEON_ENTRANCE.y + DUNGEON_ENTRANCE.h / 2)) <= 2
      ) {
        this.promptDescend();
      }
      return;
    } else if (k === 'i' || c === 'KeyI') {
      this.openOverlay(SCENE_KEYS.Inventory);
      return;
    } else if (k === 'c' || c === 'KeyC') {
      this.openOverlay(SCENE_KEYS.Character);
      return;
    } else {
      return;
    }
    this.movePlayerTo(this.playerTile.x + dx, this.playerTile.y + dy);
  }

  private movePlayerTo(x: number, y: number): void {
    if (!this.inTownBounds(x, y) || this.moving) return;
    this.playerTile = { x, y };
    this.moving = true;
    this.tweens.add({
      targets: this.playerSprite,
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
      duration: STEP_TWEEN_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.moving = false;
      },
    });
  }

  private openOverlay(key: string): void {
    this.scene.launch(key, { returnTo: SCENE_KEYS.Town });
    this.scene.pause();
  }

  // ---------- Edit mode ----------

  private toggleEditMode(): void {
    if (this.editing) this.exitEditMode();
    else this.enterEditMode();
  }

  private enterEditMode(): void {
    this.editing = true;
    this.painting = false;
    this.currentStrokeCells = [];

    this.hoverHighlight = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0)
      .setStrokeStyle(2, 0xffd76a, 0.95)
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);

    this.editorUi = this.buildEditorUi();
    this.updateEditStatus('paint');

    // Bind editor keys via Phaser's specific keydown-* events so they don't
    // collide with the generic onKey handler (which also handles movement
    // 's', 'a' etc.). preventDefault stops the browser from doing anything
    // odd with these keys.
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-Z', this.onEditZ, this);
      kb.on('keydown-Y', this.onEditRedoKey, this);
      kb.on('keydown-S', this.onEditSaveKey, this);
      kb.on('keydown-E', this.onEditExportKey, this);
    }
  }

  private exitEditMode(): void {
    this.editing = false;
    this.painting = false;
    this.hoverHighlight?.destroy();
    this.hoverHighlight = undefined;
    this.editorUi?.destroy();
    this.editorUi = undefined;

    const kb = this.input.keyboard;
    if (kb) {
      kb.off('keydown-Z', this.onEditZ, this);
      kb.off('keydown-Y', this.onEditRedoKey, this);
      kb.off('keydown-S', this.onEditSaveKey, this);
      kb.off('keydown-E', this.onEditExportKey, this);
    }
  }

  private onEditZ(e: KeyboardEvent): void {
    e.preventDefault();
    if (e.shiftKey) this.applyRedo();
    else this.applyUndo();
  }
  private onEditRedoKey(e: KeyboardEvent): void {
    e.preventDefault();
    this.applyRedo();
  }
  private onEditSaveKey(e: KeyboardEvent): void {
    e.preventDefault();
    saveMapToLocal(TOWN_MAP_KEY, this.mapData);
    this.updateEditStatus('saved to localStorage');
  }
  private onEditExportKey(e: KeyboardEvent): void {
    e.preventDefault();
    downloadMapAsTiledJSON(this.mapData, 'town.json');
    this.updateEditStatus('exported town.json');
  }

  private buildEditorUi(): Phaser.GameObjects.Container {
    const w = 152;
    const x = GAME_WIDTH - w - 8;
    const y = 70;
    const h = TOWN_PALETTE.length * 50 + 90;
    const container = this.add.container(0, 0).setDepth(200);

    container.add(
      new KenneyPlank({ scene: this, x, y, width: w, height: h, variant: 'slate', alpha: 0.94 }).setOrigin(0, 0),
    );

    const title = this.add
      .text(x + w / 2, y + 8, 'EDIT MODE', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e3d8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);

    let py = y + 30;
    for (const entry of TOWN_PALETTE) {
      const isSelected = entry.frame === this.selectedFrame;
      const slice = this.add
        .nineslice(
          x + 14,
          py,
          ASSET_KEYS.ui.large,
          isSelected ? UiLarge.buttonBrown : UiLarge.buttonDark,
          w - 28,
          40,
          6,
          6,
          6,
          6,
        )
        .setOrigin(0, 0)
        .setDepth(201);
      const sprite = this.add
        .image(x + 14 + 22, py + 20, ASSET_KEYS.sprites.rpg, entry.frame)
        .setScale(2)
        .setDepth(202);
      const label = this.add
        .text(x + 14 + 44, py + 20, entry.label, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: isSelected ? '#3a2a1f' : '#e5e3d8',
        })
        .setOrigin(0, 0.5)
        .setDepth(202);
      const zone = this.add
        .zone(x + 14, py, w - 28, 40)
        .setOrigin(0, 0)
        .setDepth(203)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        this.selectedFrame = entry.frame;
        this.refreshEditorUi();
      });
      container.add([slice, sprite, label, zone]);
      py += 50;
    }

    this.editStatusText = this.add
      .text(x + 8, y + h - 18, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cfcfd5',
      })
      .setOrigin(0, 0)
      .setDepth(201);
    container.add(this.editStatusText);
    return container;
  }

  private refreshEditorUi(): void {
    this.editorUi?.destroy();
    this.editorUi = this.buildEditorUi();
    this.updateEditStatus('select');
  }

  private updateEditStatus(action: string): void {
    if (!this.editStatusText) return;
    const undo = this.editor.canUndo() ? '↶' : ' ';
    const redo = this.editor.canRedo() ? '↷' : ' ';
    this.editStatusText.setText(
      `[${action}] depth ${this.editor.undoDepth()} ${undo}${redo}\nF8 exit · Z undo · ⇧Z redo · S save · E export · RMB erase`,
    );
  }

  private startStroke(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (!this.inTownBounds(tx, ty)) return;
    this.painting = true;
    this.currentStrokeCells = [];
    const target = p.rightButtonDown() ? EMPTY_TILE : this.selectedFrame;
    this.paintCell(tx, ty, target);
  }

  private extendStroke(tx: number, ty: number, p: Phaser.Input.Pointer): void {
    const target = p.rightButtonDown() ? EMPTY_TILE : this.selectedFrame;
    this.paintCell(tx, ty, target);
  }

  private paintCell(tx: number, ty: number, frame: number): void {
    const layer: MapLayer = requireLayer(this.mapData, TERRAIN_LAYER);
    const before = layer.data[ty * layer.width + tx] ?? EMPTY_TILE;
    if (before === frame) return; // no-op
    // Skip if this cell already painted in the active stroke.
    if (this.currentStrokeCells.some((c) => c.x === tx && c.y === ty)) return;
    this.currentStrokeCells.push({ x: tx, y: ty, before, after: frame });
    // Apply locally to keep the visual fresh during the stroke; the final
    // committed action will be a 'stroke' for one-click undo.
    setTile(layer, tx, ty, frame);
    this.rerenderTile(tx, ty);
  }

  private commitStroke(): void {
    this.painting = false;
    if (this.currentStrokeCells.length === 0) return;
    if (this.currentStrokeCells.length === 1) {
      // Single-cell strokes log as a paint action so the action log is tidy.
      const c = this.currentStrokeCells[0]!;
      // Roll back the eager local apply, then push through the editor.
      const layer = requireLayer(this.mapData, TERRAIN_LAYER);
      setTile(layer, c.x, c.y, c.before);
      this.rerenderTile(c.x, c.y);
      this.editor.apply(buildPaintAction(this.mapData, TERRAIN_LAYER, c.x, c.y, c.after));
      this.rerenderTile(c.x, c.y);
    } else {
      // Roll back all eager local applies first.
      const layer = requireLayer(this.mapData, TERRAIN_LAYER);
      for (const c of this.currentStrokeCells) setTile(layer, c.x, c.y, c.before);
      this.editor.apply({
        kind: 'stroke',
        layer: TERRAIN_LAYER,
        cells: [...this.currentStrokeCells],
      });
      for (const c of this.currentStrokeCells) this.rerenderTile(c.x, c.y);
    }
    this.currentStrokeCells = [];
    this.updateEditStatus('paint');
  }

  private applyUndo(): void {
    const action = this.editor.undo();
    if (!action) {
      this.updateEditStatus('nothing to undo');
      return;
    }
    this.rerenderActionCells(action);
    this.updateEditStatus('undo');
  }

  private applyRedo(): void {
    const action = this.editor.redo();
    if (!action) {
      this.updateEditStatus('nothing to redo');
      return;
    }
    this.rerenderActionCells(action);
    this.updateEditStatus('redo');
  }

  private rerenderActionCells(action: { kind: 'paint' | 'stroke'; cells?: ReadonlyArray<{ x: number; y: number }>; x?: number; y?: number }): void {
    if (action.kind === 'paint' && typeof action.x === 'number' && typeof action.y === 'number') {
      this.rerenderTile(action.x, action.y);
    } else if (action.kind === 'stroke' && action.cells) {
      for (const c of action.cells) this.rerenderTile(c.x, c.y);
    }
  }

  // ---------- Helpers ----------

  private inTownBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H;
  }

  private isInDungeonArch(x: number, y: number): boolean {
    return (
      x >= DUNGEON_ENTRANCE.x &&
      x < DUNGEON_ENTRANCE.x + DUNGEON_ENTRANCE.w &&
      y >= DUNGEON_ENTRANCE.y &&
      y < DUNGEON_ENTRANCE.y + DUNGEON_ENTRANCE.h
    );
  }

  private promptDescend(): void {
    this.scene.launch(SCENE_KEYS.ConfirmDialog, {
      title: 'Descend?',
      body: 'You will lose any items on your person if you die.\nMeta-currency you earn returns with you.',
      confirmText: 'Descend',
      cancelText: 'Stay',
      onConfirm: () => this.scene.start(SCENE_KEYS.Dungeon, { fresh: true }),
    });
  }
}
