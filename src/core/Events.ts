import type { Point } from './Grid';

/**
 * Game event bus — the spinal cord between game logic and UI feedback.
 *
 * Pure data, no Phaser deps. Combat / item / status code emits typed events;
 * UI subscribers (log lines, floating text, sound effects, etc.) translate
 * each event into the appropriate user-facing feedback. This decouples *what
 * happened* from *how it's surfaced*, and makes the data layer fully unit-
 * testable in isolation.
 *
 * The discriminated union below is the contract — extend it as new stages
 * land (item pickup, status applied, trap triggered, etc.) and existing
 * subscribers ignore unknown kinds gracefully.
 */

export type LogTone =
  /** White — generic action / movement / narrative. */
  | 'neutral'
  /** Yellow — discovery, item find, trap spot. */
  | 'discovery'
  /** Red — damage taken, hostile combat, starvation. */
  | 'danger'
  /** Green — healing, kill, ember reward, level descent. */
  | 'recovery'
  /** Cyan — story / exposition / NPC dialogue. */
  | 'story';

/**
 * Floating text "bouncer" — ephemeral text rendered at a tile coordinate
 * that fades out.
 *
 * Per refinement-002 §J, duration is event-aware:
 *   - damage:   600 ms (fast — combat is rapid)
 *   - heal:     800 ms (slow = lingering goodness)
 *   - generic:  600 ms (default; matches damage feel)
 */
export interface FloatingTextSpec {
  tile: Point;
  text: string;
  /** Hex string ('#d44a4a') for Phaser Text colour. */
  color: string;
  /** Default 'medium' (14px). 'large' (22px bold) for emphasis. */
  size?: 'small' | 'medium' | 'large';
  /** Override default 600 ms duration. Healing intents pass 800 ms. */
  durationMs?: number;
}

export type GameEvent =
  /** Append a tone-coloured line to the message log. */
  | { kind: 'log'; tone: LogTone; message: string }
  /** Spawn an ephemeral floating-text bouncer at a tile. */
  | { kind: 'floatingText'; spec: FloatingTextSpec }
  /** A turn just resolved (player action + world tick). */
  | { kind: 'turnAdvanced'; turn: number };

export type GameEventListener = (event: GameEvent) => void;

/**
 * Tiny event bus — one typed `emit` and `on` plus an unsubscribe handle.
 * No event-name strings; the discriminated union does the dispatch.
 */
export class GameEventBus {
  private listeners: GameEventListener[] = [];

  emit(event: GameEvent): void {
    // Iterate over a snapshot so listeners can safely unsubscribe during dispatch.
    for (const listener of this.listeners.slice()) {
      listener(event);
    }
  }

  on(listener: GameEventListener): () => void {
    this.listeners.push(listener);
    return () => this.off(listener);
  }

  off(listener: GameEventListener): void {
    const i = this.listeners.indexOf(listener);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  /** Remove all listeners — useful when a scene shuts down. */
  clear(): void {
    this.listeners.length = 0;
  }

  /** Number of currently-registered listeners (for tests). */
  listenerCount(): number {
    return this.listeners.length;
  }
}
