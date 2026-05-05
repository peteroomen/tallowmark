import { getTile, setTile, requireLayer, type MapData } from '@/world/MapData';

/**
 * Editor actions — discriminated union of every map mutation.
 *
 * Each action stores the **before** state inline so undo is O(1) and doesn't
 * need to replay history from scratch. Drag-paint coalesces continuous
 * strokes into a single `stroke` action so undo-once undoes the whole stroke.
 */
export type EditorAction =
  | { kind: 'paint'; layer: string; x: number; y: number; before: number; after: number }
  | { kind: 'stroke'; layer: string; cells: ReadonlyArray<{ x: number; y: number; before: number; after: number }> };

/** Apply an action's `after` state to the map in place. */
export function applyAction(map: MapData, action: EditorAction): void {
  const layer = requireLayer(map, action.layer);
  switch (action.kind) {
    case 'paint':
      setTile(layer, action.x, action.y, action.after);
      return;
    case 'stroke':
      for (const c of action.cells) setTile(layer, c.x, c.y, c.after);
      return;
  }
}

/** Reverse an action — applying the reversed action restores `before`. */
export function reverseAction(action: EditorAction): EditorAction {
  switch (action.kind) {
    case 'paint':
      return {
        kind: 'paint',
        layer: action.layer,
        x: action.x,
        y: action.y,
        before: action.after,
        after: action.before,
      };
    case 'stroke':
      return {
        kind: 'stroke',
        layer: action.layer,
        cells: action.cells.map((c) => ({ x: c.x, y: c.y, before: c.after, after: c.before })),
      };
  }
}

/** Build a paint action by reading the current `before` state from the map. */
export function buildPaintAction(
  map: MapData,
  layerName: string,
  x: number,
  y: number,
  after: number,
): EditorAction {
  const layer = requireLayer(map, layerName);
  const before = getTile(layer, x, y);
  return { kind: 'paint', layer: layerName, x, y, before, after };
}
