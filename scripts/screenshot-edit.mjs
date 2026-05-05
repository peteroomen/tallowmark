#!/usr/bin/env node
// Drives the editor mode for a quick visual smoke shot.
// Boots: menu → New Game → Town → F8 (edit mode) → screenshot.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/tallowmark-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173/');
await page.locator('canvas').waitFor({ state: 'visible' });
await page.waitForTimeout(2_500);

const box = await page.locator('canvas').boundingBox();
if (!box) throw new Error('no canvas');
const click = (gx, gy) => {
  const sx = box.x + (gx / 1152) * box.width;
  const sy = box.y + (gy / 768) * box.height;
  return page.mouse.click(sx, sy);
};

// New Game
await click(576, 350);
await page.waitForTimeout(1_500);
await page.screenshot({ path: `${OUT}/edit-00-town-fresh.png` });

// Wipe any saved town to ensure default render.
await page.evaluate(() => localStorage.removeItem('tallowmark:map:town'));
await page.reload();
await page.waitForTimeout(2_000);

// Continue won't work since localStorage was wiped; press New Game again.
await click(576, 350);
await page.waitForTimeout(1_500);

// Open edit mode.
await page.keyboard.press('F8');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/edit-01-editor-open.png` });

// Click on the dirt palette entry (3rd row from top within palette).
// Palette is at right edge starting around (GAME_WIDTH - 152, 70).
// Row stride = 50, so dirt (3rd, index 2) is at y = 70 + 30 + 2*50 = 200, halfway.
// In game coords with sprite width 152, click at (1120, 220).
await click(1120, 220);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-02-dirt-selected.png` });

// Drag-paint a 5-tile horizontal stripe in the open grass field.
const startSx = box.x + (200 / 1152) * box.width;
const startSy = box.y + (530 / 768) * box.height;
const endSx = box.x + (380 / 1152) * box.width;
await page.mouse.move(startSx, startSy);
await page.mouse.down();
for (let f = 0; f <= 8; f++) {
  const sx = startSx + ((endSx - startSx) * f) / 8;
  await page.mouse.move(sx, startSy);
  await page.waitForTimeout(40);
}
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-03-after-stroke.png` });

// Undo with Z.
await page.keyboard.press('z');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-04-after-undo.png` });

// Redo with Shift+Z.
await page.keyboard.down('Shift');
await page.keyboard.press('z');
await page.keyboard.up('Shift');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-05-after-redo.png` });

// Save.
await page.keyboard.press('s');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-06-after-save.png` });

// Exit edit mode.
await page.keyboard.press('F8');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/edit-07-exit.png` });

await browser.close();
console.info(`[edit-shot] Done — see ${OUT}/edit-*.png`);
