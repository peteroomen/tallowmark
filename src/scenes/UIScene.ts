import Phaser from 'phaser';
import { SCENE_KEYS } from '@/config';

/**
 * Reserved for an always-on HUD overlay running parallel to Town/Dungeon. v1
 * draws HUD directly inside DungeonScene; this scene exists so it can be
 * promoted to a full overlay in iteration 2 without restructuring.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.UI);
  }
  create(): void {
    // Intentionally empty in v1.
  }
}
