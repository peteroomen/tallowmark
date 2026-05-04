#!/usr/bin/env node
// Like screenshot.mjs but stays in DebugSheetScene and pans the rpg sheet
// down to capture rows further from the top.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/tallowmark-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();

await page.goto('http://localhost:5173/');
await page.waitForSelector('canvas', { timeout: 10_000 });
await page.locator('canvas').focus();
await page.waitForTimeout(2_500);

// Open the debug scene and pan
await page.keyboard.press('F9');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/rpg_pan_0.png` });

// Pan right by holding ArrowRight for a bit, then down for a bit.
async function holdKey(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

// scroll right
await holdKey('ArrowRight', 800);
await page.screenshot({ path: `${OUT}/rpg_pan_right.png` });

// reset (no pan back is easy, just pan left equally)
await holdKey('ArrowLeft', 800);

// scroll down
await holdKey('ArrowDown', 800);
await page.screenshot({ path: `${OUT}/rpg_pan_down.png` });

// scroll further
await holdKey('ArrowDown', 800);
await page.screenshot({ path: `${OUT}/rpg_pan_down2.png` });

await browser.close();
console.info('done');
