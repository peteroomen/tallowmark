import { applyAction, reverseAction, type EditorAction } from './EditorAction';
import type { MapData } from '@/world/MapData';

/**
 * Map editor with chained undo/redo.
 *
 * `apply(action)`   — mutates state, pushes onto undoStack, clears redoStack.
 * `undo()`          — reverses the top of undoStack, pushes onto redoStack.
 * `redo()`          — reapplies the top of redoStack, pushes onto undoStack.
 *
 * Pure data — no Phaser dependency. Fully unit-testable.
 */
export class MapEditor {
  private readonly undoStack: EditorAction[] = [];
  private readonly redoStack: EditorAction[] = [];

  constructor(private readonly map: MapData) {}

  getMap(): MapData {
    return this.map;
  }

  apply(action: EditorAction): void {
    applyAction(this.map, action);
    this.undoStack.push(action);
    // Branching invalidates redo history — that's the action-pattern convention.
    this.redoStack.length = 0;
  }

  undo(): EditorAction | null {
    const action = this.undoStack.pop();
    if (!action) return null;
    applyAction(this.map, reverseAction(action));
    this.redoStack.push(action);
    return action;
  }

  redo(): EditorAction | null {
    const action = this.redoStack.pop();
    if (!action) return null;
    applyAction(this.map, action);
    this.undoStack.push(action);
    return action;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of actions on the undo stack — useful for "unsaved changes" indicators. */
  undoDepth(): number {
    return this.undoStack.length;
  }
}
