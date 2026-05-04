# Tallowmark — pre-iteration test pass

A manual QA pass to take before each iteration ships. Catches regressions, confirms the loop holds, and surfaces the obvious "but what about X" gaps.

> Time budget: ~45 minutes for a full pass on one browser. Mobile / cross-browser are separate ~15-min passes.

---

## Setup

- [ ] `nvm use 20`
- [ ] `npm install` (only if package-lock changed)
- [ ] `npm run dev` → open `http://localhost:5173/`
- [ ] **Open DevTools console.** Leave it open the whole pass; if anything red appears, capture it as a bug.
- [ ] **Wipe save:** `localStorage.removeItem('tallowmark:save:v1')` before starting, so you're testing the new-player flow.

---

## §1 — Smoke (every scene loads cleanly)

For each, confirm: scene renders, no console errors, no missing-asset placeholders.

- [ ] **MainMenu** — title visible, four buttons, footer text
- [ ] **Settings** — three sliders show current %, Reset Save and Back buttons render
- [ ] **Town** — grass, three top buildings, Upgrade Shrine bottom-left, dungeon arch bottom-right, player sprite, HUD top-left, footer prompts
- [ ] **ConfirmDialog** — modal panel above dimmed scene, two buttons
- [ ] **Dungeon** — BSP-generated rooms+corridors, player sprite, ≥1 goblin, HP/Pow/Arm HUD, log line, prompt footer
- [ ] **Inventory** — wood panel, "(empty)" body, Close button
- [ ] **Equipment** — wood panel, five slot rows ("(empty)"), Close button
- [ ] **Character** — wood panel, stat lines including HP, Souls
- [ ] **Pause** — wood panel, four buttons (Resume / Inventory / Character / Abandon Run)
- [ ] **DeathSummary** — wood panel, stat lines, Souls earned, "Return to Tallowmark" button
- [ ] **DebugSheetScene (F9)** — labeled spritesheet, TAB cycles views, ESC returns

---

## §2 — Main menu functional

- [ ] **New Game** — clears any existing run, transitions to Town
- [ ] **Continue** — when no run exists, label reads "Continue (no save)" and is dimmed; clicking does nothing
- [ ] **Continue** with active run — resumes mid-dungeon (start a run, abandon to menu via reload, click Continue → dungeon should render with the previous seed/state)
- [ ] **Settings** — opens settings scene
- [ ] **Quit** — shows "Close the tab to quit." (browsers can't actually close)
- [ ] **ESC** from MainMenu does nothing harmful

---

## §3 — Settings

- [ ] Drag **Master** to 0 — game audio mutes (if you've added real audio later it won't be playing in v1)
- [ ] Drag **Master** to 100% — back to default
- [ ] Reload page → settings persist (Master/Music/SFX values match what you left)
- [ ] **Reset Save** → confirm dialog appears
- [ ] Click **Keep** → settings unchanged
- [ ] Click **Reset** → all settings return to defaults (80% / 60% / 80%); meta-currency would zero
- [ ] **Back** button returns to menu
- [ ] **ESC** key returns to menu

---

## §4 — Town

- [ ] Click anywhere on grass → player teleports there
- [ ] Click on a building → player walks "onto" it (acceptable for v1; collision lands in iter 2)
- [ ] Walk in all 4 cardinal directions with arrows / WASD — player sprite moves one tile per press
- [ ] Walk into the dungeon arch → confirm dialog appears
- [ ] Press Enter / Space while standing next to the arch → confirm dialog appears
- [ ] Click **Stay** → dialog closes, player still in town
- [ ] Click **Descend** → transitions to dungeon
- [ ] **ESC** returns to MainMenu

---

## §5 — Dungeon: movement & pathing

- [ ] Click an empty floor tile in line of sight → player auto-paths there, one tile per ~110ms
- [ ] Click on a wall → no path, no movement
- [ ] Click on a goblin → player paths up to and bumps it (attack)
- [ ] Click far across dungeon, then click again before path completes → path resets to new target
- [ ] Press an arrow key while auto-pathing → cancels path, takes a single manual step
- [ ] Walk diagonally with `y` `u` `b` `n` (vi-style) → 8-directional movement works
- [ ] Press `.` on empty floor → wait one turn (turn counter increments)
- [ ] Walk into stairs-down (gold tile) → run ends, returns to town with souls reward, log says "You climb back up…"

---

## §6 — Dungeon: combat & AI

- [ ] Bump a goblin → log shows "You hit the Giant Rat for X." (note: code label still says "Giant Rat" since data layer wasn't renamed; cosmetic-only mismatch with goblin sprite — log a TODO if it bothers you)
- [ ] Goblin within sight (≤8 tiles) takes a step toward you each round
- [ ] Goblin adjacent to you bumps you back, log shows "The Giant Rat hits you for Y."
- [ ] Kill a goblin → sprite disappears, log says "The Giant Rat dies."
- [ ] Get killed → player stops, log says "You die.", DeathSummary appears after a short delay
- [ ] Verify damage rolls aren't deterministic in the same session (same enemy, multiple bumps → different damage values)
- [ ] Verify the *seed* is deterministic: note the seed in the log; refresh and click Continue → same dungeon layout, same enemy positions

---

## §7 — Dungeon: pause, inventory, equipment, character

- [ ] **ESC** → Pause overlay appears, dungeon paused beneath
- [ ] Click **Resume** → unpauses, dungeon active again
- [ ] **ESC** during pause → resumes (once-listener)
- [ ] Click **Inventory** from pause → inventory opens
- [ ] Press `i` directly during gameplay → inventory opens
- [ ] Press `c` directly during gameplay → character sheet opens
- [ ] Verify enemy AI does **not** advance while inventory/character/pause are open (turn count shouldn't tick)
- [ ] **Abandon Run** → confirm dialog → Abandon → returns to town, run wiped (souls earned banked)

---

## §8 — Death loop

- [ ] Die in the dungeon → DeathSummary shows
- [ ] Souls earned is non-zero
- [ ] Total souls > 0 after first death
- [ ] **Return to Tallowmark** → town shown, HUD shows new soul total
- [ ] Re-enter dungeon → new seed (different layout)
- [ ] Die twice → souls accumulate across runs

---

## §9 — Persistence

- [ ] Make audio change in Settings → reload → setting persists
- [ ] Earn souls → reload → souls persist
- [ ] Mid-run, reload page → MainMenu's Continue is enabled and resumes the dungeon at the same seed and same player position (within 1 tile of where you reloaded)
- [ ] Die → reload → MainMenu's Continue says "(no save)"; souls persisted
- [ ] In DevTools, paste corrupted JSON into the save key: `localStorage.setItem('tallowmark:save:v1', '{not valid}')` → reload → menu loads with default state, no crash

---

## §10 — Visual review

For each scene, eyeball-check for:

- [ ] No magenta/pink "missing texture" markers anywhere
- [ ] No frame is the wrong sprite (e.g. a chest where a door should be) — note any. Use F9 → DebugSheetScene to confirm what frame a tile is. Update `src/world/FrameCatalog.ts`.
- [ ] HUD text remains readable over busy tile backgrounds (check the dungeon HP text against the corridor walls; check the town "TALLOWMARK" against grass)
- [ ] Buttons have visible bevels, hover state lightens, click state darkens
- [ ] Confirm dialog's underlying scene is visibly dimmed
- [ ] Player sprite is the bearded warrior; goblins are green humanoids
- [ ] Trees / decorations don't overlap unhelpfully with the dungeon arch or building doors

---

## §11 — Edge cases & bug hunting

- [ ] Click on the dungeon entrance arch repeatedly while the confirm dialog is up → only one dialog stacks, confirming once descends, cancelling closes cleanly
- [ ] Spam-click during the player's auto-path → path reroutes don't double-tick the turn engine (turn counter advances by exactly the number of completed steps)
- [ ] Open Inventory from the Pause menu → close inventory with ESC → still paused?
  - Expected: closing inventory should leave the pause menu visible (it was on top of pause). Note the actual behavior.
- [ ] Open Inventory directly via `i`, then ESC twice quickly → should not crash. Should land back in dungeon, not pause.
- [ ] Hold ArrowDown for 5 seconds → player moves repeatedly without crash (check FPS doesn't drop and turn count keeps up)
- [ ] Press F9 mid-run → sheet inspector opens; press ESC → returns to dungeon at same state? or restart?
  - Expected: returns to whatever scene was active. Note the actual behavior.
- [ ] Rapid-fire descend / abandon / descend → no orphan scenes left running (open DevTools → Phaser registry — tedious; check via console for Phaser scene state)
- [ ] Resize the browser window → game scales (FIT mode), no aspect distortion
- [ ] Open in two tabs simultaneously → both get the same persistent save state on reload (last write wins)

---

## §12 — Performance

- [ ] FPS stays at ~60 throughout dungeon play (DevTools → Performance → record 30s of play, look for dropped frames)
- [ ] Memory: take a heap snapshot in dungeon, walk 50 turns, take another. Diff < ~10 MB and no detached canvases / textures growing unboundedly.
- [ ] Page → Force reload (Cmd+Shift+R) ten times. Cumulative memory on the parent process shouldn't keep climbing.

---

## §13 — Browser matrix (each takes ~10 min)

Run §1, §4, §5, §6, §8 on each.

- [ ] **Chrome** desktop
- [ ] **Firefox** desktop — known difference: WebAudio decoding can be quieter on stub WAVs
- [ ] **Safari** desktop — pixel-art rendering, click latency
- [ ] **Mobile Safari** (iOS) — touch instead of click; portrait + landscape; iOS audio gating (audio won't play until first tap)
- [ ] **Mobile Chrome** (Android) — same as iOS but expect different audio gating

> Touch flow: a single tap should walk one step / engage the dungeon entrance / press a button. Long-presses currently do nothing — note any places touch *should* feel different.

---

## §14 — Accessibility quick pass

- [ ] Try to play with **keyboard only** (no mouse). All required actions reachable: menu navigation, town movement, dungeon movement, combat, pause, inventory, return to town from death.
- [ ] Zoom browser to 200% → game still playable, no clipping (Phaser FIT mode handles this)
- [ ] Reduced motion: not yet exposed but n/a — turn-based game has no continuous motion
- [ ] Color contrast on HUD text: check HP text contrast against worst-case background (light corridor floor tile)

---

## §15 — Automated suite (must be green before any iteration)

```bash
npm run lint        # ESLint flat config
npm run typecheck   # tsc --noEmit
npm test            # Vitest, 54 unit tests
npm run test:e2e    # Playwright smoke (boots game, asserts no errors)
npm run build       # production build
```

- [ ] All five commands exit 0
- [ ] Build size: `dist/` is < 2 MB total (current ~1.5 MB, mostly Phaser)

---

## Bug log template

For each issue found, capture:

```
### [SEV] Short title
- **Where:** scene / area
- **Steps:** 1. … 2. … 3. …
- **Expected:** …
- **Actual:** …
- **Console:** (paste any errors)
- **Fix idea:** (optional)
```

Severity:
- **P0 — blocking:** crash, lost save data, can't complete the loop
- **P1 — fix soon:** noticeable bug, ugly visual, persistence quirk
- **P2 — polish:** typo, minor visual mismatch, nice-to-have UX

---

## Known issues going in

(Things we already know are imperfect, so they don't get re-logged.)

- Building wall/roof rendering uses palette rectangles; proper Kenney building tiles are a TODO. Frame catalog has the placeholders marked.
- Trees are decorative shrub-frames, not pine trees. Same TODO.
- The data-layer `kind: 'rat'` and log text say "Giant Rat" while the sprite is a goblin. Cosmetic; sync in iteration 2.
- Headless Chromium can't decode our placeholder WAVs uniformly — handled in Playwright tests by filtering known-noise messages.
- Dev-only F9 debug screen exits via `scene.start(returnTo)`, which restarts the destination scene rather than resuming it (loses in-progress run state). Acceptable for a dev tool; would be wrong in production.

---

## What good looks like

After running this:
- §1 + §15 are the gate. If those don't all pass, **don't iterate** — fix first.
- §2-§9 should pass with at most a P2 item or two on the bug log.
- §10-§14 surface things to schedule into iteration 2's polish work.
- The bug log itself becomes the "first half-day of iteration 2" — fix the P0/P1s before touching new features.
