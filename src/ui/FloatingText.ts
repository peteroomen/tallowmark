import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from '@/config';
import type { FloatingTextSpec } from '@/core/Events';

/** HUD keepout zones (screen-space) — floating text never spawns inside these. */
const HUD_KEEPOUT_TOP = 64;
const HUD_KEEPOUT_BOTTOM = 96;
const HUD_KEEPOUT_LEFT = 0;
const HUD_KEEPOUT_RIGHT = 96;

/**
 * Spawn an ephemeral floating-text "bouncer" at a tile coordinate. The text
 * rises 36 pixels and fades out over 1 second, then destroys itself.
 *
 * Depth 70 — above the FogMask at 50 so the player never misses a damage
 * number behind shadows.
 *
 * **HUD keepout** (per refinement-002 §J / iter-2 stage 12 spec): if the
 * tile's screen-projected position would land inside a HUD keepout zone
 * (top 64 px under the stat plank, bottom 96 px under the log, right 96 px
 * under the icon column), skip the spawn entirely. The log line + status
 * icon still fire — the floating text is the duplicated channel, not the
 * primary feedback. Better silently clipped than rendered under chrome.
 */
export function spawnFloatingText(scene: Phaser.Scene, spec: FloatingTextSpec): void {
  const { tile, text, color, size = 'medium' } = spec;
  const wx = tile.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = tile.y * TILE_SIZE + TILE_SIZE / 2;

  // Screen-space projection through the camera. If the spawn point AND its
  // peak (36 px above) would both fall inside a HUD keepout, skip.
  const cam = scene.cameras.main;
  const sx = wx - cam.scrollX;
  const sy = wy - cam.scrollY;
  const peakY = sy - 36; // y where the float ends
  const insideHud = (x: number, y: number): boolean =>
    y < HUD_KEEPOUT_TOP ||
    y > GAME_HEIGHT - HUD_KEEPOUT_BOTTOM ||
    (y < HUD_KEEPOUT_TOP + 24 && x > GAME_WIDTH - HUD_KEEPOUT_RIGHT) ||
    x < HUD_KEEPOUT_LEFT;
  if (insideHud(sx, sy) && insideHud(sx, peakY)) {
    return;
  }

  const fontSize = size === 'large' ? '22px' : size === 'small' ? '11px' : '14px';
  const obj = scene.add
    .text(wx, wy, text, {
      fontFamily: 'monospace',
      fontSize,
      color,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: size === 'large' ? 'bold' : 'normal',
    })
    .setOrigin(0.5)
    .setDepth(70);

  scene.tweens.add({
    targets: obj,
    y: wy - 36,
    alpha: 0,
    duration: 950,
    ease: 'Quad.easeOut',
    onComplete: () => obj.destroy(),
  });
}
