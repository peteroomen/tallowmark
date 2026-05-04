import { test, expect } from '@playwright/test';

/**
 * Known noise from running Phaser inside playwright's headless-shell Chromium.
 * The WebGL renderer can't initialise a framebuffer there; Phaser's AUTO mode
 * falls back to Canvas and the game runs fine. We filter the messages so a
 * legitimate runtime error still fails the test.
 */
const KNOWN_NOISE = [/Framebuffer status: Framebuffer Unsupported/i];

function isNoise(msg: string): boolean {
  return KNOWN_NOISE.some((rx) => rx.test(msg));
}

test.describe('Tallowmark — boot smoke', () => {
  test('loads the game and renders the canvas', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!isNoise(e.message)) errors.push(e.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isNoise(msg.text())) errors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');

    const canvas = page.locator('[data-testid="game-root"] canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // Allow BootScene → MainMenuScene to settle.
    await page.waitForTimeout(2_500);

    expect(errors, errors.join('\n')).toEqual([]);

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('input events do not crash the game', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!isNoise(e.message)) errors.push(e.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2_500);

    // Press a few keys and click in the canvas; we just want to know nothing throws.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    const canvas = page.locator('[data-testid="game-root"] canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForTimeout(800);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
