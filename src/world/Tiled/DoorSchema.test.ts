import { describe, expect, it } from 'vitest';
import { readDoorObject, type TiledObject } from './DoorSchema';

const TILE_SIZE = 16;

const obj = (overrides: Partial<TiledObject> & { properties?: TiledObject['properties'] } = {}): TiledObject => ({
  name: 'door:apothecary_main',
  x: 11 * TILE_SIZE,
  y: 5 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
  properties: [
    { name: 'target_scene', type: 'string', value: 'ApothecaryInteriorScene' },
  ],
  ...overrides,
});

describe('readDoorObject', () => {
  it('parses a valid door with target scene', () => {
    const d = readDoorObject(obj(), TILE_SIZE, 'apothecary_main', undefined);
    expect(d).not.toBeNull();
    expect(d!.id).toBe('apothecary_main');
    expect(d!.tileX).toBe(11);
    expect(d!.tileY).toBe(5);
    expect(d!.targetScene).toBe('ApothecaryInteriorScene');
    expect(d!.lockCondition).toBeNull();
    expect(d!.lockedVisual).toBe('boarded'); // default
  });

  it('returns null when id is missing', () => {
    const d = readDoorObject(obj(), TILE_SIZE, '', undefined);
    expect(d).toBeNull();
  });

  it('returns null when target_scene is missing', () => {
    const d = readDoorObject(obj({ properties: [] }), TILE_SIZE, 'apothecary_main', undefined);
    expect(d).toBeNull();
  });

  it('preserves the lock condition from the parsed name modifier', () => {
    const d = readDoorObject(obj(), TILE_SIZE, 'secret', 'feat:identify_100');
    expect(d!.lockCondition).toBe('feat:identify_100');
  });

  it('reads founder_id property', () => {
    const d = readDoorObject(
      obj({
        properties: [
          { name: 'target_scene', type: 'string', value: 'ApothecaryInteriorScene' },
          { name: 'founder_id', type: 'string', value: 'Apothecary' },
        ],
      }),
      TILE_SIZE,
      'apothecary_main',
      undefined,
    );
    expect(d!.founderId).toBe('Apothecary');
  });

  it('validates locked_visual to a known value', () => {
    const make = (v: unknown) =>
      readDoorObject(
        obj({
          properties: [
            { name: 'target_scene', type: 'string', value: 'X' },
            { name: 'locked_visual', type: 'string', value: v },
          ],
        }),
        TILE_SIZE,
        'x',
        undefined,
      );
    expect(make('boarded')!.lockedVisual).toBe('boarded');
    expect(make('chained')!.lockedVisual).toBe('chained');
    expect(make('mist')!.lockedVisual).toBe('mist');
    expect(make('bricked')!.lockedVisual).toBe('bricked');
    expect(make('garbage')!.lockedVisual).toBe('boarded'); // fallback
    expect(make(null)!.lockedVisual).toBe('boarded');
  });
});
