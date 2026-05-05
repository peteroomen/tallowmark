import { test, expect } from '@playwright/test';

/**
 * Guards QA bug #2: after the player dies, the DeathSummary scene auto-fires
 * after a short delay — without requiring a keypress.
 *
 * Strategy: navigate into a fresh dungeon run, then call the dev-only
 * `window.__tallowmark.killPlayer()` hook (registered by DungeonScene in
 * `import.meta.env.DEV`) to trigger death deterministically. Then verify
 * the scene transitions to DeathSummary on its own — no keypresses needed.
 *
 * `playwright.config.ts` runs `vite build && vite preview` for E2E. The
 * production build strips the dev hook, so we instead point this single
 * test at the dev server (port 5173) directly.
 */

const KNOWN_NOISE = [/Framebuffer status: Framebuffer Unsupported/i, /Unable to decode audio data/i];
function isNoise(msg: string): boolean {
  return KNOWN_NOISE.some((rx) => rx.test(msg));
}

test.describe('death loop auto-transition', () => {
  test.skip(
    () => !!process.env.CI,
    'Requires the dev server (vite); preview build strips dev hooks. Skipped in CI for now.',
  );

  test('player death transitions to DeathSummary without a keypress', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!isNoise(e.message)) errors.push(e.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isNoise(msg.text())) errors.push(`console: ${msg.text()}`);
    });

    // Hit the dev server directly so the import.meta.env.DEV-gated kill hook
    // is registered.
    await page.goto('http://localhost:5173/');
    await page.locator('canvas').waitFor({ state: 'visible' });
    await page.waitForTimeout(2_000);

    // New Game (first button at game (576, 350)).
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('no canvas bounding box');
    const click = (gx: number, gy: number) => {
      const sx = box.x + (gx / 1152) * box.width;
      const sy = box.y + (gy / 768) * box.height;
      return page.mouse.click(sx, sy);
    };
    await click(576, 350);
    await page.waitForTimeout(1_500); // Town

    // Walk to dungeon arch and confirm Descend.
    await click(840, 552);
    await page.waitForTimeout(800); // confirm dialog
    await click(684, 454); // Descend (right primary button)
    await page.waitForTimeout(2_000); // Dungeon

    // Sanity: the dev hook is registered.
    const hookExists = await page.evaluate(
      () => typeof (window as { __tallowmark?: { killPlayer?: unknown } }).__tallowmark?.killPlayer === 'function',
    );
    expect(hookExists, 'dev hook __tallowmark.killPlayer should exist in dev build').toBe(true);

    const beforeShot = await page.locator('canvas').screenshot();

    // Trigger death directly. After the death-transition timer (600ms) the
    // dungeon scene should auto-stop and DeathSummary should mount.
    await page.evaluate(() => {
      (window as { __tallowmark?: { killPlayer?: () => void } }).__tallowmark?.killPlayer?.();
    });
    await page.waitForTimeout(1_500);

    const afterShot = await page.locator('canvas').screenshot();
    expect(beforeShot.equals(afterShot), 'expected scene to auto-transition after death').toBe(false);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
