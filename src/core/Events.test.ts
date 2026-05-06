import { describe, expect, it, vi } from 'vitest';
import { GameEventBus, type GameEvent } from './Events';

describe('GameEventBus', () => {
  it('starts with no listeners', () => {
    const bus = new GameEventBus();
    expect(bus.listenerCount()).toBe(0);
  });

  it('delivers an emitted event to all subscribers', () => {
    const bus = new GameEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(a);
    bus.on(b);
    const event: GameEvent = { kind: 'log', tone: 'neutral', message: 'hi' };
    bus.emit(event);
    expect(a).toHaveBeenCalledOnce();
    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledWith(event);
  });

  it('returns an unsubscribe function from on()', () => {
    const bus = new GameEventBus();
    const fn = vi.fn();
    const off = bus.on(fn);
    bus.emit({ kind: 'turnAdvanced', turn: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    bus.emit({ kind: 'turnAdvanced', turn: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('off() detaches a specific listener', () => {
    const bus = new GameEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(a);
    bus.on(b);
    bus.off(a);
    bus.emit({ kind: 'turnAdvanced', turn: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('clear() removes all listeners', () => {
    const bus = new GameEventBus();
    bus.on(vi.fn());
    bus.on(vi.fn());
    expect(bus.listenerCount()).toBe(2);
    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });

  it('a listener that unsubscribes during dispatch does not break the dispatch loop', () => {
    const bus = new GameEventBus();
    const offRef: { fn?: () => void } = {};
    const a = vi.fn(() => offRef.fn?.());
    const b = vi.fn();
    offRef.fn = bus.on(a);
    bus.on(b);
    bus.emit({ kind: 'turnAdvanced', turn: 1 });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    bus.emit({ kind: 'turnAdvanced', turn: 2 });
    expect(a).toHaveBeenCalledOnce(); // still 1; was unsubbed
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('discriminated union narrows correctly in a switch', () => {
    const bus = new GameEventBus();
    const seen: string[] = [];
    bus.on((e) => {
      switch (e.kind) {
        case 'log':
          seen.push(`log:${e.tone}:${e.message}`);
          break;
        case 'floatingText':
          seen.push(`float:${e.spec.text}`);
          break;
        case 'turnAdvanced':
          seen.push(`turn:${e.turn}`);
          break;
      }
    });
    bus.emit({ kind: 'log', tone: 'danger', message: 'Ouch' });
    bus.emit({ kind: 'floatingText', spec: { tile: { x: 0, y: 0 }, text: '-3', color: '#f00' } });
    bus.emit({ kind: 'turnAdvanced', turn: 7 });
    expect(seen).toEqual(['log:danger:Ouch', 'float:-3', 'turn:7']);
  });
});
