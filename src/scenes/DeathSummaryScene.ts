import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { getServices } from '@/services';

interface DeathData {
  turn: number;
  floor: number;
  kills: number;
}

/**
 * The Ledger — replaces the old Death Summary list-of-fields.
 *
 * Per refinement-001 §4.2 + refinement-002 confirmations: a four-card
 * layout. Cause-of-death top-left, Embers earned top-right, "what's new
 * in town" forward-looking bottom-left, Return-to-Tallowmark button
 * bottom-right. Run-at-a-glance band across the centre. The forward-
 * looking card matters most — it's what makes "death is a step in a
 * longer arc" feel earned, not bookkept.
 *
 * Cards cascade in 80 ms × 4 (per refinement-002 §J) so the ledger
 * builds in front of the player rather than slamming on screen.
 */
export class DeathSummaryScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.DeathSummary);
  }

  create(data: DeathData): void {
    const services = getServices(this);

    // Bank embers (formula factors floor + turns + kills).
    const embers = Math.max(1, data.floor * 5 + Math.floor(data.turn / 3) + data.kills * 2);
    services.setPersistent((s) => {
      s.resources.embers += embers;
    });
    services.save.clearRun();

    // Full-screen darken — the moment.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a10);

    // YOU DIED title at the top, sitting above the cards.
    this.add
      .text(GAME_WIDTH / 2, 60, 'YOU DIED', {
        fontFamily: 'serif',
        fontSize: '40px',
        color: '#d44a4a',
        fontStyle: 'bold',
        stroke: '#1a0a0a',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 100, 'The dungeon claims another soul.', {
        fontFamily: 'serif',
        fontSize: '14px',
        color: '#9a988e',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Four cards in a 2×2 grid + a centre run-at-a-glance band.
    const cards: Phaser.GameObjects.Container[] = [];

    // Top-left: cause of death (the question every player asks first).
    cards.push(
      this.makeCard(
        GAME_WIDTH / 2 - 200,
        GAME_HEIGHT / 2 - 90,
        320,
        110,
        'YOU DIED ON',
        `Floor ${data.floor}`,
        'Cause: starvation, blade, or trap.',
        '#d44a4a',
      ),
    );

    // Top-right: embers earned (the answer to "was it worth it").
    cards.push(
      this.makeCard(
        GAME_WIDTH / 2 + 200,
        GAME_HEIGHT / 2 - 90,
        320,
        110,
        'EMBERS BANKED',
        `+ ${embers}`,
        `Total: ${services.persistent.resources.embers}`,
        '#d4a24c',
      ),
    );

    // Bottom-left: what's new (forward-looking — answers "why press start again").
    const whatsNew = this.computeWhatsNew(services, data.floor);
    cards.push(
      this.makeCard(
        GAME_WIDTH / 2 - 200,
        GAME_HEIGHT / 2 + 50,
        320,
        110,
        "WHAT'S NEW IN TOWN",
        whatsNew.title,
        whatsNew.body,
        '#6aa84a',
      ),
    );

    // Bottom-right: the button. Eye lands here last; easiest to press.
    const buttonContainer = this.add.container(GAME_WIDTH / 2 + 200, GAME_HEIGHT / 2 + 50);
    new KenneyButton({
      scene: this,
      x: 0,
      y: 0,
      width: 280,
      height: 80,
      text: 'Return to\nTallowmark',
      variant: 'primary',
      onClick: () => this.scene.start(SCENE_KEYS.Town),
    });
    cards.push(buttonContainer);

    // Centre band: run-at-a-glance.
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 145,
        `${data.turn} turns · ${data.kills} kills · floor ${data.floor}`,
        {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#9a988e',
          fontStyle: 'italic',
        },
      )
      .setOrigin(0.5);

    // Cascade animation — 80 ms per card, slide up 16 px + fade in.
    cards.forEach((c, i) => {
      c.setAlpha(0);
      c.y += 16;
      this.tweens.add({
        targets: c,
        alpha: 1,
        y: c.y - 16,
        duration: 240,
        delay: i * 80,
        ease: 'Quad.easeOut',
      });
    });

    // Keyboard parity — Enter / Space / Esc all return to town.
    const onAny = () => this.scene.start(SCENE_KEYS.Town);
    this.input.keyboard?.once('keydown-ENTER', onAny);
    this.input.keyboard?.once('keydown-SPACE', onAny);
    this.input.keyboard?.once('keydown-ESC', onAny);
  }

  private makeCard(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    headline: string,
    body: string,
    accent: string,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(cx, cy);
    const bg = this.add
      .rectangle(0, 0, w, h, 0x1a1a24, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4a4a52);
    const labelText = this.add
      .text(-w / 2 + 12, -h / 2 + 10, label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: accent,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    const headlineText = this.add
      .text(-w / 2 + 12, -h / 2 + 30, headline, {
        fontFamily: 'serif',
        fontSize: '22px',
        color: '#e5e3d8',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    const bodyText = this.add
      .text(-w / 2 + 12, -h / 2 + 64, body, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9a988e',
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0, 0);
    container.add([bg, labelText, headlineText, bodyText]);
    return container;
  }

  /**
   * Forward-looking "what's new" card. Iter-2 has limited persistent
   * surface to draw on, so the line is mostly meta-currency framing.
   * Iter-3 Founders + iter-4 Feats will give this real material.
   */
  private computeWhatsNew(
    services: ReturnType<typeof getServices>,
    deepestFloor: number,
  ): { title: string; body: string } {
    const meta = services.persistent.resources.embers;
    const founders = services.persistent.rescuedFounders.length;
    if (founders === 0 && deepestFloor < 3) {
      return {
        title: 'A founder waits below.',
        body: `Reach floor 3 to find the Apothecary. (You: ${meta} embers.)`,
      };
    }
    if (founders === 0 && deepestFloor >= 3) {
      return {
        title: 'You felt eyes on you.',
        body: `Someone watched from a locked cell on floor ${deepestFloor}.`,
      };
    }
    return {
      title: 'Tallowmark waits.',
      body: `${meta} embers banked. Spend them on the way back through.`,
    };
  }
}
