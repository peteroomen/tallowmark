import Phaser from 'phaser';
import type { FrameStyle, GlyphId, StatusDef } from '@/state/StatusCatalog';

/**
 * Status icon widget — programmatic (no sprite frames) so the iter-4
 * status expansion (Burning / Frozen / Stunned / Charmed / Slow /
 * Strength / Weakness) is a one-line catalog change, not an art ask.
 *
 * Three visual fields per the design memo (refinement-002 §B):
 *   - **Glyph** drawn via Phaser Graphics at the icon centre
 *   - **Tint** (hex colour) applied to the glyph + frame + countdown
 *   - **Frame style** (solid / dashed / double) drawn around the icon
 *
 * Plus the **3-state countdown** (refinement-002 §B):
 *   - ≥ 4 turns: numeral steady, calm
 *   - 2-3 turns: numeral pulses subtly (alpha 1 → 0.7, 800 ms cycle)
 *   - 1 turn:    numeral red, frame flashes once per turn-tick
 */
export class StatusIcon extends Phaser.GameObjects.Container {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly glyph: Phaser.GameObjects.Graphics;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly size: number;
  private readonly def: StatusDef;
  private pulseTween?: Phaser.Tweens.Tween;
  private currentTurns = 0;

  constructor(scene: Phaser.Scene, def: StatusDef, size: number = 36) {
    super(scene, 0, 0);
    this.def = def;
    this.size = size;

    // Background / frame box. Drawn in `redraw()` so we can re-tint on flash.
    this.box = scene.add.graphics();
    this.glyph = scene.add.graphics();

    // Countdown chip — small numeral at bottom-right corner.
    this.countdown = scene.add
      .text(size / 2 - 2, size / 2 - 2, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#1a1a14',
        strokeThickness: 2,
      })
      .setOrigin(1, 1);

    this.add([this.box, this.glyph, this.countdown]);
    this.redraw();
    scene.add.existing(this);
  }

  /**
   * Update remaining-turn count and trigger 3-state countdown treatment.
   * Call this every refreshHud (matches the existing icon-row refresh cadence).
   */
  setTurnsRemaining(n: number): void {
    const prev = this.currentTurns;
    this.currentTurns = n;
    this.countdown.setText(`${n}`);

    // 1-turn-left flash — only when crossing into the danger band.
    const justEnteredDanger = prev !== 1 && n === 1;

    if (n <= 0) {
      this.countdown.setVisible(false);
      this.stopPulse();
      return;
    }
    this.countdown.setVisible(true);

    if (n === 1) {
      // Red numeral + single frame flash on entry.
      this.countdown.setColor('#d44a4a');
      this.stopPulse();
      if (justEnteredDanger) this.flashFrame();
    } else if (n <= 3) {
      // Subtle alpha pulse on the numeral.
      this.countdown.setColor('#ffffff');
      this.startPulse();
    } else {
      this.countdown.setColor('#ffffff');
      this.stopPulse();
    }
  }

  /** Force a one-pulse frame flash (used for status-apply moments too). */
  flashFrame(): void {
    const baseColor = parseInt(this.def.color.slice(1), 16);
    this.box.clear();
    this.drawFrame(this.box, this.size, this.def.frameStyle, 0xffffff);
    this.scene.tweens.add({
      targets: this.box,
      alpha: { from: 1, to: 1 },
      duration: 240,
      onComplete: () => {
        this.box.clear();
        this.drawFrame(this.box, this.size, this.def.frameStyle, baseColor);
      },
    });
  }

  private startPulse(): void {
    if (this.pulseTween) return;
    this.pulseTween = this.scene.tweens.add({
      targets: this.countdown,
      alpha: { from: 1, to: 0.7 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
      this.countdown.alpha = 1;
    }
  }

  /** Initial draw — frame border + glyph in the icon's tint. */
  private redraw(): void {
    const baseColor = parseInt(this.def.color.slice(1), 16);
    this.drawFrame(this.box, this.size, this.def.frameStyle, baseColor);
    this.drawGlyph(this.glyph, this.def.glyph, this.size, baseColor);
  }

  /** Draw the icon frame in solid / dashed / double style. */
  private drawFrame(g: Phaser.GameObjects.Graphics, size: number, style: FrameStyle, color: number): void {
    g.clear();
    // Background fill — dark slate so the glyph reads.
    g.fillStyle(0x1a1410, 0.92);
    g.fillRect(-size / 2, -size / 2, size, size);

    if (style === 'solid') {
      g.lineStyle(2, color, 1);
      g.strokeRect(-size / 2, -size / 2, size, size);
    } else if (style === 'dashed') {
      // Dashed: 4px dash + 3px gap, stroked manually around the rect.
      g.lineStyle(2, color, 1);
      this.strokeDashedRect(g, -size / 2, -size / 2, size, size, 4, 3);
    } else if (style === 'double') {
      // Double: outer + inner stroke at 2px gap.
      g.lineStyle(2, color, 1);
      g.strokeRect(-size / 2, -size / 2, size, size);
      g.strokeRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
    }
  }

  /** Manual dashed-stroke renderer for the dashed frame. */
  private strokeDashedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dash: number,
    gap: number,
  ): void {
    const stride = dash + gap;
    // Top edge (left → right)
    for (let i = 0; i < w; i += stride) {
      g.lineBetween(x + i, y, x + Math.min(i + dash, w), y);
    }
    // Right edge (top → bottom)
    for (let i = 0; i < h; i += stride) {
      g.lineBetween(x + w, y + i, x + w, y + Math.min(i + dash, h));
    }
    // Bottom edge (right → left)
    for (let i = 0; i < w; i += stride) {
      g.lineBetween(x + w - i, y + h, x + w - Math.min(i + dash, w), y + h);
    }
    // Left edge (bottom → top)
    for (let i = 0; i < h; i += stride) {
      g.lineBetween(x, y + h - i, x, y + h - Math.min(i + dash, h));
    }
  }

  /** Draw the centre glyph at the appropriate scale. Pure shape primitives. */
  private drawGlyph(g: Phaser.GameObjects.Graphics, glyph: GlyphId, size: number, color: number): void {
    g.clear();
    g.fillStyle(color, 1);
    g.lineStyle(2, color, 1);
    const r = size * 0.28; // glyph fits in ~56% of icon

    switch (glyph) {
      case 'cross': {
        // Plus sign — buff (heal/etc.)
        const arm = r * 0.4;
        g.fillRect(-arm, -r, arm * 2, r * 2); // vertical bar
        g.fillRect(-r, -arm, r * 2, arm * 2); // horizontal bar
        break;
      }
      case 'shield': {
        // Heater shield outline
        g.beginPath();
        g.moveTo(-r, -r * 0.8);
        g.lineTo(r, -r * 0.8);
        g.lineTo(r, r * 0.2);
        g.lineTo(0, r);
        g.lineTo(-r, r * 0.2);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'drop': {
        // Teardrop — DoT (poison/bleed)
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.7, r * 0.4);
        g.arc(0, r * 0.4, r * 0.7, 0, Math.PI, false);
        g.lineTo(0, -r);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'swirl': {
        // Spiral hint — control (confused/slow). Two arcs.
        g.lineStyle(2.5, color, 1);
        g.beginPath();
        g.arc(0, 0, r * 0.6, Math.PI * 0.2, Math.PI * 1.4, false);
        g.strokePath();
        g.beginPath();
        g.arc(0, 0, r * 0.3, Math.PI * 1.0, Math.PI * 2.2, false);
        g.strokePath();
        break;
      }
      case 'flame': {
        // Tear-drop with curved flicker on top
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.5, 0);
        g.arc(0, 0, r * 0.5, 0, Math.PI, false);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'snowflake': {
        // 6-spoke star
        g.lineStyle(2, color, 1);
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          g.lineBetween(0, 0, Math.cos(a) * r, Math.sin(a) * r);
        }
        break;
      }
      case 'star': {
        // 5-pointed star burst
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const rad = i % 2 === 0 ? r : r * 0.45;
          const x = Math.cos(a) * rad;
          const y = Math.sin(a) * rad;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.fillPath();
        break;
      }
      case 'heart': {
        g.beginPath();
        g.moveTo(0, r * 0.4);
        g.lineTo(-r, -r * 0.2);
        g.arc(-r * 0.5, -r * 0.4, r * 0.5, Math.PI, 0, false);
        g.arc(r * 0.5, -r * 0.4, r * 0.5, Math.PI, 0, false);
        g.lineTo(r, -r * 0.2);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'arrow_up': {
        // Triangle pointing up — buff (strength)
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.7, r * 0.5);
        g.lineTo(-r * 0.7, r * 0.5);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'arrow_down': {
        // Triangle pointing down — debuff (weakness)
        g.beginPath();
        g.moveTo(0, r);
        g.lineTo(r * 0.7, -r * 0.5);
        g.lineTo(-r * 0.7, -r * 0.5);
        g.closePath();
        g.fillPath();
        break;
      }
    }
  }
}
