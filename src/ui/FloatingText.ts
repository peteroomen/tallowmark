import type Phaser from 'phaser';
import { TILE_SIZE } from '@/config';
import type { FloatingTextSpec } from '@/core/Events';

/**
 * Spawn an ephemeral floating-text "bouncer" at a tile coordinate. The text
 * rises 36 pixels and fades out over 1 second, then destroys itself.
 *
 * Depth 70 — above the FogMask at 50 so the player never misses a damage
 * number behind shadows.
 */
export function spawnFloatingText(scene: Phaser.Scene, spec: FloatingTextSpec): void {
  const { tile, text, color, size = 'medium' } = spec;
  const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
  const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

  const fontSize = size === 'large' ? '22px' : size === 'small' ? '11px' : '14px';
  const obj = scene.add
    .text(x, y, text, {
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
    y: y - 36,
    alpha: 0,
    duration: 950,
    ease: 'Quad.easeOut',
    onComplete: () => obj.destroy(),
  });
}
