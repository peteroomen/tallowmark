# refinement-002 — pushback + forward-only design notes

A small set of points from the v2 design memo and surrounding context that
**were not fully accepted into the roadmap**. None block iter-3 work; all
are queued for the next time we have design budget.

Filed by engineering lead, 2026-05-07.

---

## Pushbacks against refinement-002

### 1. Gas cloud 4-frame puff — asset cost vs current pack

Memo §E proposes a 4-frame keyframed puff at 0/120/240/360 ms. Engineering
implementation will use a **single sprite tweened through scale + alpha + y-
offset**, not 4 distinct sprite frames, because:

- We don't have 4 puff frames in the rpg-pack or caves-dungeons pack.
- Authoring 4 custom frames (or sourcing from another Kenney pack) is
  asset overhead that doesn't justify the visual delta vs a single-sprite
  tween.
- The single-sprite tween already hits the same beats: tight cluster →
  expanded → drifting → dissipating, just driven by Phaser tween
  curves rather than texture swaps.

**Revisit if** the single-sprite version reads as "buggy" in QA, or if a
Kenney puff pack lands in `kenney_*/` that gives us 4 frames for free.

---

### 2. Dungeon arch repositioning — sequencing

Memo §N suggests moving the dungeon arch from south-centre to row 13 col 14
to free the south-centre tile for the iter-7 world-map portal at Renown VII.

**Engineering position**: agree with the move, but defer to iter-3 stage 2
(when we re-author the town in Tiled) rather than touching the iter-2 town
now. Reasons:

- The current iter-2 town is in a working state with the dungeon arch
  where it is. Moving it pre-Tiled means a manual re-paint via the in-house
  editor, which we're explicitly retiring stage-2 stage-1.
- Iter-7 is a long way off; the south-centre tile being "wrong" for ~5
  iterations doesn't cost anything.
- Moving it during the Tiled migration is essentially free (drag the tile
  in the editor).

**Action**: leave dungeon arch at its current iter-2 location. The
roadmap (iter-3 stage 2) already calls for the move; engineering will
honour it during Tiled authoring, not before.

---

### 3. Status icon long-press conflict with Action Wheel

Memo §B proposes "tap-and-hold a status icon → opens Examine bottom-sheet
for that status." Memo §K proposes long-press anywhere → opens the
Action Wheel.

These compete for the same gesture. Two ways to resolve:

a. **Status icons get a short-tap → Examine** (no long-press needed; the
   icon is small enough that a tap is unambiguous), reserving long-press
   for the Action Wheel everywhere else.

b. **Long-press on a status icon opens the Action Wheel for "Self" with
   the Examine slot pre-highlighted on the icon's status** — natural
   extension of the wheel's contextual resolver.

**Engineering preference**: (a). Tap on a status icon = "tell me about
this." Cheaper to build, no gesture conflict, easier to discover.

**Filed for design** to confirm before iter-3 stage 4 (Action Wheel) lands.

---

### 4. NPC greeting variants — content authoring cost

Memo §M proposes NPC greetings that shift across the 11 Renown tiers
(Stranger / Familiar / ... / Mythwalker). For N NPCs that's N × 11
greeting lines.

By Renown VII the town has 7 wandering NPCs + 4 Founders + ambient shop
patrons = ~15 voiced characters × 11 tiers = 165 greeting lines minimum,
plus contextual variation (festival days, time-of-day, recent player
actions).

**Engineering position**: this is tractable, but worth noting that it's
the largest content-authoring ask in the iter-7 plan. Suggest collapsing
to **4 greeting brackets** (Stranger / Welcome / Notable / Legend) per
NPC, mapped to Renown 0 / III / V / VIII. That's 60 lines vs 165, with
the greeting still drifting at meaningfully-felt intervals.

**Filed for design** to confirm.

---

## Forward-only design notes (no formal pushback — for the next design v3)

### 5. Minimap UI / UX (added to roadmap iter-2 stage 12, iter-3 stage 3, iter-7 world map)

Engineering shipped a working spec inline. Design-side questions still
open for whenever budget returns:

**Placement and form**:
- Bottom-right corner above Action Wheel anchor zone — assumed correct,
  but a player might want it top-right next to the floor/turn counter.
  Worth one playtest pass to decide.
- Square (~120×80) vs round vs hex outline — square is cheapest to
  render but a round/hex fits the medieval-ish UI grammar better. Design
  call.

**Iconography on the minimap**:
- Player blink rate — every-turn blink is the engineering proposal.
  Could be too noisy. A 2-second cycle blink might read calmer.
- Enemy ghost markers (last-seen out of FoV) — should they fade over
  N turns to indicate staleness, or persist at full alpha until re-seen?
  Roguelike convention is mixed.
- Trap glyph — proposed `×` per kind in the trap colour. May read as
  noise; consider a smaller dot-with-pulse instead.

**Expanded view (m-key toggle)**:
- 360×240 px overlay vs full-screen vs half-screen — design call.
- Should expanded minimap show enemy NAMES on hover, or stay symbolic?
- On touch: pinch-to-expand on the corner widget vs explicit tap → modal.

**World map (iter-7) specific**:
- How are travel routes between settlements drawn? Solid line, dotted,
  paw-print trail?
- Locked locations on the world map — same mist treatment as §L? Or a
  different visual language because they're regions not buildings?
- Does the player's avatar traverse the world map between locations
  (animated dot walking) or instant-teleport on click?

**UX question — broader than minimap**:
- The HUD now has: HP bar, hunger bar, status row, log panel, action
  wheel zone, inventory/character/pause buttons, floor counter, turn
  counter, and now minimap. Eight signals. The §08 wireframe in
  refinement-001 proposed 3 tiers (Vital / Tactical / On-demand). Worth
  re-doing the wireframe with the minimap added to confirm nothing is
  fighting for the same screen real estate.

---

### 6. UI design grammar — broader pass needed eventually

Engineering observation: we have a clean visual grammar for buttons
(KenneyButton variants), planks (KenneyPlank variants), and the new
status icon language (refinement-002 §B). What's *not* yet codified:

- Modal / dialog visual treatment (Pause uses KenneyPanel; Death Summary
  TBD; Threshold TBD; Examine bottom-sheet TBD)
- Tooltip / hover treatment
- Notification/toast treatment (vs floating text vs log lines)
- Loading / scene-transition treatment (currently camera fade only)
- Form controls (checkbox, slider, dropdown — Settings has sliders only)

Most of these don't exist yet because the game doesn't need them. They
become load-bearing as iter-3 / iter-4 add NPC dialogue, shop UIs,
quest pickers, character sheet expansion. Worth a dedicated UI grammar
brief once iter-3 stages 2-3 ship and we have concrete examples to react to.

---

### 7. UX — broader

Things the v2 memo doesn't address that we'll need design input on
before they're solved:

- **Onboarding.** New player sees no tutorial today. The Threshold screen
  (iter-2 stage 12) is a hint surface; the Pause controls panel is a
  reference; neither is a tutorial. At what Renown / floor / death-count
  does in-game guidance fade out?
- **Save / load UX.** Currently `tallowmark:save:v1` is implicit and
  single-slot. As the run gets longer, "abandon run" becomes weightier.
  Multi-slot save? Cloud save (per the iter-1 vision)? Save-on-quit vs
  save-on-floor-entry?
- **Settings depth.** Currently audio sliders + a "reset save" button.
  Iter-3.5 adds the dice-roll toggle. Iter-6 mobile will need control
  remapping, motion-reduction, accessibility presets. Settings will need
  a category structure before that lands.
- **Localization stance.** All current strings are inline English. If
  Tallowmark ever ships in another language, the colour-syllable
  identification system (§B in v1) is the most painful refactor — those
  syllables are deliberately language-neutral, but the trueName labels
  ("Potion of Healing") aren't. Worth a stance call: English-only forever,
  or string-table from iter-3?

---

## Status of this doc

These items are **filed, not blocked**. Iter-3 work proceeds against the
roadmap as currently written. When design budget returns, this doc is
the next-design-brief input — points 3, 4, and 5-7 are the highest
priority for design's attention; points 1 and 2 are engineering decisions
that don't need design re-litigation.
