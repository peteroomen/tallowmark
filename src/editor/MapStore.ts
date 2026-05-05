import { EMPTY_TILE, type MapData } from '@/world/MapData';

/**
 * Persistent map storage + Tiled-JSON interop.
 *
 * v2 in-game painter writes to localStorage so iteration is fast.
 * `exportTiledJSON(map)` produces a [Tiled JSON-format
 * map](https://doc.mapeditor.org/en/stable/reference/json-map-format/) that
 * we'll point Tiled at directly in iteration 3 — and that the runtime loader
 * can already read back via `parseTiledJSON()`.
 */

export const TOWN_MAP_KEY = 'tallowmark:map:town';

interface TiledTileset {
  firstgid: number;
  source?: string;
  /** Embedded tileset metadata — for our purposes, just the name we use in-game. */
  name?: string;
  tilewidth?: number;
  tileheight?: number;
}

interface TiledLayer {
  name: string;
  type: 'tilelayer';
  width: number;
  height: number;
  /** Row-major flat array of GIDs (0 = empty, ≥ firstgid → frame in tileset). */
  data: number[];
  visible?: boolean;
  opacity?: number;
}

interface TiledMap {
  type: 'map';
  version: '1.10';
  tiledversion: '1.11.0';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: 'orthogonal';
  renderorder: 'right-down';
  infinite: false;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

const FIRSTGID = 1;

/** Convert in-memory MapData → Tiled JSON-format map. */
export function exportTiledJSON(map: MapData): TiledMap {
  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: map.width,
    height: map.height,
    tilewidth: map.tileWidth,
    tileheight: map.tileHeight,
    tilesets: [
      {
        firstgid: FIRSTGID,
        name: map.tileset,
        tilewidth: map.tileWidth,
        tileheight: map.tileHeight,
      },
    ],
    layers: map.layers.map((l) => ({
      name: l.name,
      type: 'tilelayer',
      width: l.width,
      height: l.height,
      // Translate frame index N → GID (N + FIRSTGID); EMPTY_TILE → 0.
      data: l.data.map((v) => (v === EMPTY_TILE ? 0 : v + FIRSTGID)),
      visible: true,
      opacity: 1,
    })),
  };
}

/** Parse a Tiled JSON map back into MapData. Throws on schema mismatch. */
export function parseTiledJSON(raw: unknown): MapData {
  if (!raw || typeof raw !== 'object') throw new Error('parseTiledJSON: not an object');
  const m = raw as Partial<TiledMap>;
  if (m.type !== 'map') throw new Error('parseTiledJSON: not a Tiled map');
  if (!Array.isArray(m.tilesets) || m.tilesets.length === 0) throw new Error('parseTiledJSON: no tilesets');
  if (!Array.isArray(m.layers)) throw new Error('parseTiledJSON: no layers');
  if (typeof m.width !== 'number' || typeof m.height !== 'number') throw new Error('parseTiledJSON: missing dims');

  const ts = m.tilesets[0]!;
  const tileset = (ts.name ?? 'rpg') as MapData['tileset'];
  const firstgid = typeof ts.firstgid === 'number' ? ts.firstgid : FIRSTGID;

  return {
    width: m.width,
    height: m.height,
    tileWidth: m.tilewidth ?? 16,
    tileHeight: m.tileheight ?? 16,
    tileset,
    layers: m.layers
      .filter((l): l is TiledLayer => l.type === 'tilelayer')
      .map((l) => ({
        name: l.name,
        width: l.width,
        height: l.height,
        data: l.data.map((gid) => (gid === 0 ? EMPTY_TILE : gid - firstgid)),
      })),
  };
}

/** Serialize a MapData to localStorage. */
export function saveMapToLocal(key: string, map: MapData): void {
  localStorage.setItem(key, JSON.stringify(exportTiledJSON(map)));
}

/** Load a MapData from localStorage; returns null if missing or unparseable. */
export function loadMapFromLocal(key: string): MapData | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return parseTiledJSON(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Trigger a browser file download of the map as Tiled JSON. Used by the
 * editor's "Export" key.
 */
export function downloadMapAsTiledJSON(map: MapData, filename = 'town.json'): void {
  const json = JSON.stringify(exportTiledJSON(map), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
