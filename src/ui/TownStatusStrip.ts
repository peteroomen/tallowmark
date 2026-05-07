import Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { toRoman } from './numerals';

/**
 * Town Status strip — single-line HUD element along the top of TownScene.
 *
 * Per refinement-002 §M, this is the "at-a-glance reminder" layer of the
 * Renown surfacing system (the Town Board is the canonical check; the
 * diegetic NPC/sky/ambient changes are the felt layer).
 *
 * Iter-3 stage 2b ships:
 *   `TALLOWMARK · DAY 14 · 47 EMBERS`
 *
 * Iter-7 will add the Roman-numeral Renown tier between DAY and SHOPS:
 *   `TALLOWMARK · DAY 14 · IV · 2 SHOPS OPEN · 47 EMBERS · NEW: ...`
 *
 * The Roman numeral is *invisible to a new player* (looks like a date
 * thing) and *instantly readable to a returning one*. One character of
 * HUD, two reads.
 */

export interface TownStatusStripData {
  day: number;
  /** Renown tier 0–10. 0 hides the numeral entirely. Iter-7 wires this. */
  renown?: number;
  /** Total open shops — Founders rescued + Shrine (always open). Iter-3 stage 5+. */
  shopsOpen?: number;
  embers: number;
  /** "NEW since last visit" callout — shown in amber. Stage 5+ populates. */
  newCallout?: string | null;
}

const COLOR_BG = 0x1a1410;
const COLOR_ACCENT = '#d4a24c'; // amber for "NEW" highlight
const COLOR_TEXT = '#e5e3d8';
const COLOR_DIM = '#9a988e';

export class TownStatusStrip extends Phaser.GameObjects.Container {
  private readonly text: Phaser.GameObjects.Text;
  private readonly newText: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add
      .rectangle(GAME_WIDTH / 2, 14, GAME_WIDTH, 28, COLOR_BG, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x4a3e30, 0.6);
    this.text = scene.add
      .text(16, 14, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: COLOR_TEXT,
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5);
    this.newText = scene.add
      .text(GAME_WIDTH - 16, 14, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: COLOR_ACCENT,
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5);
    this.add([this.bg, this.text, this.newText]);
    this.setScrollFactor(0).setDepth(995);
    scene.add.existing(this);
  }

  set(data: TownStatusStripData): void {
    const segs: string[] = ['TALLOWMARK'];
    segs.push(`DAY ${data.day}`);
    if (data.renown && data.renown > 0) {
      segs.push(toRoman(data.renown));
    }
    if (data.shopsOpen !== undefined && data.shopsOpen > 0) {
      const noun = data.shopsOpen === 1 ? 'SHOP' : 'SHOPS';
      segs.push(`${data.shopsOpen} ${noun} OPEN`);
    }
    segs.push(`${data.embers} EMBERS`);
    this.text.setText(segs.join('  ·  '));
    this.text.setColor(data.embers > 0 ? COLOR_TEXT : COLOR_DIM);
    if (data.newCallout) {
      this.newText.setText(`NEW: ${data.newCallout}`);
      this.newText.setVisible(true);
    } else {
      this.newText.setText('');
      this.newText.setVisible(false);
    }
  }
}

// toRoman lives in `./numerals` (kept Phaser-free for jsdom test imports).
// Importers that need it should `import { toRoman } from '@/ui/numerals'`
// directly — no re-export here, since the local import at the top of this
// file would collide on HMR (QA-flagged BLOCKER-2).
