#!/usr/bin/env node
// Boots playwright, walks through key scenes via keyboard (which is reliable),
// drops screenshots in /tmp/tallowmark-shots/.
//
// Usage: node scripts/screenshot.mjs (dev server must be on :5173)

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '/tmp/tallowmark-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto('http://localhost:5173/');
await page.waitForSelector('canvas', { timeout: 10_000 });
await page.locator('canvas').focus();
await page.waitForTimeout(2_500);

const canvasBox = await page.locator('canvas').boundingBox();
if (!canvasBox) throw new Error('no canvas bounding box');

// In game coords: width=1152, height=768. Canvas may be scaled.
function gameToScreen(gx, gy) {
  const sx = canvasBox.x + (gx / 1152) * canvasBox.width;
  const sy = canvasBox.y + (gy / 768) * canvasBox.height;
  return [sx, sy];
}

async function clickAt(gx, gy) {
  const [sx, sy] = gameToScreen(gx, gy);
  await page.mouse.click(sx, sy);
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.info(`[shot] ${name}`);
}

// 01 — main menu
await shot('01-mainmenu');

// 02 — settings (Settings button at game y ~= 768/2 + 30 = 414)
await clickAt(576, 414);
await page.waitForTimeout(800);
await shot('02-settings');

// Back to menu via ESC
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

// 03 — town: click New Game at game y ~= 768/2 - 40 = 344
await clickAt(576, 344);
await page.waitForTimeout(2_000);
await shot('03-town');

// 04 — confirm dialog: click on the dungeon arch (around tile 17,11 → game (17.5*48, 11.5*48) = (840, 552))
await clickAt(840, 552);
await page.waitForTimeout(800);
await shot('04-confirm-dialog');

// 05 — dungeon: click "Descend" (right button, primary, at game (~684, ~454))
await clickAt(684, 454);
await page.waitForTimeout(2_000);
await shot('05-dungeon');

// 06 — inventory
await page.keyboard.press('i');
await page.waitForTimeout(600);
await shot('06-inventory');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 07 — pause
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await shot('07-pause');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 08-10 — debug sheets via F9
await page.keyboard.press('F9');
await page.waitForTimeout(800);
await shot('08-debug-sheet-rpg');
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
await shot('09-debug-sheet-chars');
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
await shot('10-debug-sheet-ui-large');
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
await shot('11-debug-sheet-ui-small');
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
await shot('12-debug-sheet-inputs');

if (errors.length) {
  console.warn('[shot] errors observed:');
  for (const e of errors) console.warn('  -', e);
}
writeFileSync(`${OUT}/errors.txt`, errors.join('\n'));

await browser.close();
console.info(`[shot] Done.`);
