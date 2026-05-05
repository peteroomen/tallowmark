import { describe, expect, it } from 'vitest';
import { MapEditor } from './MapEditor';
import { buildPaintAction, type EditorAction } from './EditorAction';
import { createEmptyMap, getTile, requireLayer, EMPTY_TILE } from '@/world/MapData';

const makeMap = () =>
  createEmptyMap({ width: 4, height: 3, tileWidth: 16, tileHeight: 16, tileset: 'rpg' });

describe('MapEditor', () => {
  it('starts with empty undo + redo stacks', () => {
    const editor = new MapEditor(makeMap());
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);
    expect(editor.undoDepth()).toBe(0);
  });

  it('apply mutates the map and pushes to undoStack', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    editor.apply(buildPaintAction(map, 'terrain', 1, 1, 42));
    expect(getTile(requireLayer(map, 'terrain'), 1, 1)).toBe(42);
    expect(editor.canUndo()).toBe(true);
    expect(editor.canRedo()).toBe(false);
  });

  it('undo restores the previous tile value', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    editor.apply(buildPaintAction(map, 'terrain', 2, 0, 7));
    editor.undo();
    expect(getTile(requireLayer(map, 'terrain'), 2, 0)).toBe(EMPTY_TILE);
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(true);
  });

  it('redo reapplies an undone action', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    editor.apply(buildPaintAction(map, 'terrain', 2, 0, 7));
    editor.undo();
    editor.redo();
    expect(getTile(requireLayer(map, 'terrain'), 2, 0)).toBe(7);
    expect(editor.canRedo()).toBe(false);
  });

  it('a new action after undo clears the redo stack', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    editor.apply(buildPaintAction(map, 'terrain', 0, 0, 1));
    editor.undo();
    expect(editor.canRedo()).toBe(true);
    editor.apply(buildPaintAction(map, 'terrain', 1, 0, 2));
    expect(editor.canRedo()).toBe(false);
  });

  it('undo returns null on empty stack', () => {
    const editor = new MapEditor(makeMap());
    expect(editor.undo()).toBeNull();
  });

  it('redo returns null on empty stack', () => {
    const editor = new MapEditor(makeMap());
    expect(editor.redo()).toBeNull();
  });

  it('chains many paints and undoes them in reverse order', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    for (let i = 0; i < 5; i++) {
      editor.apply(buildPaintAction(map, 'terrain', i % 4, 0, 100 + i));
    }
    expect(editor.undoDepth()).toBe(5);
    while (editor.canUndo()) editor.undo();
    const layer = requireLayer(map, 'terrain');
    for (let i = 0; i < 4; i++) expect(getTile(layer, i, 0)).toBe(EMPTY_TILE);
  });

  it('handles a stroke action with multiple cells in one undo', () => {
    const map = makeMap();
    const editor = new MapEditor(map);
    const stroke: EditorAction = {
      kind: 'stroke',
      layer: 'terrain',
      cells: [
        { x: 0, y: 0, before: EMPTY_TILE, after: 5 },
        { x: 1, y: 0, before: EMPTY_TILE, after: 5 },
        { x: 2, y: 0, before: EMPTY_TILE, after: 5 },
      ],
    };
    editor.apply(stroke);
    const layer = requireLayer(map, 'terrain');
    expect(getTile(layer, 0, 0)).toBe(5);
    expect(getTile(layer, 1, 0)).toBe(5);
    expect(getTile(layer, 2, 0)).toBe(5);
    editor.undo();
    expect(getTile(layer, 0, 0)).toBe(EMPTY_TILE);
    expect(getTile(layer, 1, 0)).toBe(EMPTY_TILE);
    expect(getTile(layer, 2, 0)).toBe(EMPTY_TILE);
  });
});
