/**
 * LockCheck — predicate for whether a Tiled-authored door / trigger /
 * region is currently accessible to the player.
 *
 * Per refinement-002 §N + iter-3.5 spec, a `lock_condition` string is
 * authored on each door/trigger object. The renderer asks
 * `LockCheck.isMet(condition, ctx)` to decide whether to render the door
 * as normal, boarded (founder-not-rescued), or with a mist+blocker
 * overlay (renown / item / feat gate).
 *
 * **Condition grammar** (4 kinds, all shipped iter-3 stage 2a):
 *   - `null` / `''` — no condition, always met.
 *   - `'founder:<id>'` — true if `<id>` is in `rescuedFounders`.
 *   - `'item:<defId>'` — true if `<defId>` is currently in inventory.
 *   - `'renown:<N>'` — true if `renown >= N`. Renown source TBD until
 *      iter-7 spec lands; for now reads off `ctx.renown` (default 0).
 *   - `'feat:<id>'` — true if `<id>` is in `unlockedFeats` (iter-4 will
 *      populate this; iter-3 stage 2 always returns false for feats).
 *
 * Pure function over the condition string + a context object — Phaser-free,
 * fully unit-testable. The context shape mirrors what TownScene assembles
 * from `services.persistent` + the live `RunState`.
 */

export interface LockCheckContext {
  /** Founders the player has rescued (PersistentState). */
  rescuedFounders: ReadonlyArray<string>;
  /** Item defIds currently held in the player's inventory (RunState). */
  inventoryDefIds: ReadonlyArray<string>;
  /** Renown level — iter-7 will populate; defaults to 0 in iter 3. */
  renown?: number;
  /** Unlocked feats — iter-4 will populate; defaults to [] in iter 3. */
  unlockedFeats?: ReadonlyArray<string>;
}

/** True if the condition allows the player through. */
export function isMet(condition: string | null | undefined, ctx: LockCheckContext): boolean {
  if (!condition || condition === 'none') return true;
  const colonIdx = condition.indexOf(':');
  if (colonIdx === -1) {
    // Unknown shape — treat as locked. Don't crash on author typos.
    return false;
  }
  const kind = condition.slice(0, colonIdx);
  const value = condition.slice(colonIdx + 1);

  switch (kind) {
    case 'founder':
      return ctx.rescuedFounders.includes(value);
    case 'item':
      return ctx.inventoryDefIds.includes(value);
    case 'renown': {
      const required = Number.parseInt(value, 10);
      if (!Number.isFinite(required)) return false;
      return (ctx.renown ?? 0) >= required;
    }
    case 'feat':
      return (ctx.unlockedFeats ?? []).includes(value);
    default:
      // Unknown kind — locked. Reading the lock_condition in dev should
      // surface the typo; never silently let unrecognised gates pass.
      return false;
  }
}
