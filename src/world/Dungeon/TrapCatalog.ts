/**
 * Hidden trap catalog. Pure data + a small per-trap effect descriptor.
 *
 * Traps are *status delivery vehicles*, not raw damage — every trap
 * either applies a status, broadcasts player position, or both. Damage
 * (when present) exists to make the trap *feel* dangerous, but the
 * lasting tactical cost is the status applied.
 *
 * The actual trigger logic lives in `Traps.ts`, which switches on the
 * kind to produce a `TrapTriggerResult` the renderer consumes.
 */

import { TilesRPG } from '@/world/FrameCatalog';

export type TrapKind = 'spike' | 'gas' | 'alarm';

export interface TrapDef {
  id: TrapKind;
  label: string;
  /** Sprite frame for the revealed trap on the floor. TODO: verify in F9. */
  iconFrame: number;
  /** Hex colour for log lines / floating text. */
  color: string;
  /** Friendly description for the message log on first reveal. */
  spottedLine: string;
  /** Friendly description for the message log when the trap fires. */
  triggeredLine: string;
}

export const TRAP_CATALOG: Record<TrapKind, TrapDef> = {
  spike: {
    id: 'spike',
    label: 'Spike Trap',
    // Placeholder — `rockSmall` reads as a small floor blip; swap to a
    // dedicated spike frame once one is picked via the F9 inspector.
    iconFrame: TilesRPG.rockSmall,
    color: '#d44a4a',
    spottedLine: 'You spot a glint of rusted iron — a spike trap.',
    triggeredLine: 'Spikes burst from the floor!',
  },
  gas: {
    id: 'gas',
    label: 'Gas Trap',
    // Placeholder — re-use the bush frame as a small floor "vent" marker.
    iconFrame: TilesRPG.bushSmall,
    color: '#7ac74c',
    spottedLine: 'You notice a hairline seam — a gas trap.',
    triggeredLine: 'A poison cloud erupts!',
  },
  alarm: {
    id: 'alarm',
    label: 'Alarm Trap',
    // Placeholder — coin-like for now.
    iconFrame: TilesRPG.coin,
    color: '#d4a24c',
    spottedLine: 'You see a thin tripwire — an alarm trap.',
    triggeredLine: 'Bells clang! The dungeon stirs.',
  },
};

export const ALL_TRAP_KINDS: ReadonlyArray<TrapKind> = Object.keys(TRAP_CATALOG) as TrapKind[];
