import { describe, expect, it } from 'vitest';
import { exportTiledJSON, parseTiledJSON } from './MapStore';
import { createEmptyMap, EMPTY_TILE, type MapData, setTile, requireLayer } from '@/world/MapData';

function sample(): MapData {
  const map = createEmptyMap({ width: 3, height: 2, tileWidth: 16, tileHeight: 16, tileset: 'rpg' });
  const layer = requireLayer(map, 'terrain');
  setTile(layer, 0, 0, 5);
  setTile(layer, 1, 0, 6);
  setTile(layer, 2, 1, 7);
  return map;
}

describe('Tiled JSON round-trip', () => {
  it('export then import returns equivalent MapData', () => {
    const map = sample();
    const tiled = exportTiledJSON(map);
    const back = parseTiledJSON(tiled);
    expect(back.width).toBe(map.width);
    expect(back.height).toBe(map.height);
    expect(back.tileWidth).toBe(map.tileWidth);
    expect(back.tileset).toBe(map.tileset);
    expect(back.layers[0]?.data).toEqual(map.layers[0]?.data);
  });

  it('represents EMPTY_TILE as Tiled GID 0 on disk', () => {
    const map = createEmptyMap({ width: 2, height: 1, tileWidth: 16, tileHeight: 16, tileset: 'rpg' });
    const tiled = exportTiledJSON(map);
    expect(tiled.layers[0]?.data).toEqual([0, 0]);
  });

  it('translates frame index N to GID N+1 on export', () => {
    const map = createEmptyMap({ width: 2, height: 1, tileWidth: 16, tileHeight: 16, tileset: 'rpg' });
    setTile(requireLayer(map, 'terrain'), 0, 0, 0);
    setTile(requireLayer(map, 'terrain'), 1, 0, 99);
    const tiled = exportTiledJSON(map);
    expect(tiled.layers[0]?.data).toEqual([1, 100]);
  });

  it('parseTiledJSON throws on a non-map object', () => {
    expect(() => parseTiledJSON({ type: 'something-else' })).toThrow();
    expect(() => parseTiledJSON(null)).toThrow();
  });

  it('parseTiledJSON tolerates absent firstgid (defaults to 1)', () => {
    const map = parseTiledJSON({
      type: 'map',
      width: 1,
      height: 1,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [{ name: 'rpg' }],
      layers: [{ name: 'terrain', type: 'tilelayer', width: 1, height: 1, data: [5] }],
    });
    // GID 5 with default firstgid 1 → frame 4
    expect(map.layers[0]?.data).toEqual([4]);
  });

  it('round-trip preserves a stroke of mixed empty + painted cells', () => {
    const map = sample();
    setTile(requireLayer(map, 'terrain'), 1, 1, EMPTY_TILE); // explicit empty among painted
    const round = parseTiledJSON(exportTiledJSON(map));
    expect(round.layers[0]?.data).toEqual(map.layers[0]?.data);
  });
});
