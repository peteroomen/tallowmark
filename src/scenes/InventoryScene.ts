import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '@/config';
import { KenneyButton } from '@/ui/KenneyButton';
import { KenneyPanel } from '@/ui/KenneyPanel';
import { Rng } from '@/core/Rng';
import { getServices } from '@/services';
import { displayName, isIdentified } from '@/items/Identification';
import { getItemDef } from '@/items/ItemCatalog';
import { applyIdentifyTo, useItem, type UseIntent } from '@/items/UseEffects';
import type { RunState } from '@/state/RunState';
import type { DungeonScene } from './DungeonScene';

interface InventorySceneData {
  /** The scene to resume when this overlay closes. Defaults to Town. */
  returnTo?: string;
}

const ROW_HEIGHT = 36;
const ROW_PAD_X = 14;

/**
 * Inventory overlay. Two modes:
 *   - **Normal** — list of slots; clicking a slot selects it; bottom row has
 *     Use / Drop / Close buttons.
 *   - **Identify pick** — entered when the player uses a Scroll of
 *     Identification. Clicking an unidentified slot identifies that type
 *     and consumes the scroll; clicking the scroll again or pressing ESC
 *     cancels.
 *
 * The scene reads + mutates the live `RunState` from `SaveStore` and saves
 * back on close. Effects that the dungeon needs to render (heal animation,
 * floor reveal, blink teleport) are handed off to the running DungeonScene
 * via `applyUseIntents` — the inventory scene never touches Phaser game
 * objects in the dungeon directly.
 */
export class InventoryScene extends Phaser.Scene {
  private returnTo: string = SCENE_KEYS.Town;
  private runState: RunState | null = null;
  private selectedIdx = -1;
  private identifyMode = false;
  /** Seeded per-open from (run seed ^ turn) so ember rune rolls stay reproducible. */
  private rng = Rng.fromSeed(0);

  private slotsContainer!: Phaser.GameObjects.Container;
  private detailText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private useBtn?: KenneyButton;
  private dropBtn?: KenneyButton;

  constructor() {
    super(SCENE_KEYS.Inventory);
  }

  create(data: InventorySceneData = {}): void {
    this.returnTo = data.returnTo ?? SCENE_KEYS.Town;
    this.runState = getServices(this).save.loadRun();
    if (this.runState) {
      this.rng = Rng.fromSeed((this.runState.seed ^ (this.runState.turn * 1000003)) | 0);
    }

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    new KenneyPanel({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      width: 520,
      height: 460,
      title: 'INVENTORY',
    });

    this.modeText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 188, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#d4a24c',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    this.slotsContainer = this.add.container(GAME_WIDTH / 2 - 240, GAME_HEIGHT / 2 - 160);

    this.detailText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cfcfd5',
        align: 'center',
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5, 0);

    this.useBtn = new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 - 130,
      y: GAME_HEIGHT / 2 + 180,
      width: 110,
      text: 'Use',
      variant: 'primary',
      onClick: () => this.onUse(),
    });
    this.dropBtn = new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 180,
      width: 110,
      text: 'Drop',
      variant: 'secondary',
      onClick: () => this.onDrop(),
    });
    new KenneyButton({
      scene: this,
      x: GAME_WIDTH / 2 + 130,
      y: GAME_HEIGHT / 2 + 180,
      width: 110,
      text: 'Close',
      variant: 'secondary',
      onClick: () => this.close(),
    });

    this.refresh();

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.identifyMode) this.exitIdentifyMode();
      else this.close();
    });
    this.input.keyboard?.on('keydown-I', () => {
      if (!this.identifyMode) this.close();
    });
  }

  private refresh(): void {
    this.slotsContainer.removeAll(true);
    if (!this.runState) return;
    const slots = this.runState.inventory;
    if (slots.length === 0) {
      const t = this.add.text(0, 0, '(empty)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9a988e',
      });
      this.slotsContainer.add(t);
    }
    slots.forEach((slot, idx) => {
      const def = getItemDef(slot.defId);
      if (!def) return;
      const isSel = idx === this.selectedIdx;
      const name = displayName(this.runState!.identifications, def);
      const idMark = !isIdentified(this.runState!.identifications, def) ? '?' : ' ';
      const countStr = slot.count > 1 ? ` ×${slot.count}` : '';

      const bg = this.add
        .rectangle(0, idx * ROW_HEIGHT, 480, ROW_HEIGHT - 4, isSel ? 0x4a3a2a : 0x2a2a32, 0.85)
        .setOrigin(0, 0)
        .setStrokeStyle(1, isSel ? 0xd4a24c : 0x4a4a52);
      const icon = this.add
        .image(ROW_PAD_X + 14, idx * ROW_HEIGHT + (ROW_HEIGHT - 4) / 2, ASSET_KEYS.sprites.rpg, def.iconFrame)
        .setScale(2)
        .setOrigin(0.5);
      const label = this.add
        .text(ROW_PAD_X + 38, idx * ROW_HEIGHT + 8, `${idMark} ${name}${countStr}`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: isSel ? '#fbe6c4' : '#e5e3d8',
        })
        .setOrigin(0, 0);
      const zone = this.add
        .zone(0, idx * ROW_HEIGHT, 480, ROW_HEIGHT - 4)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.onSelect(idx));
      this.slotsContainer.add([bg, icon, label, zone]);
    });

    this.detailText.setText(this.detailFor(this.selectedIdx));
    this.modeText.setText(
      this.identifyMode
        ? 'Identify which item? (click a slot, or ESC to cancel)'
        : 'Click a slot to select. Use to consume, Drop to discard.',
    );
    this.useBtn?.setLabel(this.identifyMode ? 'Identify' : 'Use');
  }

  private detailFor(idx: number): string {
    if (!this.runState) return '';
    const slot = this.runState.inventory[idx];
    if (!slot) return '';
    const def = getItemDef(slot.defId);
    if (!def) return '';
    const name = displayName(this.runState.identifications, def);
    const known = isIdentified(this.runState.identifications, def);
    const desc = known ? def.description : 'You have not identified this yet.';
    return `${name}\n${desc}`;
  }

  private onSelect(idx: number): void {
    this.selectedIdx = idx;
    if (this.identifyMode) {
      this.tryIdentifyAt(idx);
      return;
    }
    this.refresh();
  }

  private onUse(): void {
    if (!this.runState) return;
    if (this.selectedIdx < 0) return;
    const slot = this.runState.inventory[this.selectedIdx];
    if (!slot) return;

    const result = useItem(this.runState, this.selectedIdx, this.rng);
    // Identify scroll: open picker mode instead of consuming.
    if (result.intents.some((i) => i.kind === 'identifyPicker')) {
      this.enterIdentifyMode();
      return;
    }

    if (result.consumed) this.decrementSlot(this.selectedIdx);
    this.applyUseIntents(result.intents);
    this.persist();
    this.refresh();
  }

  private onDrop(): void {
    if (!this.runState) return;
    if (this.selectedIdx < 0) return;
    this.decrementSlot(this.selectedIdx);
    this.persist();
    this.refresh();
  }

  private decrementSlot(idx: number): void {
    if (!this.runState) return;
    const slot = this.runState.inventory[idx];
    if (!slot) return;
    if (slot.count > 1) slot.count -= 1;
    else this.runState.inventory.splice(idx, 1);
    if (this.selectedIdx >= this.runState.inventory.length) this.selectedIdx = -1;
  }

  private enterIdentifyMode(): void {
    this.identifyMode = true;
    this.refresh();
  }

  private exitIdentifyMode(): void {
    this.identifyMode = false;
    this.refresh();
  }

  private tryIdentifyAt(idx: number): void {
    if (!this.runState) return;
    const slot = this.runState.inventory[idx];
    if (!slot) return;
    const def = getItemDef(slot.defId);
    if (!def) return;
    if (!def.needsIdentification || isIdentified(this.runState.identifications, def)) {
      // No-op selection of an already-identified item — the scroll is not
      // wasted; stay in identify mode until the player picks something useful
      // or cancels with ESC.
      return;
    }
    applyIdentifyTo(this.runState, slot.defId);
    // Now consume one Scroll of Identification.
    const scrollIdx = this.runState.inventory.findIndex((s) => s.defId === 'scroll_identification');
    if (scrollIdx >= 0) this.decrementSlot(scrollIdx);
    this.identifyMode = false;
    this.persist();
    this.refresh();
  }

  /** Hand off intents that need scene-side rendering to the DungeonScene. */
  private applyUseIntents(intents: UseIntent[]): void {
    if (!this.runState) return;
    const dungeon = this.scene.get(SCENE_KEYS.Dungeon) as DungeonScene | undefined;
    for (const intent of intents) {
      switch (intent.kind) {
        case 'heal': {
          const before = this.runState.player.hp;
          this.runState.player.hp = Math.min(this.runState.player.hpMax, before + intent.amount);
          break;
        }
        case 'eat': {
          this.runState.food = Math.min(this.runState.foodMax, this.runState.food + intent.food);
          break;
        }
        case 'embers': {
          getServices(this).setPersistent((s) => {
            s.metaCurrency += intent.amount;
          });
          break;
        }
        case 'revealFloor':
          dungeon?.applyRevealFloor?.();
          break;
        case 'blink':
          dungeon?.applyBlink?.();
          break;
        case 'log':
          dungeon?.applyExternalLog?.(intent.message);
          break;
        case 'applyStatus':
        case 'identifyPicker':
          // Already handled inside useItem / by mode switch.
          break;
      }
    }
  }

  private persist(): void {
    if (!this.runState) return;
    getServices(this).save.saveRun(this.runState);
  }

  private close(): void {
    this.persist();
    // Tell the dungeon to refresh its HUD now that food/hp/inventory may have changed.
    const dungeon = this.scene.get(SCENE_KEYS.Dungeon) as DungeonScene | undefined;
    dungeon?.reloadFromSavedState?.();
    this.scene.resume(this.returnTo);
    this.scene.stop();
  }
}
