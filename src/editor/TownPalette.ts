import { TilesRPG } from '@/world/FrameCatalog';

/**
 * Curated palette of frames the in-game painter shows. Keeping this small
 * (vs. all 1700+ rpg-pack frames) makes the workflow tractable; we can grow
 * it as we add more verified frames.
 *
 * Each entry has a *natural layer* so painting a tree on top of grass keeps
 * the grass underneath rather than replacing it. The painter switches the
 * active layer automatically based on the selected palette entry.
 */
export type MapLayerName = 'terrain' | 'overlay';

export interface PaletteEntry {
  label: string;
  frame: number;
  layer: MapLayerName;
}

export const TOWN_PALETTE: ReadonlyArray<PaletteEntry> = [
  // Terrain layer — base ground (replaces grass).
  { label: 'grass', frame: TilesRPG.grass, layer: 'terrain' },
  { label: 'grassAlt', frame: TilesRPG.grassAlt, layer: 'terrain' },
  { label: 'dirt', frame: TilesRPG.dirt, layer: 'terrain' },
  { label: 'pathStone', frame: TilesRPG.pathStone, layer: 'terrain' },
  { label: 'water', frame: TilesRPG.water, layer: 'terrain' },

  // Overlay layer — decorations that sit on top of whatever terrain they're on.
  { label: 'pine', frame: TilesRPG.treePine, layer: 'overlay' },
  { label: 'pineDark', frame: TilesRPG.treePineDark, layer: 'overlay' },
  { label: 'roundTree', frame: TilesRPG.treeRound, layer: 'overlay' },
  { label: 'autumn', frame: TilesRPG.treeAutumn, layer: 'overlay' },
  { label: 'bush', frame: TilesRPG.bushGreen, layer: 'overlay' },
  { label: 'pumpkin', frame: TilesRPG.bushOrange, layer: 'overlay' },
  { label: 'rock', frame: TilesRPG.rockSmall, layer: 'overlay' },
];
