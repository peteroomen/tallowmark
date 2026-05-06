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
const OVERLAY_LAYER = 'overlay';

const LAYER_DEPTHS: Record<string, number> = {
  [TERRAIN_LAYER]: 0,
  [OVERLAY_LAYER]: 5,
};

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
  /** Per-layer 2D arrays of sprite refs so we can re-render single tiles. */
  private layerSprites: Record<string, Array<Array<Phaser.GameObjects.Image | undefined>>> = {};

  // Edit mode state.
  private editing = false;
  private editorUi?: Phaser.GameObjects.Container;
  private hoverHighlight?: Phaser.GameObjects.Rectangle;
  private selectedFrame: number = TilesRPG.grass;
  private selectedLayer: string = TERRAIN_LAYER;
  private painting = false;
  private currentStrokeCells: Array<{ x: number; y: number; before: number; after: number; layer: string }> = [];
  private editStatusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Town);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('town');

    // Load saved map → fall back to procedural default. Older saved maps
    // were single-layer; ensureLayers() backfills the overlay layer.
    this.mapData = loadMapFromLocal(TOWN_MAP_KEY) ?? this.buildDefaultMap();
    this.ensureLayers(this.mapData);
    this.editor = new MapEditor(this.mapData);

    this.drawTerrain();
    this.drawLake();
    for (const b of BUILDINGS) this.drawBuilding(b);
    this.drawDungeonEntrance();
    this.drawDecorations();
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
    // Terrain layer — base ground. Defaults to grass everywhere, with
    // scattered grassAlt for visual variety so the field doesn't look flat.
    const terrain = requireLayer(map, TERRAIN_LAYER);
    for (let y = 0; y < TOWN_H; y++) {
      for (let x = 0; x < TOWN_W; x++) {
        // Deterministic checker-noise pattern — about 1 in 6 tiles get the
        // alt grass frame. Stable across reloads since it's pure x/y math.
        const alt = (x * 7 + y * 11) % 13 === 0 || (x * 3 + y * 5) % 17 === 0;
        setTile(terrain, x, y, alt ? TilesRPG.grassAlt : TilesRPG.grass);
      }
    }
    // Main horizontal road across the middle of town.
    for (let x = 0; x < TOWN_W; x++) setTile(terrain, x, 8, TilesRPG.dirt);
    // Vertical stone path leading up to the dungeon arch.
    for (let y = 8; y < DUNGEON_ENTRANCE.y; y++) {
      setTile(terrain, DUNGEON_ENTRANCE.x + 1, y, TilesRPG.pathStone);
      setTile(terrain, DUNGEON_ENTRANCE.x + 2, y, TilesRPG.pathStone);
    }
    // Short dirt stubs from the road up to each row-2 building's door.
    for (const bx of [4, 11, 18]) {
      for (let y = 6; y <= 7; y++) setTile(terrain, bx, y, TilesRPG.dirt);
    }
    // Path stub from row-11 Upgrade Shrine south down to bottom edge.
    for (let y = 14; y < TOWN_H; y++) setTile(terrain, 4, y, TilesRPG.dirt);

    // Overlay layer — decorations sit on top of terrain. Default empty.
    map.layers.push({
      name: OVERLAY_LAYER,
      width: TOWN_W,
      height: TOWN_H,
      data: new Array(TOWN_W * TOWN_H).fill(EMPTY_TILE),
    });
    return map;
  }

  /** Ensure the loaded map has both layers — older saved maps won't have overlay. */
  private ensureLayers(map: MapData): void {
    if (!map.layers.find((l) => l.name === OVERLAY_LAYER)) {
      map.layers.push({
        name: OVERLAY_LAYER,
        width: map.width,
        height: map.height,
        data: new Array(map.width * map.height).fill(EMPTY_TILE),
      });
    }
  }

  private drawTerrain(): void {
    // Render each layer in declaration order so overlay sprites composite on
    // top of terrain. setDepth on each sprite gives Phaser an explicit
    // z-order in case unrelated GameObjects (HUD, decorations from
    // drawDecorations) get rendered between layers.
    for (const layer of this.mapData.layers) {
      const grid: Array<Array<Phaser.GameObjects.Image | undefined>> = Array.from(
        { length: layer.height },
        () => new Array(layer.width),
      );
      this.layerSprites[layer.name] = grid;
      const depth = LAYER_DEPTHS[layer.name] ?? 0;
      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const frame = layer.data[y * layer.width + x] ?? EMPTY_TILE;
          if (frame === EMPTY_TILE) continue;
          grid[y]![x] = this.add
            .image(
              x * TILE_SIZE + TILE_SIZE / 2,
              y * TILE_SIZE + TILE_SIZE / 2,
              ASSET_KEYS.sprites.rpg,
              frame,
            )
            .setScale(RENDER_SCALE)
            .setDepth(depth);
        }
      }
    }
  }

  /**
   * Replace the visual at (layer, x, y) to match the data layer. Called
   * after a paint edit. Sprites are tracked per-layer so painting the
   * overlay doesn't disturb the terrain underneath.
   */
  private rerenderTile(layerName: string, x: number, y: number): void {
    const grid = this.layerSprites[layerName];
    if (!grid) return;
    const old = grid[y]?.[x];
    if (old) old.destroy();
    const layer = requireLayer(this.mapData, layerName);
    const frame = layer.data[y * layer.width + x] ?? EMPTY_TILE;
    if (frame === EMPTY_TILE) {
      if (grid[y]) grid[y]![x] = undefined;
      return;
    }
    if (!grid[y]) grid[y] = [];
    grid[y]![x] = this.add
      .image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, ASSET_KEYS.sprites.rpg, frame)
      .setScale(RENDER_SCALE)
      .setDepth(LAYER_DEPTHS[layerName] ?? 0);
  }

  // ---------- Procedural overlays (lake, buildings, dungeon arch) ----------

  private drawLake(): void {
    // Draw the lake from the rpg-pack water 9-slice atlas. Each cell of the
    // LAKE rectangle picks the appropriate corner / edge / center frame.
    const w = LAKE.w;
    const h = LAKE.h;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const isLeft = xx === 0;
        const isRight = xx === w - 1;
        const isTop = yy === 0;
        const isBottom = yy === h - 1;
        let frame: number;
        if (isTop && isLeft) frame = TilesRPG.waterTL;
        else if (isTop && isRight) frame = TilesRPG.waterTR;
        else if (isBottom && isLeft) frame = TilesRPG.waterBL;
        else if (isBottom && isRight) frame = TilesRPG.waterBR;
        else if (isTop) frame = TilesRPG.waterT;
        else if (isBottom) frame = TilesRPG.waterB;
        else if (isLeft) frame = TilesRPG.waterL;
        else if (isRight) frame = TilesRPG.waterR;
        else frame = TilesRPG.waterC;
        const cx = (LAKE.x + xx) * TILE_SIZE + TILE_SIZE / 2;
        const cy = (LAKE.y + yy) * TILE_SIZE + TILE_SIZE / 2;
        this.add.image(cx, cy, ASSET_KEYS.sprites.rpg, frame).setScale(RENDER_SCALE);
      }
    }
    // Subtle italic label above the pond — it's small enough to read as one
    // body of water but the label still helps it land as intentional.
    this.add
      .text((LAKE.x + LAKE.w / 2) * TILE_SIZE, LAKE.y * TILE_SIZE - 6, 'Pond', {
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

    // Dark stone backing so the arch tile reads as the centerpiece.
    this.add.rectangle(px + pw / 2, py + ph / 2, pw - 4, ph - 2, 0x32323a).setStrokeStyle(3, 0x1a1a24);

    // Carved stone arch tile (frame 624) — placed at the center of the lower
    // portion, scaled up so it dominates.
    this.add
      .image(px + pw / 2, py + ph * 0.62, ASSET_KEYS.sprites.rpg, TilesRPG.dungeonStoneArch)
      .setScale(RENDER_SCALE * 1.4)
      .setOrigin(0.5);

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

  private drawDecorations(): void {
    // Outdoor decorations — placed in gaps between buildings, lake, and paths.
    // Frames come from the confirmed entries in TilesRPG.
    type Decor = { x: number; y: number; frame: number };
    const decor: Decor[] = [];

    // Dense forest along the LEFT edge (col 0) and TOP-LEFT corner — this is
    // the wilderness pressing in on the town from the west.
    const forest: Array<[number, number, number]> = [
      [0, 0, TilesRPG.treePineDark],
      [0, 1, TilesRPG.treePine],
      [0, 2, TilesRPG.treeRound],
      [0, 3, TilesRPG.treePineDark],
      [0, 4, TilesRPG.treePine],
      [0, 5, TilesRPG.treeRound],
      [0, 6, TilesRPG.treePineDark],
      [0, 7, TilesRPG.treePine],
      [0, 9, TilesRPG.treePineDark],
      [0, 10, TilesRPG.treePine],
      [0, 11, TilesRPG.treeRound],
      [0, 12, TilesRPG.treePineDark],
      [0, 13, TilesRPG.treePine],
      [0, 14, TilesRPG.treeRound],
      [0, 15, TilesRPG.treePineDark],
      [1, 0, TilesRPG.treePine],
      [1, 1, TilesRPG.treePineDark],
      [1, 12, TilesRPG.treePine],
      [1, 14, TilesRPG.treePineDark],
      [1, 15, TilesRPG.treePine],
    ];
    for (const [x, y, frame] of forest) decor.push({ x, y, frame });

    // Top-right corner trees — bookend the town with greenery.
    decor.push({ x: 22, y: 0, frame: TilesRPG.treePine });
    decor.push({ x: 23, y: 0, frame: TilesRPG.treePineDark });
    decor.push({ x: 23, y: 1, frame: TilesRPG.treeRound });

    // Trees framing the buildings on row 2-5 (between buildings and lake).
    decor.push({ x: 7, y: 1, frame: TilesRPG.treePine });
    decor.push({ x: 8, y: 1, frame: TilesRPG.treeAutumn });
    decor.push({ x: 14, y: 1, frame: TilesRPG.treePineDark });
    decor.push({ x: 15, y: 1, frame: TilesRPG.treePine });
    decor.push({ x: 21, y: 1, frame: TilesRPG.treeRound });

    // Campsite — top-center, between Blacksmith and Inn (cols 6-8, row 0).
    decor.push({ x: 6, y: 0, frame: TilesRPG.tentGreenL });
    decor.push({ x: 7, y: 0, frame: TilesRPG.tentGreenR });
    decor.push({ x: 8, y: 0, frame: TilesRPG.campfireLit });

    // Market strip — right side between Inn and the Pond/Dungeon (cols 21-23,
    // rows 5-7). Awning row over a table + crates/barrels under it.
    decor.push({ x: 21, y: 5, frame: TilesRPG.awningStripeL });
    decor.push({ x: 22, y: 5, frame: TilesRPG.awningStripeC });
    decor.push({ x: 23, y: 5, frame: TilesRPG.awningStripeR });
    decor.push({ x: 22, y: 6, frame: TilesRPG.tableMkt });
    decor.push({ x: 21, y: 6, frame: TilesRPG.barrelsH });
    decor.push({ x: 23, y: 6, frame: TilesRPG.crateWood });
    decor.push({ x: 22, y: 7, frame: TilesRPG.anvil });

    // Cemetery — bottom-right (cols 20-23, rows 12-15). A small graveyard
    // beyond the dungeon arch with fence boundary on the north side.
    decor.push({ x: 20, y: 12, frame: TilesRPG.fenceH });
    decor.push({ x: 21, y: 12, frame: TilesRPG.fenceHMid });
    decor.push({ x: 22, y: 12, frame: TilesRPG.fenceH });
    decor.push({ x: 23, y: 12, frame: TilesRPG.fenceHEnd });
    decor.push({ x: 20, y: 13, frame: TilesRPG.gravestone1 });
    decor.push({ x: 22, y: 13, frame: TilesRPG.gravestone2 });
    decor.push({ x: 21, y: 14, frame: TilesRPG.crossStone });
    decor.push({ x: 23, y: 14, frame: TilesRPG.gravestone3 });
    decor.push({ x: 20, y: 15, frame: TilesRPG.crossWood });
    decor.push({ x: 22, y: 15, frame: TilesRPG.crossStone });

    // Signpost / well near the dungeon entrance to mark the path.
    decor.push({ x: 16, y: 11, frame: TilesRPG.wellStone });

    // Ambient scatter — flowers, mushrooms, small rocks, the odd bush. Small
    // touches to break up open grass.
    const ambient: Array<[number, number, number]> = [
      [3, 0, TilesRPG.flowerWhite],
      [5, 1, TilesRPG.flowerRed],
      [13, 0, TilesRPG.bushSmall],
      [14, 6, TilesRPG.bushDarkGreen],
      [7, 6, TilesRPG.bushSmall],
      [15, 6, TilesRPG.flowerRed],
      [3, 7, TilesRPG.flowerWhite],
      [10, 7, TilesRPG.mushroomSmall],
      [13, 7, TilesRPG.flowerRed],
      [21, 0, TilesRPG.bushGreen],
      [21, 7, TilesRPG.bushOrange],
      [2, 9, TilesRPG.rockSmall],
      [3, 10, TilesRPG.flowerWhite],
      [6, 14, TilesRPG.mushroomTall],
      [14, 14, TilesRPG.bushOrange],
      [15, 13, TilesRPG.rockSmall],
      [16, 14, TilesRPG.flowerWhite],
      [17, 14, TilesRPG.mushroomSmall],
      [3, 13, TilesRPG.bushGreen],
      [5, 14, TilesRPG.flowerRed],
      [13, 12, TilesRPG.flowerWhite],
    ];
    for (const [x, y, frame] of ambient) decor.push({ x, y, frame });

    // Fence row in front of the Apothecary (row y=6) — short garden boundary.
    decor.push({ x: 2, y: 6, frame: TilesRPG.fenceH });
    decor.push({ x: 3, y: 6, frame: TilesRPG.fenceHMid });
    decor.push({ x: 5, y: 6, frame: TilesRPG.fenceHEnd });
    // Fence in front of Inn
    decor.push({ x: 16, y: 6, frame: TilesRPG.fenceH });
    decor.push({ x: 17, y: 6, frame: TilesRPG.fenceHMid });
    decor.push({ x: 19, y: 6, frame: TilesRPG.fenceHEnd });

    for (const d of decor) {
      if (!this.inTownBounds(d.x, d.y)) continue;
      this.add
        .image(d.x * TILE_SIZE + TILE_SIZE / 2, d.y * TILE_SIZE + TILE_SIZE / 2, ASSET_KEYS.sprites.rpg, d.frame)
        .setScale(RENDER_SCALE)
        .setDepth(5);
    }
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
    const k = (e.key ?? '').toLowerCase();
    const c = e.code ?? '';
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

    // Bind a single generic keydown listener for the editor — Phaser's
    // specific `keydown-Z` events don't always propagate `e.shiftKey`
    // reliably across input automation tools, which broke the Shift+Z
    // redo flow in QA. Branching on the raw event is more robust.
    const kb = this.input.keyboard;
    if (kb) kb.on('keydown', this.onEditKey, this);
  }

  private exitEditMode(): void {
    this.editing = false;
    this.painting = false;
    this.hoverHighlight?.destroy();
    this.hoverHighlight = undefined;
    this.editorUi?.destroy();
    this.editorUi = undefined;

    const kb = this.input.keyboard;
    if (kb) kb.off('keydown', this.onEditKey, this);
  }

  private onEditKey(e: KeyboardEvent): void {
    const key = (e.key ?? '').toLowerCase();
    const code = e.code ?? '';
    const isZ = key === 'z' || code === 'KeyZ';
    const isY = key === 'y' || code === 'KeyY';
    const isS = key === 's' || code === 'KeyS';
    const isE = key === 'e' || code === 'KeyE';

    if (isZ && !e.shiftKey) {
      e.preventDefault();
      this.applyUndo();
    } else if ((isZ && e.shiftKey) || isY) {
      e.preventDefault();
      this.applyRedo();
    } else if (isS) {
      e.preventDefault();
      saveMapToLocal(TOWN_MAP_KEY, this.mapData);
      this.updateEditStatus('saved to localStorage');
    } else if (isE) {
      e.preventDefault();
      downloadMapAsTiledJSON(this.mapData, 'town.json');
      this.updateEditStatus('exported town.json');
    }
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
        this.selectedLayer = entry.layer;
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
      `[${action}] depth ${this.editor.undoDepth()} ${undo}${redo}\nlayer: ${this.selectedLayer}\nF8 exit · Z undo · ⇧Z redo · S save · E export · RMB erase`,
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
    // Right-click erases the OVERLAY layer first if there's something there,
    // otherwise resets terrain. Painting writes to the layer that matches
    // the currently-selected palette entry.
    const layerName = frame === EMPTY_TILE ? this.eraseLayerAt(tx, ty) : this.selectedLayer;
    const layer: MapLayer = requireLayer(this.mapData, layerName);
    const before = layer.data[ty * layer.width + tx] ?? EMPTY_TILE;
    if (before === frame) return;
    if (this.currentStrokeCells.some((c) => c.x === tx && c.y === ty && c.layer === layerName)) return;
    this.currentStrokeCells.push({ x: tx, y: ty, before, after: frame, layer: layerName });
    setTile(layer, tx, ty, frame);
    this.rerenderTile(layerName, tx, ty);
  }

  /** Right-click decides which layer to clear: overlay wins if non-empty. */
  private eraseLayerAt(tx: number, ty: number): string {
    const overlay = requireLayer(this.mapData, OVERLAY_LAYER);
    if ((overlay.data[ty * overlay.width + tx] ?? EMPTY_TILE) !== EMPTY_TILE) return OVERLAY_LAYER;
    return TERRAIN_LAYER;
  }

  private commitStroke(): void {
    this.painting = false;
    if (this.currentStrokeCells.length === 0) return;
    // Group stroke cells by layer so we can emit one stroke action per layer
    // touched. Most strokes hit a single layer; this still handles the edge
    // case cleanly.
    const cellsByLayer = new Map<string, typeof this.currentStrokeCells>();
    for (const c of this.currentStrokeCells) {
      if (!cellsByLayer.has(c.layer)) cellsByLayer.set(c.layer, []);
      cellsByLayer.get(c.layer)!.push(c);
    }
    for (const [layerName, cells] of cellsByLayer) {
      const layer = requireLayer(this.mapData, layerName);
      // Roll back the eager local applies for this layer's cells.
      for (const c of cells) setTile(layer, c.x, c.y, c.before);
      if (cells.length === 1) {
        const c = cells[0]!;
        this.rerenderTile(layerName, c.x, c.y);
        this.editor.apply(buildPaintAction(this.mapData, layerName, c.x, c.y, c.after));
        this.rerenderTile(layerName, c.x, c.y);
      } else {
        this.editor.apply({
          kind: 'stroke',
          layer: layerName,
          cells: cells.map((c) => ({ x: c.x, y: c.y, before: c.before, after: c.after })),
        });
        for (const c of cells) this.rerenderTile(layerName, c.x, c.y);
      }
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

  private rerenderActionCells(action: {
    kind: 'paint' | 'stroke';
    layer: string;
    cells?: ReadonlyArray<{ x: number; y: number }>;
    x?: number;
    y?: number;
  }): void {
    if (action.kind === 'paint' && typeof action.x === 'number' && typeof action.y === 'number') {
      this.rerenderTile(action.layer, action.x, action.y);
    } else if (action.kind === 'stroke' && action.cells) {
      for (const c of action.cells) this.rerenderTile(action.layer, c.x, c.y);
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
