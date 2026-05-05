import { test, expect, type Page } from '@playwright/test';

/**
 * Verifies that clicks anywhere within a button's *visible bounds* trigger
 * the click handler — not just one part of the button.
 *
 * Earlier versions of this spec only checked for absence of console errors,
 * which silently passed even when only the top-left quadrant of buttons was
 * clickable (Phaser Container hit-area quirk). This version asserts that
 * clicks at five positions across the button each cause a *scene transition*,
 * verified via the dev-only `window.__tallowmark.activeScenes()` hook.
 *
 * Hits the dev server (port 5173) directly so the dev hook is available;
 * skipped in CI for now (preview build strips dev hooks).
 */

const KNOWN_NOISE = [/Framebuffer status: Framebuffer Unsupported/i, /Unable to decode audio data/i];
function isNoise(msg: string): boolean {
  return KNOWN_NOISE.some((rx) => rx.test(msg));
}

const GAME_W = 1152;
const GAME_H = 768;

interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function spreadPoints(b: Box): Array<[number, number, string]> {
  const pad = 4;
  return [
    [b.cx, b.cy, 'centre'],
    [b.cx - b.w / 2 + pad, b.cy - b.h / 2 + pad, 'top-left'],
    [b.cx + b.w / 2 - pad, b.cy - b.h / 2 + pad, 'top-right'],
    [b.cx - b.w / 2 + pad, b.cy + b.h / 2 - pad, 'bottom-left'],
    [b.cx + b.w / 2 - pad, b.cy + b.h / 2 - pad, 'bottom-right'],
  ];
}

async function clickGame(page: Page, gx: number, gy: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const sx = box.x + (gx / GAME_W) * box.width;
  const sy = box.y + (gy / GAME_H) * box.height;
  await page.mouse.click(sx, sy);
}

async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as { __tallowmark?: { activeScenes?: () => string[] } }).__tallowmark?.activeScenes?.() ?? [],
  );
}

test.describe('button responsiveness', () => {
  test.skip(
    () => !!process.env.CI,
    'Requires the dev server (vite); preview build strips the dev hooks. Skipped in CI.',
  );

  test('Settings button: every corner triggers the Settings scene', async ({ page }) => {
    // MainMenu layout: blockTop = (768 - 308) / 2 = 230;
    // first button at blockTop + 120 = 350; dy = 48; Settings is the 3rd (y=446).
    // Buttons are 180×36 (KenneyButton defaults).
    const settingsBtn: Box = { cx: GAME_W / 2, cy: 446, w: 180, h: 36 };

    for (const [gx, gy, label] of spreadPoints(settingsBtn)) {
      const errors: string[] = [];
      page.on('pageerror', (e) => {
        if (!isNoise(e.message)) errors.push(e.message);
      });

      await page.goto('http://localhost:5173/');
      await page.locator('canvas').waitFor({ state: 'visible' });
      await page.waitForTimeout(1_500);

      // Confirm we're on MainMenu before the click.
      expect(await activeScenes(page), 'should start on MainMenu').toContain('MainMenu');

      await clickGame(page, gx, gy);
      await page.waitForTimeout(700);

      const scenes = await activeScenes(page);
      expect(scenes, `clicking ${label} of Settings button at (${gx},${gy}) should transition to Settings`).toContain(
        'Settings',
      );
      expect(errors, errors.join('\n')).toEqual([]);
    }
  });

  test('New Game button: every corner triggers Town scene', async ({ page }) => {
    const newGameBtn: Box = { cx: GAME_W / 2, cy: 350, w: 180, h: 36 };

    for (const [gx, gy, label] of spreadPoints(newGameBtn)) {
      const errors: string[] = [];
      page.on('pageerror', (e) => {
        if (!isNoise(e.message)) errors.push(e.message);
      });

      await page.goto('http://localhost:5173/');
      await page.locator('canvas').waitFor({ state: 'visible' });
      await page.waitForTimeout(1_500);

      expect(await activeScenes(page), 'should start on MainMenu').toContain('MainMenu');

      await clickGame(page, gx, gy);
      await page.waitForTimeout(1_500);

      const scenes = await activeScenes(page);
      expect(scenes, `clicking ${label} of New Game button at (${gx},${gy}) should transition to Town`).toContain(
        'Town',
      );
      expect(errors, errors.join('\n')).toEqual([]);
    }
  });
});
