import { describe, expect, it } from 'vitest';
import { TurnEngine, TurnState } from './TurnEngine';

describe('TurnEngine', () => {
  it('starts in AwaitingPlayer state at turn 0', () => {
    const e = new TurnEngine();
    expect(e.getState()).toBe(TurnState.AwaitingPlayer);
    expect(e.getTurnNumber()).toBe(0);
  });

  it('runs tick handlers after the player resolver and increments turn count', () => {
    const e = new TurnEngine();
    const calls: string[] = [];
    e.onWorldTick(() => calls.push('tick1'));
    e.onWorldTick(() => calls.push('tick2'));

    e.submitPlayerAction(() => calls.push('player'));

    expect(calls).toEqual(['player', 'tick1', 'tick2']);
    expect(e.getTurnNumber()).toBe(1);
  });

  it('returns to AwaitingPlayer after a round', () => {
    const e = new TurnEngine();
    e.submitPlayerAction(() => {});
    expect(e.getState()).toBe(TurnState.AwaitingPlayer);
  });

  it('unsubscribes a tick handler', () => {
    const e = new TurnEngine();
    const calls: string[] = [];
    const off = e.onWorldTick(() => calls.push('a'));
    e.onWorldTick(() => calls.push('b'));
    off();
    e.submitPlayerAction(() => {});
    expect(calls).toEqual(['b']);
  });

  it('still returns to AwaitingPlayer if the resolver throws', () => {
    const e = new TurnEngine();
    expect(() =>
      e.submitPlayerAction(() => {
        throw new Error('oops');
      }),
    ).toThrow('oops');
    expect(e.getState()).toBe(TurnState.AwaitingPlayer);
  });
});
