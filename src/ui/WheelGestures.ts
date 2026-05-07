import Phaser from 'phaser';
import type { Target } from '@/actions/Targets';
import type { VerbId } from '@/actions/Verbs';
import { resolveVerbForKey, resolveVerbForNumericKey } from '@/actions/Resolver';
import type { ActionWheel } from './ActionWheel';

/**
 * Gesture manager wiring per refinement-002 §K — touch + mouse + keyboard
 * parity into a single Action Wheel.
 *
 * The wheel itself is dumb (asks the resolver, renders the answer). This
 * module is the input layer that opens / closes / dispatches it.
 *
 * Responsibilities:
 *   - Long-press detection on pointer (350 ms with jitter cancel) → open wheel
 *   - Right-click on mouse → open wheel
 *   - Keyboard `Space` → open self-target wheel
 *   - Keyboard `1`-`6` while wheel is open → fire slot N
 *   - Keyboard `Esc` while wheel is open → dismiss
 *   - Direct verb keys (`u`, `q`, `g`, etc.) → bypass wheel; fire verb on
 *     the *most reasonable* target without opening anything (per §K
 *     "wheel is for discovery; keys are for speed")
 *
 * The scene that uses this provides a `resolveTarget(worldX, worldY)`
 * function that maps a pointer coordinate to a Target — that's where
 * scene-specific knowledge lives (which tile, which enemy, etc.).
 *
 * Usage:
 *   const mgr = new WheelGestureManager({ scene, wheel, resolveTarget, ... });
 *   mgr.attach();
 *   // on scene shutdown:
 *   mgr.detach();
 */

export interface WheelGestureOptions {
  scene: Phaser.Scene;
  wheel: ActionWheel;
  /** Pointer-position → Target lookup. null if no targetable thing at that point. */
  resolveTarget: (worldX: number, worldY: number) => Target | null;
  /** What target the self-wheel should address (Space / Action button). */
  selfTarget: () => Target;
  /** Caller-side dispatch — called when a verb is picked or a direct key fires. */
  onPickVerb: (verb: VerbId, target: Target) => void;
  /** Tile size for world-tile anchor calculation. Defaults to 48 (3× 16). */
  tileSize?: number;
  /** Long-press duration in ms. Default 350 per §K. */
  longPressMs?: number;
  /**
   * Pixels of pointer drift that cancel a long-press in progress (treats
   * the input as a drag instead). Default 8.
   */
  longPressMaxJitter?: number;
  /**
   * Direct verb keys that bypass the wheel — pressing them fires the verb
   * against the most-reasonable target. Defaults to a sensible iter-3 set
   * (q = search, i = inventory, c = character, u = use, d = drop, g = pick up).
   */
  directKeys?: ReadonlyArray<string>;
}

export class WheelGestureManager {
  private readonly scene: Phaser.Scene;
  private readonly wheel: ActionWheel;
  private readonly opts: Required<
    Pick<
      WheelGestureOptions,
      'tileSize' | 'longPressMs' | 'longPressMaxJitter' | 'directKeys'
    >
  > &
    WheelGestureOptions;

  // Long-press state machine
  private pressTimer?: number;
  private pressDownPos = { x: 0, y: 0 };
  private pressing = false;
  /** Set on long-press fire so we can suppress the matching pointerup. */
  private suppressNextPointerUp = false;
  /** Target currently shown by the wheel, for keyboard 1-6 dispatch. */
  private currentTarget?: Target;

  // Listener handles for detach
  private readonly onPointerDownBound: (p: Phaser.Input.Pointer) => void;
  private readonly onPointerUpBound: (p: Phaser.Input.Pointer) => void;
  private readonly onPointerMoveBound: (p: Phaser.Input.Pointer) => void;
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(opts: WheelGestureOptions) {
    this.scene = opts.scene;
    this.wheel = opts.wheel;
    this.opts = {
      ...opts,
      tileSize: opts.tileSize ?? 48,
      longPressMs: opts.longPressMs ?? 350,
      longPressMaxJitter: opts.longPressMaxJitter ?? 8,
      directKeys: opts.directKeys ?? ['q', 'i', 'c', 'u', 'd', 'g'],
    };
    this.onPointerDownBound = (p) => this.onPointerDown(p);
    this.onPointerUpBound = (p) => this.onPointerUp(p);
    this.onPointerMoveBound = (p) => this.onPointerMove(p);
    this.onKeyDownBound = (e) => this.onKeyDown(e);

    // Wire the wheel's pick callback once.
    this.wheel.onPickVerb((verb) => {
      const target = this.currentTarget;
      this.currentTarget = undefined;
      if (target) this.opts.onPickVerb(verb, target);
    });
  }

  attach(): void {
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDownBound);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUpBound);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMoveBound);
    this.scene.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDownBound);
  }

  detach(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDownBound);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUpBound);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMoveBound);
    this.scene.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDownBound);
    this.cancelPress();
  }

  /** Should the scene's existing tap-to-step / click-to-path handler run for this pointer? */
  shouldPropagate(p: Phaser.Input.Pointer): boolean {
    // Right-click is wheel-only — block propagation.
    if (p.rightButtonReleased() || p.rightButtonDown()) return false;
    // If we just fired a long-press, the matching pointerup is wheel-only.
    if (this.suppressNextPointerUp) {
      this.suppressNextPointerUp = false;
      return false;
    }
    // Wheel was open AND just dispatched — don't re-fire scene click.
    if (this.wheel.isOpenNow()) return false;
    return true;
  }

  // --- Pointer state machine ---------------------------------------------

  private onPointerDown(p: Phaser.Input.Pointer): void {
    // Right-click → immediate wheel open at the pointed target.
    if (p.rightButtonDown()) {
      this.openAtPointer(p);
      return;
    }
    // Left button → start long-press timer.
    this.pressing = true;
    this.pressDownPos = { x: p.x, y: p.y };
    this.cancelPress();
    this.pressTimer = window.setTimeout(() => {
      if (!this.pressing) return;
      this.pressing = false;
      this.pressTimer = undefined;
      this.suppressNextPointerUp = true;
      this.openAtPointer(p);
    }, this.opts.longPressMs);
  }

  private onPointerUp(_p: Phaser.Input.Pointer): void {
    this.pressing = false;
    this.cancelPress();
    // Tap-out dismiss for an open wheel — the slot's own click handler
    // closes the wheel before this fires, so we only get here for taps
    // OUTSIDE any populated slot.
    if (this.wheel.isOpenNow()) {
      // Note: slot pointerup fires first via the zone's interactive handler.
      // If the wheel is still open here, the player tapped outside it.
      this.wheel.close();
      this.currentTarget = undefined;
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.pressing) return;
    const dx = p.x - this.pressDownPos.x;
    const dy = p.y - this.pressDownPos.y;
    if (Math.hypot(dx, dy) > this.opts.longPressMaxJitter) {
      // Drag — cancel the long-press.
      this.pressing = false;
      this.cancelPress();
    }
  }

  private cancelPress(): void {
    if (this.pressTimer !== undefined) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = undefined;
    }
  }

  // --- Wheel open / dispatch ---------------------------------------------

  private openAtPointer(p: Phaser.Input.Pointer): void {
    const target = this.opts.resolveTarget(p.worldX, p.worldY);
    if (!target) return;
    this.openForTarget(target, {
      kind: 'screen-position',
      x: p.x,
      y: p.y,
    });
  }

  /** Public — open the wheel for a specific target with a screen-position anchor. */
  openForTarget(
    target: Target,
    anchor: { kind: 'screen-position'; x: number; y: number },
  ): void {
    this.currentTarget = target;
    const opened = this.wheel.open(target, anchor);
    if (!opened) this.currentTarget = undefined;
  }

  /** Open the self-target wheel anchored bottom-right (Space / Action button). */
  openSelfWheel(): void {
    const target = this.opts.selfTarget();
    this.openForTarget(target, {
      kind: 'screen-position',
      x: this.scene.cameras.main.width - 120,
      y: this.scene.cameras.main.height - 140,
    });
  }

  // --- Keyboard ---------------------------------------------------------

  private onKeyDown(e: KeyboardEvent): void {
    const key = (e.key ?? '').toLowerCase();
    // Wheel-open: 1-6 fire the slot, Esc dismisses.
    if (this.wheel.isOpenNow()) {
      if (key === 'escape') {
        this.wheel.close();
        this.currentTarget = undefined;
        e.preventDefault();
        return;
      }
      const slotNum = parseInt(key, 10);
      if (Number.isFinite(slotNum) && slotNum >= 1 && slotNum <= 6 && this.currentTarget) {
        const verb = resolveVerbForNumericKey(this.currentTarget, slotNum);
        if (verb) {
          // The wheel.fireSlot path closes + dispatches via the bound callback.
          this.wheel.fireSlot(slotNum);
          e.preventDefault();
          return;
        }
      }
    }
    // Direct verb keys (wheel-bypass) — fire against the self-target.
    // Caller can wire scene-specific overrides (e.g. 'u' on dungeon means
    // "use top inventory item" — that logic lives at the call site).
    if (this.opts.directKeys.includes(key)) {
      const target = this.opts.selfTarget();
      const verb = resolveVerbForKey(target, key);
      if (verb) {
        this.opts.onPickVerb(verb, target);
        e.preventDefault();
      }
    }
    // Space → open self-wheel.
    if (key === ' ' && !this.wheel.isOpenNow()) {
      this.openSelfWheel();
      e.preventDefault();
    }
  }
}
