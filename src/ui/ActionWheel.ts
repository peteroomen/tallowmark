import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import {
  hasAnyVerb,
  resolveSlots,
  type WheelSlots,
} from '@/actions/Resolver';
import type { Target } from '@/actions/Targets';
import { VERBS, type VerbId } from '@/actions/Verbs';
import type { Point } from '@/core/Grid';

/**
 * The Action Wheel — Phaser radial menu per refinement-002 §K.
 *
 * Six fixed clock-face slots (12 / 2 / 4 / 6 / 8 / 10), always 6, even
 * if only some are populated. Empty slots dim to alpha 0.3. Spatial
 * memory matters more than space efficiency.
 *
 * The wheel is dumb — it asks `resolveSlots(target)` for what to
 * render, then displays it. All verb logic lives in `actions/Resolver.ts`.
 *
 * Architecture:
 *   - open(target, anchor)  : show wheel, animate in (120 ms easeOutBack)
 *   - close()               : animate out (80 ms easeInQuad), then destroy children
 *   - onPickVerb(callback)  : caller wires the dispatch
 *
 * The widget DOES NOT decide what each verb does — it just emits the
 * picked verb to the caller. The caller (DungeonScene / InventoryScene)
 * routes the verb to the right handler.
 *
 * Stage 4c wires the gesture layer; stage 4d hooks scenes up.
 */

const WHEEL_RADIUS = 88;
const SLOT_RADIUS = 28;
const CENTER_DEAD_ZONE = 32;

/** Clock-face positions for the 6 slots, relative to the wheel centre. */
const SLOT_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: -WHEEL_RADIUS }, // 12 o'clock
  { x: WHEEL_RADIUS * 0.866, y: -WHEEL_RADIUS * 0.5 }, // 2 o'clock
  { x: WHEEL_RADIUS * 0.866, y: WHEEL_RADIUS * 0.5 }, // 4 o'clock
  { x: 0, y: WHEEL_RADIUS }, // 6 o'clock
  { x: -WHEEL_RADIUS * 0.866, y: WHEEL_RADIUS * 0.5 }, // 8 o'clock
  { x: -WHEEL_RADIUS * 0.866, y: -WHEEL_RADIUS * 0.5 }, // 10 o'clock
];

/** Margin from screen edge when the wheel anchor would clip off-screen. */
const SCREEN_MARGIN = 16;

const COLOR_BG = 0x1a1410;
const COLOR_FRAME = 0xd4a24c;
const COLOR_SLOT_BG = 0x4a3e30;
const COLOR_SLOT_LABEL = '#e5e3d8';

export type VerbPickCallback = (verb: VerbId) => void;

/** Anchor strategy — where the wheel positions relative to. */
export type WheelAnchor =
  | { kind: 'screen-position'; x: number; y: number }
  | { kind: 'world-tile'; pos: Point; tileSize: number };

export class ActionWheel extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly slotContainers: Phaser.GameObjects.Container[] = [];
  private currentTarget?: Target;
  private currentSlots: WheelSlots = [null, null, null, null, null, null];
  private isOpen = false;
  private pickCallback?: VerbPickCallback;
  /** Optional leader line from wheel centre to the target sprite. */
  private leaderLine?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    this.setScrollFactor(0).setDepth(1100); // above HUD (1000)
    this.setVisible(false);
    this.setAlpha(0);
    scene.add.existing(this);
  }

  /** Caller wires this once at construction. */
  onPickVerb(cb: VerbPickCallback): void {
    this.pickCallback = cb;
  }

  /**
   * Open the wheel for a target with the given anchor. If the resolver
   * returns no verbs (e.g. wall), this is a no-op — caller should handle
   * the empty-state indicator separately (per §K).
   */
  open(target: Target, anchor: WheelAnchor): boolean {
    if (this.isOpen) this.closeImmediate();
    const slots = resolveSlots(target);
    if (!hasAnyVerb(slots)) return false;
    this.currentTarget = target;
    this.currentSlots = slots;
    this.layoutAt(anchor);
    this.drawWheel();
    this.populateSlots();
    this.isOpen = true;
    this.setVisible(true);
    this.scene.tweens.add({
      targets: this,
      scale: { from: 0.8, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 120,
      ease: 'Back.easeOut',
    });
    return true;
  }

  /** Animated dismissal — 80 ms scale 1 → 0.9 + alpha 1 → 0. */
  close(): void {
    if (!this.isOpen) return;
    this.scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 0.9 },
      alpha: { from: 1, to: 0 },
      duration: 80,
      ease: 'Quad.easeIn',
      onComplete: () => this.closeImmediate(),
    });
  }

  /** Tear-down without animation. Used on scene shutdown. */
  closeImmediate(): void {
    this.isOpen = false;
    this.currentTarget = undefined;
    this.currentSlots = [null, null, null, null, null, null];
    for (const c of this.slotContainers) c.destroy();
    this.slotContainers.length = 0;
    this.graphics.clear();
    this.leaderLine?.destroy();
    this.leaderLine = undefined;
    this.setVisible(false);
    this.setScale(1);
    this.setAlpha(0);
  }

  isOpenNow(): boolean {
    return this.isOpen;
  }

  /** Caller asks "is this verb id currently a valid slot?" — keyboard dispatch hook. */
  hasSlot(verb: VerbId): boolean {
    return this.currentSlots.includes(verb);
  }

  /** Fire the verb at slot N (1-based; matches the design's 1-6 keyboard mapping). */
  fireSlot(slotNumber: number): void {
    if (!this.isOpen) return;
    if (slotNumber < 1 || slotNumber > 6) return;
    const verb = this.currentSlots[slotNumber - 1];
    if (!verb) return;
    this.dispatch(verb);
  }

  // --- Internal layout / rendering ---------------------------------------

  /** Position the wheel relative to its anchor, clamping to screen. */
  private layoutAt(anchor: WheelAnchor): void {
    let cx: number;
    let cy: number;
    let leaderTo: { x: number; y: number } | null = null;
    if (anchor.kind === 'screen-position') {
      cx = anchor.x;
      cy = anchor.y;
    } else {
      // world-tile: anchor 12 px above the target tile centre, projected to screen.
      const cam = this.scene.cameras.main;
      const worldX = anchor.pos.x * anchor.tileSize + anchor.tileSize / 2;
      const worldY = anchor.pos.y * anchor.tileSize + anchor.tileSize / 2;
      cx = worldX - cam.scrollX;
      cy = worldY - cam.scrollY - 12;
      leaderTo = { x: worldX - cam.scrollX, y: worldY - cam.scrollY };
    }
    // Clamp to viewport with margin so the wheel never clips off-screen.
    const minX = WHEEL_RADIUS + SLOT_RADIUS + SCREEN_MARGIN;
    const maxX = GAME_WIDTH - WHEEL_RADIUS - SLOT_RADIUS - SCREEN_MARGIN;
    const minY = WHEEL_RADIUS + SLOT_RADIUS + SCREEN_MARGIN;
    const maxY = GAME_HEIGHT - WHEEL_RADIUS - SLOT_RADIUS - SCREEN_MARGIN;
    const clampedX = Math.max(minX, Math.min(maxX, cx));
    const clampedY = Math.max(minY, Math.min(maxY, cy));
    this.setPosition(clampedX, clampedY);
    // If we clamped + we have a target leader, draw a 2 px line back to it.
    // Per §K: don't rotate the radial; slot order stays canonical.
    if (leaderTo && (clampedX !== cx || clampedY !== cy)) {
      this.drawLeader(leaderTo);
    }
  }

  /** 2-px line from the wheel centre back to the (clipped) target sprite. */
  private drawLeader(to: { x: number; y: number }): void {
    if (!this.leaderLine) {
      this.leaderLine = this.scene.add.graphics();
      this.leaderLine.setScrollFactor(0).setDepth(1099); // just below the wheel
    }
    this.leaderLine.clear();
    this.leaderLine.lineStyle(2, COLOR_FRAME, 0.7);
    this.leaderLine.lineBetween(this.x, this.y, to.x, to.y);
  }

  /** Background ring + centre dead-zone marker. */
  private drawWheel(): void {
    const g = this.graphics;
    g.clear();
    // Outer dim ring for visual cohesion
    g.fillStyle(COLOR_BG, 0.92);
    g.fillCircle(0, 0, WHEEL_RADIUS + SLOT_RADIUS);
    g.lineStyle(1, COLOR_FRAME, 0.5);
    g.strokeCircle(0, 0, WHEEL_RADIUS + SLOT_RADIUS);
    // Centre dead zone — a dashed dark circle where "target" would sit.
    g.fillStyle(COLOR_BG, 0.85);
    g.fillCircle(0, 0, CENTER_DEAD_ZONE / 2);
    g.lineStyle(1, COLOR_FRAME, 0.4);
    g.strokeCircle(0, 0, CENTER_DEAD_ZONE / 2);
  }

  /** Build the 6 slot containers, one per clock-face position. */
  private populateSlots(): void {
    for (let i = 0; i < 6; i++) {
      const offset = SLOT_OFFSETS[i]!;
      const verb = this.currentSlots[i];
      const slot = this.scene.add.container(offset.x, offset.y);
      const bg = this.scene.add.graphics();
      const isPopulated = verb !== null;
      const color = isPopulated ? COLOR_SLOT_BG : 0x2a2218;
      bg.fillStyle(color, isPopulated ? 0.85 : 0.4);
      bg.fillCircle(0, 0, SLOT_RADIUS);
      bg.lineStyle(2, COLOR_FRAME, isPopulated ? 0.85 : 0.3);
      bg.strokeCircle(0, 0, SLOT_RADIUS);
      slot.add(bg);
      if (isPopulated && verb) {
        const label = this.scene.add
          .text(0, 4, VERBS[verb].label.toUpperCase(), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: COLOR_SLOT_LABEL,
            stroke: '#1a1a14',
            strokeThickness: 2,
          })
          .setOrigin(0.5, 0.5);
        const keyHint = VERBS[verb].defaultKey
          ? this.scene.add
              .text(0, -10, VERBS[verb].defaultKey!.toUpperCase(), {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#fbe6c4',
                fontStyle: 'bold',
              })
              .setOrigin(0.5, 0.5)
          : this.scene.add
              .text(0, -10, `${i + 1}`, {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#fbe6c4',
              })
              .setOrigin(0.5, 0.5);
        slot.add([label, keyHint]);
        // Hit zone (slightly larger than the slot circle for finger-friendly tap).
        const zone = this.scene.add
          .zone(0, 0, SLOT_RADIUS * 2 + 6, SLOT_RADIUS * 2 + 6)
          .setOrigin(0.5);
        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => bg.setAlpha(0.65));
        zone.on('pointerout', () => bg.setAlpha(1));
        zone.on('pointerup', () => this.dispatch(verb));
        slot.add(zone);
      } else {
        // Empty slot — show the slot number faintly so spatial memory still reads.
        const dim = this.scene.add
          .text(0, 0, `${i + 1}`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#76685a',
          })
          .setOrigin(0.5, 0.5)
          .setAlpha(0.5);
        slot.add(dim);
      }
      this.add(slot);
      this.slotContainers.push(slot);
    }
  }

  private dispatch(verb: VerbId): void {
    const cb = this.pickCallback;
    this.close();
    cb?.(verb);
  }
}
