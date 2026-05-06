#!/usr/bin/env node
// Cycle through all rpg-pack chunked views in DebugSheetScene and screenshot
// each one. With 3×3 chunking the rpg-pack renders at 4× scale per cell so
// every frame index is readable.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/tallowmark-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173/');
await page.locator('canvas').waitFor({ state: 'visible' });
await page.locator('canvas').focus();
await page.waitForTimeout(2_500);

await page.keyboard.press('F9');
await page.waitForTimeout(500);

// rpg-pack is the first 9 views (3x3). Capture each.
const labels = [
  'rpg-r0-c0', 'rpg-r0-c1', 'rpg-r0-c2',
  'rpg-r1-c0', 'rpg-r1-c1', 'rpg-r1-c2',
  'rpg-r2-c0', 'rpg-r2-c1', 'rpg-r2-c2',
];

for (let i = 0; i < labels.length; i++) {
  await page.screenshot({ path: `${OUT}/dbg-${labels[i]}.png` });
  console.info(`[shot] ${labels[i]}`);
  if (i < labels.length - 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
  }
}

await browser.close();
console.info('[shot] Done.');
