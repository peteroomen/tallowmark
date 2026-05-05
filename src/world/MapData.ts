/**
 * Map data model — the persistent shape of a hand-authored scene like the
 * Town. Designed to be **Tiled-compatible** so we can swap to the Tiled
 * desktop editor in iteration 3 without changing the runtime loader.
 *
 * On disk we emit Tiled JSON v1.x:
 *   { width, height, tilewidth, tileheight, tilesets[], layers[] }
 *
 * In memory we use a slightly leaner shape — a flat row-major array of
 * **frame indices** per layer, with -1 meaning "empty." Tiled-compat
 * translation lives in `MapStore.ts`.
 */

export const EMPTY_TILE = -1;

export interface MapLayer {
  /** Layer name. We use 'terrain' for v1; later we'll add 'objects' etc. */
  name: string;
  width: number;
  height: number;
  /** Row-major flat array of frame indices, or EMPTY_TILE (-1) for blank cells. */
  data: number[];
}

export interface MapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  /** Identifies which spritesheet the frame indices in `layers[].data` reference. */
  tileset: 'rpg' | 'chars' | 'indoors';
  layers: MapLayer[];
}

/** Build an empty MapData with one named layer of the given dimensions. */
export function createEmptyMap(opts: {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tileset: MapData['tileset'];
  layerName?: string;
}): MapData {
  return {
    width: opts.width,
    height: opts.height,
    tileWidth: opts.tileWidth,
    tileHeight: opts.tileHeight,
    tileset: opts.tileset,
    layers: [
      {
        name: opts.layerName ?? 'terrain',
        width: opts.width,
        height: opts.height,
        data: new Array(opts.width * opts.height).fill(EMPTY_TILE),
      },
    ],
  };
}

/** Read a tile from a layer; throws on OOB. */
export function getTile(layer: MapLayer, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) {
    throw new RangeError(`getTile OOB at ${x},${y} on layer ${layer.name}`);
  }
  return layer.data[y * layer.width + x] as number;
}

/** Write a tile to a layer in place; throws on OOB. */
export function setTile(layer: MapLayer, x: number, y: number, value: number): void {
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) {
    throw new RangeError(`setTile OOB at ${x},${y} on layer ${layer.name}`);
  }
  layer.data[y * layer.width + x] = value;
}

/** Find a layer by name; throws if not present. */
export function requireLayer(map: MapData, name: string): MapLayer {
  const l = map.layers.find((layer) => layer.name === name);
  if (!l) throw new Error(`MapData has no layer "${name}"`);
  return l;
}
