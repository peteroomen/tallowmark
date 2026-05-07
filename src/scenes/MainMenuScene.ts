import Phaser from 'phaser';
import { ASSET_KEYS, COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { getServices } from '@/services';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MainMenu);
  }

  create(): void {
    const services = getServices(this);
    services.audio.playMusic('menu');

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);

    // Layout: title block + button stack centred together as one composition.
    // 4 buttons × 48px stride = 192px, plus title (~70px) + subtitle (~22px)
    // + gap (~24px) ≈ 308px total. Center vertically in 768.
    const blockHeight = 308;
    const blockTop = (GAME_HEIGHT - blockHeight) / 2;

    this.add
      .text(GAME_WIDTH / 2, blockTop, 'TALLOWMARK', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#d4a24c',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, blockTop + 64, 'a turn-based descent', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a988e',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0);

    const btnX = GAME_WIDTH / 2;
    let y = blockTop + 120;
    const dy = 48;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'New Game',
      primary: true,
      onClick: () => this.startNewGame(),
    });
    y += dy;

    // Continue is enabled if EITHER an in-progress dungeon run is saved OR
    // the player has completed at least one run before (persistent state
    // exists). The previous behaviour disabled Continue whenever loadRun()
    // returned null — but loadRun is null after death (DeathSummary calls
    // clearRun), so a returning player whose last action was dying saw a
    // disabled Continue button despite localStorage having full state.
    // This was the QA-flagged "Continue non-functional" bug.
    //
    // continueRun() already routes correctly: if a run exists → Dungeon
    // resume, otherwise → Town. We just need to enable the click.
    const hasSavedRun = !!services.save.loadRun();
    const hasPlayedBefore = services.persistent.hasCompletedFirstRun;
    const canContinue = hasSavedRun || hasPlayedBefore;
    const continueBtn = new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: hasSavedRun ? 'Continue' : canContinue ? 'Continue' : 'Continue (no save)',
      onClick: () => {
        if (canContinue) this.continueRun();
      },
    });
    if (!canContinue) {
      continueBtn.setAlpha(0.45);
      continueBtn.disableInteractive();
    }
    y += dy;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'Settings',
      onClick: () => this.scene.start(SCENE_KEYS.Settings),
    });
    y += dy;

    new KenneyButton({
      scene: this,
      x: btnX,
      y,
      text: 'Quit',
      onClick: () => {
        // Browsers won't actually allow window.close; show a friendly message.
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, 'Close the tab to quit.', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#9a988e',
          })
          .setOrigin(0.5);
      },
    });

    // Hint footer
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 16, `seed-based runs · keyboard or mouse · 8-dir`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#5a5848',
      })
      .setOrigin(0.5);

    void ASSET_KEYS.audio.sfxClick; // ensure import remains tree-shakable
  }

  private startNewGame(): void {
    const services = getServices(this);
    services.save.clearRun();
    this.scene.start(SCENE_KEYS.Town, { fresh: true });
  }

  private continueRun(): void {
    // If there's an in-progress dungeon run, jump back into it; otherwise to town.
    const run = getServices(this).save.loadRun();
    if (run) {
      this.scene.start(SCENE_KEYS.Dungeon, { resume: true });
    } else {
      this.scene.start(SCENE_KEYS.Town, { fresh: false });
    }
  }
}
