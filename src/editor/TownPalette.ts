import { TilesRPG } from '@/world/FrameCatalog';

/**
 * Curated palette of frame indices the in-game painter shows. Keeping this
 * small (vs. all 1700+ rpg-pack frames) makes the palette workflow tractable;
 * we can grow it as we add more verified frames.
 */
export interface PaletteEntry {
  label: string;
  frame: number;
}

export const TOWN_PALETTE: ReadonlyArray<PaletteEntry> = [
  { label: 'grass', frame: TilesRPG.grass },
  { label: 'grassAlt', frame: TilesRPG.grassAlt },
  { label: 'dirt', frame: TilesRPG.dirt },
  { label: 'pathStone', frame: TilesRPG.pathStone },
  { label: 'water', frame: TilesRPG.water },
  { label: 'pine', frame: TilesRPG.treePine },
  { label: 'pineDark', frame: TilesRPG.treePineDark },
  { label: 'roundTree', frame: TilesRPG.treeRound },
  { label: 'autumn', frame: TilesRPG.treeAutumn },
  { label: 'bush', frame: TilesRPG.bushGreen },
  { label: 'pumpkin', frame: TilesRPG.bushOrange },
  { label: 'rock', frame: TilesRPG.rockSmall },
];
