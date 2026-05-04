#!/usr/bin/env node
// Copies curated Kenney assets from the source packs into public/assets/.
// Generates silent placeholder audio files so the game can play without real sfx/music.
// Idempotent: safe to run repeatedly (overwrites destination files).

import { existsSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = join(ROOT, 'public', 'assets');

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function copy(src, dst) {
  if (!existsSync(src)) {
    console.warn(`[setup-assets] missing source: ${src}`);
    return false;
  }
  ensureDir(dirname(dst));
  copyFileSync(src, dst);
  return true;
}

const SPRITE_COPIES = [
  ['kenney_roguelike-rpg-pack/Spritesheet/roguelikeSheet_transparent.png', 'sprites/rpg.png'],
  ['kenney_roguelike-characters/Spritesheet/roguelikeChar_transparent.png', 'sprites/chars.png'],
  ['kenney_roguelike-indoors/Tilesheets/roguelikeIndoor_transparent.png', 'sprites/indoors.png'],
  ['kenney_ui-pack-pixel-adventure/Tilesheets/Large tiles/Thick outline/tilemap_packed.png', 'ui/ui_large.png'],
  ['kenney_ui-pack-pixel-adventure/Tilesheets/Small tiles/Thick outline/tilemap_packed.png', 'ui/ui_small.png'],
  ['kenney_input-prompts-pixel/Tilemap/tilemap_packed.png', 'ui/inputs.png'],
];

let copied = 0;
let skipped = 0;
for (const [from, to] of SPRITE_COPIES) {
  if (copy(join(ROOT, from), join(PUBLIC, to))) copied++;
  else skipped++;
}

// Short silent WAV stub: 22050 Hz mono 8-bit PCM, ~0.05s of value-128 samples
// (which is silence in unsigned 8-bit). Real decoders need actual data to
// initialise a sound, so a zero-length stub fails in Chromium.
function silentWavBytes() {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * 0.05);
  const dataLen = numSamples;
  const totalLen = 44 + dataLen;
  const buf = Buffer.alloc(totalLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(totalLen - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < numSamples; i++) buf.writeUInt8(128, 44 + i);
  return buf;
}

const AUDIO_STUBS = [
  'audio/music_menu.wav',
  'audio/music_town.wav',
  'audio/music_dungeon.wav',
  'audio/sfx_click.wav',
  'audio/sfx_step.wav',
  'audio/sfx_hit.wav',
  'audio/sfx_death.wav',
];

const wav = silentWavBytes();
let audio = 0;
for (const rel of AUDIO_STUBS) {
  const dst = join(PUBLIC, rel);
  // Don't overwrite if the user has supplied a real file (size > 2 KB suggests real audio).
  if (existsSync(dst) && statSync(dst).size > 2048) continue;
  ensureDir(dirname(dst));
  writeFileSync(dst, wav);
  audio++;
}

console.info(`[setup-assets] sprites copied: ${copied} (skipped: ${skipped}); audio stubs ensured: ${audio}`);
