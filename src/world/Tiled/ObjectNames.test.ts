import { describe, expect, it } from 'vitest';
import { parseObjectName } from './ObjectNames';

describe('parseObjectName', () => {
  it('parses kind:id', () => {
    const r = parseObjectName('door:apothecary_main');
    expect(r.kind).toBe('door');
    expect(r.id).toBe('apothecary_main');
    expect(r.modifier).toBeUndefined();
  });

  it('parses kind:id:modifier', () => {
    const r = parseObjectName('door:secret_passage:feat_identify_100');
    expect(r.kind).toBe('door');
    expect(r.id).toBe('secret_passage');
    expect(r.modifier).toBe('feat_identify_100');
  });

  it('preserves the raw name for diagnostics', () => {
    const r = parseObjectName('npc:wandering_merchant:renown_3');
    expect(r.raw).toBe('npc:wandering_merchant:renown_3');
  });

  it.each([
    ['door:x', 'door'],
    ['npc:x', 'npc'],
    ['trigger:x', 'trigger'],
    ['spawn:x', 'spawn'],
    ['decoration:x', 'decoration'],
    ['sign:x', 'sign'],
  ])('recognises kind %s', (input, expected) => {
    expect(parseObjectName(input).kind).toBe(expected);
  });

  it('lowercases the kind for case-insensitive Tiled authoring', () => {
    expect(parseObjectName('Door:apothecary').kind).toBe('door');
    expect(parseObjectName('NPC:merchant').kind).toBe('npc');
  });

  it('returns unknown kind for unrecognised prefixes', () => {
    expect(parseObjectName('something:weird').kind).toBe('unknown');
    expect(parseObjectName('').kind).toBe('unknown');
    expect(parseObjectName('   ').kind).toBe('unknown');
  });

  it('handles missing id gracefully', () => {
    const r = parseObjectName('door');
    expect(r.kind).toBe('door');
    expect(r.id).toBe('');
  });

  it('strips surrounding whitespace', () => {
    const r = parseObjectName('  door:apothecary_main  ');
    expect(r.kind).toBe('door');
    expect(r.id).toBe('apothecary_main');
  });
});
