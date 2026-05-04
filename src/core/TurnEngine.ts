/**
 * The turn-based heartbeat. The world only ticks when the player acts.
 *
 * Lifecycle for a single round:
 *   1. Player submits an Action via `submitPlayerAction`.
 *   2. Engine resolves it (delegated to a callback).
 *   3. Engine fires the world tick: each subscribed `WorldTickHandler` runs in order.
 *   4. Engine returns to "awaiting player input" state.
 *
 * Tween animations may overlap rounds visually, but logically the engine is
 * always in exactly one state: AwaitingPlayer or Resolving. No new player
 * action is accepted while Resolving.
 */

export type PlayerActionResolver = () => void;
export type WorldTickHandler = () => void;

export const enum TurnState {
  AwaitingPlayer = 'AwaitingPlayer',
  Resolving = 'Resolving',
}

export class TurnEngine {
  private state: TurnState = TurnState.AwaitingPlayer;
  private readonly tickHandlers: WorldTickHandler[] = [];
  private turnNumber = 0;

  getState(): TurnState {
    return this.state;
  }

  getTurnNumber(): number {
    return this.turnNumber;
  }

  /** Subscribe a system to run during the world-tick step (e.g. enemy AI, hunger). */
  onWorldTick(handler: WorldTickHandler): () => void {
    this.tickHandlers.push(handler);
    return () => {
      const i = this.tickHandlers.indexOf(handler);
      if (i >= 0) this.tickHandlers.splice(i, 1);
    };
  }

  /**
   * Process a single player action. The resolver runs first, then all world-tick
   * handlers run in registration order. Throws if called while another round is
   * still resolving — callers should check `getState()` first.
   */
  submitPlayerAction(resolve: PlayerActionResolver): void {
    if (this.state !== TurnState.AwaitingPlayer) {
      throw new Error(`TurnEngine.submitPlayerAction: not awaiting player (state=${this.state})`);
    }
    this.state = TurnState.Resolving;
    try {
      resolve();
      for (const h of this.tickHandlers) h();
      this.turnNumber++;
    } finally {
      this.state = TurnState.AwaitingPlayer;
    }
  }
}
