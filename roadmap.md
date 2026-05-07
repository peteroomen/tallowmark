# Tallowmark roadmap

A living document. Captures the design vision and the iteration plan. Update as decisions get made.

---

## North star

A **turn-based grid roguelite** that fuses three reference points:

- **Rogue / NetHack / DCSS** — the classic feel: synchronous turns, bump combat, FOV, hunger, item identification, traps, kiting through chokepoints.
- **Shattered Pixel Dungeon** — tight tactical UX, contextual inputs, touch-first interface, readable pixel art.
- **Darkest Dungeon** — a hub town that **grows** as you do more runs. Specialists are *found* in the dungeon, brought home, then upgraded with tiered meta-resources to alter what spawns and what your runs feel like.

The hook: **brutal classic gameplay + a town worth coming home to.** Death isn't a failure state, it's a step in a longer arc.

---

## Design pillars

1. **Turn-based, deterministic, seeded.** Reproducible runs. No real-time pressure during gameplay; pressure comes from resource management.
2. **Data-first architecture.** The game is a state machine that happens to have sprites. Data layer is fully testable in isolation.
3. **Touch-friendly from day one.** Even though v1 ships desktop, every UI decision considers a thumb on a 5-inch screen.
4. **Iterable systems.** Classes, magic, items, and town buildings are all defined as data + components, not bespoke code. Adding a new spell or NPC is content work, not engineering work.
5. **Metaprogression is opt-in depth, not a power gate.** A first-run player can complete a full loop. Returning players unlock variety (more classes, more spells, more shop services), not raw power that trivializes the game.

---

## Iteration plan

Each iteration ends with a **playable build**. We don't merge half-finished systems.

### v1 — Vertical slice (the "skeleton runs")
**Goal:** end-to-end loop, every system stubbed at its interface, one of each thing.

- Main menu (New Game, Continue stub, Settings, Quit)
- Town scene with a few placeholder buildings and a dungeon entrance
- Confirmation dialog when entering the dungeon
- One BSP-generated dungeon floor
- Click-to-path movement (mouse) + keyboard movement (arrows / numpad / HJKL), 8-directional
- Bump combat
- One enemy (Rat) with simple chase AI
- HP system, death → summary screen → return to town
- Pause / Inventory / Equipment / Character Sheet screens (wired up, mostly empty)
- Settings screen with master / music / SFX volume sliders
- Placeholder silent audio files
- Game UI rendered with the Kenney UI pack
- Architected-but-stubbed: FOV, hunger, identification, traps, meta-currency, persistent upgrades, spells/scrolls, multi-floor, classes

**Success criteria:** new player → menu → town → dungeon → die → back to town → start another run, all without crashes, all on keyboard *or* mouse.

---

### Iteration 2 — The Tactical Foundation

**Goal:** transition from "tech demo" to "playable pressure cooker." Introduce the **Message & Feedback Loop** (narrative connective tissue) and the **Core Item Manifest** (tactical connective tissue) so disconnected systems read as a coherent game.

**Theme:** environmental + status-based depth, not combat-math depth (no crits/dodges in iter 2 — those live in iter 3's combat overhaul).

**Stage 1-4 — Shipped.** Bug-fix triage + UI grammar foundations + paint mode + Tiled JSON + town visuals + fog of war + ghost markers + edge feather. See git log for details.

**Stage 5 — The Feedback Engine** (½ day)
The narrative connective tissue. Builds the **Event Bus** that every following stage hangs off.
- `core/Events.ts` — typed discriminated-union event bus (`damageDealt`, `enemyDied`, `itemPickedUp`, `statusApplied`, `trapTriggered`, etc.). Pure data, no Phaser deps.
- **Log stream** (persistent): existing 4-line log, gets colour-coded — White (action), Yellow (discovery), Red (danger), Green (recovery), Cyan (story).
- **Floating-text stream** (ephemeral): "bouncer" numbers and short phrases at world tile coords. Damage red, healing green, "!Spotted!" yellow over traps. Z-depth above the FogMask (depth 70+) so they're never lost in shadow.
- Combat / item / status code stops calling `this.log()` directly; emits events. UI subscribers translate events to log lines + floating text.

**Stage 6 — Item Manifest + Inventory + Hunger** (1.5 days)
The tactical connective tissue. Combines item placement, the player's inventory, and the hunger clock — all of which depend on each other.
- **Item placement in dungeon gen**: floor-aware spawn rates; auto-pickup on walk-onto.
- **Player ↔ Inventory wiring**: `Player.inventory: Inventory` initialized in `newRunState`, persisted on save.
- **Hunger system**: `food`/`foodMax` on `RunState`; world-tick subscriber decrements per turn; <40 food triggers starvation (-1 HP every 5 turns); HungerBar widget alongside HpBar.
- **The 8-item starting manifest:**

  | Type | Name | Effect | Identification |
  |---|---|---|---|
  | Potion | Healing | +25% HP | Colour label ("Red Potion") |
  | Potion | Fortitude | +2 Armor for 20 turns | Colour label |
  | Potion | Poison | Apply Poisoned (5 turns) | Colour label |
  | Scroll | Mapping | Reveal walls + traps on floor | Title gibberish ("Scroll of KIR") |
  | Scroll | Blinking | Teleport to a random visible tile | Title gibberish |
  | Scroll | Identification | Identify one item in your bag | Title gibberish |
  | Food | Hardtack | +80 food | Always identified |
  | Rune | Ember Rune | +10–20 Embers (meta-currency) | Always identified |

- **Action verbs**: Use (drink/read/eat/equip), Drop, Pickup (auto on walk).
- **Identify scroll workflow**: opens Inventory in "select target" mode — click an unidentified slot to identify that item type for the rest of the run. (No world-space reticle; sub-menu only.)

**Stage 7 — Status Effects + Item Identification** (1 day)
- `StatusEffect` interface: `id`, `duration`, `tickEffect`, `onApply`, `onRemove`. Per-entity `Map<id, StatusEffect>` on player and enemies.
- v1 effects: **Healing** (regen 1 HP/turn), **Fortitude** (+armor), **Poisoned** (1 HP/turn), **Confused** (movement direction mirrored), **Bleed** (1 HP/turn, lower-stack than Poison).
- HUD: 16×16 status icon row next to HP bar with countdowns. Green Cross / Shield / Skull / Swirly / Drop sprites picked from rpg-pack via F9 inspector.
- **Stack rule:** refresh-with-extension. Two Strength potions = the longer remaining duration, not stacked magnitude.
- **Identification labels:** per-run shuffled via seeded RNG. Drinking a Cloudy Potion that turns out to be Healing identifies *Cloudy Potion = Healing* for the rest of the run. Wipes on next run.

> **Deferred to iter 3:** terrain-status interactions (e.g. water halves Poison, creates Tainted tile). Dungeons currently have no varied terrain; the interaction has nothing to fire on. Lands when iter-3 adds water/lava/etc to dungeons.

**Stage 8 — Hidden Traps** (½ day)
Traps are *status delivery vehicles*, not raw damage.
- `TrapState` parallel to tile data (a `Map<tileKey, TrapState>` on the dungeon). Cleaner than introducing a TrapKind tile because it lets traps coexist with floor tiles.
- Trap kinds:
  - **Spike Trap** — 5–8 damage + Bleed (1 HP/turn for 3 turns)
  - **Gas Trap** — releases a 3×3 Poison Gas cloud (each affected tile applies Poisoned to entities standing on it)
  - **Alarm Trap** — 0 damage; broadcasts player position to all enemies in 10-tile radius (sets their AI state to CHASE)
- Player `perception: number` (default ~30%). Each turn, for each unrevealed trap within 1 tile, roll perception; on success, mark revealed and emit `trapSpotted` event (yellow log line + "!Spotted!" floating text).
- **Wait button** in the HUD doubles as **Search** — magnifying-glass icon, single-tap waits, double-tap or long-press searches (boosts perception roll for that turn). Touch-first compliant.
- BSP gen: place 1 trap per ~3 rooms on floor tiles only.

**Stage 9 — Skeleton Archer** (½ day)
Second enemy archetype — teaches the player to use line-of-sight tactically.
- `ArcherAi`: maintains 3–5 tile distance from player; if player in straight LoS within 5 tiles, fires; if player adjacent, tries to retreat.
- **Projectile:** tween a small arrow sprite along Bresenham line over ~120ms, then resolve damage. (Gemini asked tween-vs-ray; tween wins for the visual moment.)
- Stats: 3 HP, 3 power, 0 armor — glass cannon. Spawns from floor 2+.
- Player ranged attacks **don't** land in iter 2. Skeleton archer is the only thing with range; teaches the kiting → cover loop.

**Stage 10 — Multi-Floor Descent + Floor Identity** (1 day, was ½)
- Stairs-down increments `runState.floor`, regenerates the dungeon with `seed + floor`, **keeps** player state (HP, inventory, statuses, embers), **clears** `exploredTiles` (each floor is its own map).
- Per-floor scaling: `enemy.hp = 5 + floor`, `enemy.power = 2 + Math.floor(floor / 3)`, enemy count `min(2 + floor, 8)` (already in place).
- Stairs-up only on floor 1 — climbing exits to town with banked Embers. Deeper floors are descent-only.
- Embers reward scales with deepest floor reached.
- **Bosses deferred** to iter 3+. Floor 10 just shows a "you've reached the deepest known level" wrap screen for now.
- **Floor descriptor** picked at gen time from a small pool — `Quiet` (fewer enemies, more loot, one Alarm trap that turns it into a panic), `Cramped` (corridor-heavy, archers a real threat), `Open` (large rooms, kiting works, ambushes can't), `Trapped` (double trap density, food is plentiful), `Hungry` (no food drops, descend or die). Surfaces in the floor entry log + the floor name in the HUD ("Floor 4 — *Open*").
- **Floor descriptor title card** (per refinement-002 §E) — 2-second fade-in card on floor entry: 48px serif text "Floor 4" with italic descriptor below, centred, depth 950 (above floating text, below pause overlay). Timing: 200 ms fade-in / 1400 ms hold / 400 ms fade-out. The card is the *moment*; the HUD label and log are the persistent reference.

**Stage 11 — The Wayfarer** (½ day)
Default starting class. Not a true class system — that's iter 4. This is naming + stats + starting kit so the character sheet shows a coherent identity.
- Class: **Wayfarer** (replaces "Wanderer (placeholder)" in CharacterScene)
- Stats: HP 30 (was 20), Power 5 (was 4), Armor 1 (unchanged), foodMax 200, perception 30%
- Starting kit: 1× Hardtack + 1× random unidentified potion in the inventory at run start
- "Class blueprint" architecture: `entities/classes/Wayfarer.ts` defines stats + starting kit as data; future classes (iter 4: Brigand, Acolyte, Ironclad) slot into the same shape.

**Stage 12 — Iter 2 closeout: feel polish + manual test pass** (1 day, was ½)
The iter-2 systems work. Stage 12 is where they start to *feel*. All five additions land alongside the manual test pass + P0/P1 triage that was always planned for this stage.

- **Threshold screen** (replaces the bare "Descend?" confirm). One-screen world-state card: today's open shops, today's banked Embers, today's drop pool. One big descent button. No menu — a doorway. Speed-runners dismiss with one input; new players read it. (The optional-Goal layer the design memo proposes is deferred to iter 4 alongside Feats.)
- **Ledger** (replaces the Death Summary). Four-card layout: cause-of-death top-left, Embers earned top-right, "what's new in town" forward-looking bottom-left, single Return-to-Town button bottom-right. The "what's new" card shows changes that will be true *next* run, never backward-looking restating of what already happened.
- **Death beat polish** — player sprite stays visible ~300 ms after HP=0; the world *desaturates* rather than blacks out (contour visible); the "DIED" floating bouncer that's already in code hangs ~400 ms before the camera fade kicks in. Existing 600 ms timing stays; the *content* of those 600 ms is what's being spec'd.
- **Floor descriptor surfacing** if it didn't land in stage 10 (defensive duplicate).
- **48-px touch target floor** — `CLAUDE.md` updated from `≥ 32 px` to `≥ 48 px (= one tile)`. Existing HUD buttons (currently 36) grow to 48. Matches Apple HIG (44) / Material (48), and matches the natural unit of the world.
- **Tap distinction (adjacent vs distant)** — current click handler always invokes `findPath`; needs a one-line check so `chebyshev(player, target) === 1` skips pathfinding and fires `tryStep(target)` directly. One rule, two behaviours, zero ambiguity.
- **Floating-text HUD keepout** — spec a 64-px clipping border in the floating-text spawner so damage numbers never render under HUD chrome regardless of z-depth. Clipping, not just z-order.
- **Status icon grammar refactor** (per refinement-002 §B) — three-field language: **Glyph** encodes the *concept* (cross / drop / skull / swirl / shield) tied to category not flavour, **Tint** encodes valence (green buff, red debuff, blue control, yellow neutral) matching log-line palette, **Frame** encodes kind (solid = buff, dashed = debuff, double-line = control) as colourblind-safe duplicate. Bleed and Poisoned share the drop glyph; tint + frame distinguish. Pre-empts the iter-4 status expansion (Burning / Frozen / Stunned / Charmed / Slow / Strength / Weakness — 7 more) needing a re-pass.
- **Three-state status countdown** — ≥4 turns: numeral steady. 2-3 turns: numeral pulses subtly (alpha 1.0 → 0.7, 800 ms cycle). 1 turn: numeral red, frame flashes once per turn-tick (240 ms alpha 1 → 0.4 → 1). The 1-turn flash is the only motion in the HUD — earned, and exactly when the player needs the count.
- **Animation timing spec** (per refinement-002 §J) — concrete ms numbers locked: actor step 110 ms easeOutQuad (current), bump-attack 70 ms out + 70 ms back with 6px overshoot, damage float 600 ms (current), heal float 800 ms (slower = lingering goodness), status apply flash 180 ms single white pulse, trap reveal 200 ms scale 1.2→1, door open 180 ms, stair descend 350 + 50 + 350 ms (the hold matters), Ledger card cascade 80 ms × 4, Threshold descent button 0 ms (immediate; hesitation reads as the game questioning you). **No screen shake** — turn-based games don't earn it.
- **Gas cloud animation upgrade** (per refinement-002 §E) — replace the current 600 ms green flash (reads as "buggy") with a 4-stage tween on a single sprite: tight cluster at 0 ms (alpha 0.9, scale 0.7) → expanded at 120 ms (alpha 0.95, scale 1.0) → drifting at 240 ms (alpha 0.85, scale 1.05, +2px y) → dissipating at 360 ms (alpha 0.5, scale 1.1, +4px y), then linger as a static reduced-alpha sprite for the gas duration. Snappy first 120 ms, lingering tail = "this tile is still poisonous".
- **Minimap MVP — bottom-right HUD widget.** Persistent dungeon minimap, ~120×80 px, in the bottom-right corner above the Action Wheel anchor zone (so the wheel opens INSIDE the minimap area when triggered for self — minimap fades to alpha 0.3 while wheel is open). Each dungeon tile renders as 3×3 px:
  - **Walls** dark `#2a2218` ; **floors** `#6a6470` (current rect colours).
  - **Visible tiles** rendered at full alpha; **explored-but-not-visible** at alpha 0.5; **unexplored** not rendered.
  - **Player** as a 3×3 amber dot `#d4a24c`, blinking once per turn.
  - **Stairs** as a 3×3 cyan dot `#4a9ed4`.
  - **Enemies** in current FoV as 3×3 red dots `#d44a4a`. Ghost markers (last-seen out of FoV) as semi-transparent red.
  - **Items** as 3×3 yellow dots `#d4a24c` (matches discovery tone — "things to find").
  - **Revealed traps** as small `×` glyph in trap colour (red/green/amber per kind).
  - **Click on minimap** → camera pans to that location (read-only, doesn't path-find — clicking the world tile still does that).
  - **Toggle key** `m` to expand to ~360×240 px overlay. ESC or `m` again to collapse.
- **Minimap is the bridge to the iter-7 world map.** Same widget shape; different content. Iter-7 swaps the dungeon-tile renderer for a town-tile + dungeon-entrance + settlement-pin renderer when the player is on the world-map view. Same 120×80 corner widget, same toggle key.

---

**Cross-cutting infra to ship before / during the above:**
- Z-depth hierarchy: tiles 0 / actors 9-10 / hover-marker 60 / fog 50 / floating text 70 / ghost markers 8 / HUD 1000+
- Action-verb model: extend onKey to `u` (use), `d` (drop), `s` (search/wait toggle)
- Character stat aggregation: `Player.effectiveStats()` = base + equipped item bonuses (Equipment class already exists; just needs to be wired)

**Iter 2 estimate (refined):** ~6–7 working days for stages 5-11, plus 1 day Stage 12 closeout (+½ day vs the original spec to absorb the design-memo polish work).

---

### Iteration 3 — Town growth & Found Founders
**Goal:** the metaprogression loop kicks in. The town stops being a static map and the buildings stop being painted rectangles.

**Stage 1 — Tiled migration** (1–1.5 days)
First stage of iter 3. Replaces the in-house painter with Tiled. See "Tooling — level editor & frame inspector" further down for the full case. Trigger: hand-authored dungeon room templates and NPC placement, both of which need features the in-house painter shouldn't grow.

**Stage 2 — Proper building exteriors + 3-tier growth + interior scenes + Town Status strip** (2.5–3 days)
The buildings in iter 2 are intentionally painted rectangles. Once Tiled and auto-tiling are in place, replace each building with a real multi-tile composition AND give every building three exterior visual tiers driven by `PersistentState`. The "town has a state — show it" thesis from the design memo lands here: every return to town must visibly reflect what the player just spent.

- **Exteriors:** each building authored in Tiled as **three exterior variants** (one per tier), selected at render time:
  - **Tier 0 — Locked.** Founder not yet rescued. Boarded windows, no chimney smoke, sign missing, door interaction line: "Apothecary still missing."
  - **Tier 1 — Founded.** Founder rescued, base shop. Sign hung, faint chimney smoke, NPC inside, basic exterior.
  - **Tier 2 — Practiced.** Any L2+ upgrade purchased on this building. Window glow, signage, expanded exterior, ambient customer NPC.
  - (A Tier 3 "Renowned" was proposed but cut for scope — 4 tiers × 4 buildings × ~16 tiles is real content work; revisit in iter 5 if the felt-difference still lacks headroom.)
- **Door = portal.** Walking onto a building's door tile triggers a transition into a per-building **interior scene** (`ApothecaryInteriorScene`, `BlacksmithInteriorScene`, `InnInteriorScene`, `ShrineInteriorScene`). Interiors use the indoor tile range of the rpg-pack (wood floors, plaster walls, hearths, counters, shelves).
- **Interior shape:** generic 10×8 layout pattern reused by all four buildings — exit tile north-centre, NPC stand position south-centre, shop-counter east-side, decoration density ~30%. Theming differs (cauldrons in Apothecary, anvil in Blacksmith, hearth + tables in Inn, runes in Shrine) but the *layout* is consistent so players don't relearn navigation per building. Paused-on-leave so re-entry is instant.
- **NPCs slot here.** Found Founders live *inside* their respective buildings once rescued — interior scenes are where the shop UI and dialogue land. Empty pre-rescue (Tier 0 furniture only); furnished + populated post-rescue (Tier 1+).
- **Town Status strip.** Single-line HUD element along the top of TownScene: `TALLOWMARK · DAY 14 · 2 SHOPS OPEN · 47 EMBERS · NEW: Apothecary L2 — Frost Potions now drop`. The yellow "NEW" segment is dismissable by walking into the shop it refers to. Bridges *I spent currency* → *the world is different*.
- **Touch-friendly entry:** door tiles are normal walkable cells; tap-to-walk plus a confirm-to-enter prompt (mirrors dungeon descent UX).

> **Why the 3-tier framing matters:** without visible growth the metaprogression feels bookkept, not earned. Authoring 3 exterior variants per building once in Tiled is cheap; the *renderer* gates on `PersistentState` so the right variant shows automatically. Without this, the town becomes a static backdrop that happened to be authored in Tiled.

**Locked-in spec from refinement-002:**

- **Footprint convention.** Every building occupies a **3W × 3H** rectangle on the town grid, door on the *south face, centre tile*. Inn is the deliberate exception — 3×4. Variation is *vertical* (roof shape, chimney count, window count) and *theming* (sign, colour), never footprint. The uniformity is what makes iter-7 building additions a Tiled edit not a TownScene rewrite.
- **What makes buildings readable from across the map without text labels** — ranked: (1) roof colour: red tile (Apothecary) / slate grey (Blacksmith) / brown thatch (Inn) / no roof, stone arch (Shrine); (2) smoke: none / double / single thatch-vent / none; (3) footprint: 3×3 / 3×3 / **3×4** / 3×3 (Inn's extra row is the strongest silhouette differentiator); (4) glow colour at T2: green / orange / yellow / cyan. Don't rely on signs — signs are confirmation, not identification.
- **Shrine T1-only.** Shrine has no Founder to rescue — ships at T1 day 1 (T0 doesn't exist for it). Stone arch reads *open to sky*; reads inverse to the others.
- **Locked-but-visible visual language** (per refinement-002 §L) — primary: **mist + boarding**, with desaturation reserved for accessibility (colourblind / motion-sensitive opt-out). Two cues: physical block (boarded planks / chained gate / bricked wall — diegetic blocker form depends on what's blocked) AND mist overlay (sub-tile drifting fog, alpha 0.35, slow horizontal drift 8 px/sec, only on the locked tile/building/region). Together: *this is a place. It's not for you yet. You can see why.* Density scales with how distant the unlock is — day-1 secret door = thin mist; day-1 Wizard's Tower = thick fog with barely-readable silhouette. Players learn: *more fog = farther unlock*.
- **Tiled layer conventions** for `town.tmj`:
  - `terrain` — grass, paths, water, base ground
  - `terrain_alt` — alt-floor scatter (1-in-8 grass variants, deterministic per seed)
  - `decoration_low` — bushes, small rocks, beneath actor depth
  - `building_exterior_T0` / `_T1` / `_T2` — three variants per building; renderer picks based on `PersistentState[buildingId].tier`
  - `decoration_high` — tall trees, above actor depth, alpha 0.7 when actor passes behind
  - `mist_locked` — fog overlays for locked content
  - `objects` — NPCs, doors, triggers, signs
  - `collision` — explicit walkable mask for ambiguous tiles
- **Object naming grammar** (parser splits on `:`, dispatches by `kind`): `kind:id[:modifier]`. Examples: `door:apothecary_main`, `door:secret_passage:feat_identify_100`, `npc:wandering_merchant:renown_3`, `trigger:dungeon_arch_2:renown_3`, `trigger:world_map_portal:renown_7`. Adding a new kind in iter 7 = add one parser branch + one renderer.
- **Door schema generalisation** — every door is JSON `{ type, id, target_scene, lock_condition, locked_visual }`. Renderer reads `lock_condition`: `null` + Founder rescued → render T1/T2 door; `null` + Founder not rescued → render T0 boarded; condition set + unmet → render `locked_visual` blocker + mist + Examine sheet on interaction; condition set + met → normal door. **One door schema, all gating.** Iter-7 secret doors hang off this without changes.
- **Reserve corner grid zones for iter-7 expansion** (per refinement-002 §N) — the iter-2 town is 24×16. Earmark these zones BEFORE any building lands, leave grass:
  - **NW (cols 0-3, rows 0-3)** — Wizard's Tower at Renown V (visible as silhouette through dense fog from day 1)
  - **NE (cols 20-23, rows 0-3)** — festival stage at Renown VIII
  - **SW (cols 0-3, rows 12-15)** — walled garden at Renown II
  - **SE (cols 20-23, rows 12-15)** — second dungeon arch at Renown III
  - **South-centre (col 12, row 13)** — leave free for the world-map portal at Renown VII
- **Move dungeon arch off south-centre** to row 13 col 14 (south-east of centre) so the iter-7 world-map portal has a home.
- **What NOT to do** — do not hardcode building IDs in scene code; everything from object names. Do not inline lock conditions in renderer; they live on the object, renderer asks `LockCheck.isMet(condition, state)`. Do not size the town for what we have — size for what we'll have. The 24×16 already accounts for this if corner zones are honoured.

**Stage 3 — Dungeon visual pass** (1–1.5 days)
The dungeon currently renders as palette-tinted rectangles — `0x32323a` walls, `0x6a6470` floors. That was the right call in iter 1/2 (focus on systems, defer art), but it ages badly the moment the rest of the world has real tiles. Replace the rect renderer with a proper tileset using `kenney_roguelike-caves-dungeons` (the `roguelikeDungeon_transparent.png` sheet — same 16×16 + 1px gutter Kenney standard, 29×18 frames).

- **Wire the new sheet** through `ASSET_KEYS.sprites.dungeon` and a `TilesDungeon` block in `FrameCatalog.ts`. Verified frame indices via the F9 inspector; same convention as the rpg-pack catalog.
- **Auto-tiled walls + floors** via Tiled's terrain set: paint a wall and Tiled picks the right corner / edge / interior frame. Solves the classic "wall sprite tileset puzzle" once.
- **Floor variants** — scatter alt-floor frames at ~1-in-8 ratio so corridors don't look stamped (mirrors the `grassAlt` pattern shipping in iter-2 town v3).
- **Stairs / doors / chests** as proper tile sprites — replaces the amber rectangle for stairs-down and the brown rect for doors.
- **Floor biomes seeded.** The same renderer drives multiple visual themes by swapping the active tile palette: **Caves** (organic, mossy stone — caves-dungeons pack as-is), **Crypts** (the bone / sarcophagus row of the same pack, plus rpg-pack gravestones), **Ruins** (rpg-pack stone block frames). Iter-3 ships caves only; the other two slot in alongside iteration 5's biome rotation work.
- **No data-layer changes.** `TileKind` stays the same — only the renderer in `DungeonScene.drawTiles` swaps from `add.rectangle` to `add.image` with frame lookups via the auto-tile pass.

> **Why this lives here, not earlier:** the dungeon's rectangle look is *deliberately* placeholder — every iter-2 stage 4–11 issue is a system bug or a UX issue, not a "the floor isn't pretty" issue. Pulling the dungeon visual pass into iter 2 would cost a day and obscure the actual feedback signal (does the system work?). Once Tiled is in (iter-3 stage 1), painting and auto-tiling the dungeon is cheap.

**Locked-in spec from refinement-002 §E:**

- **Frame role table** is the contract — verify exact frames in F9 before commit, but lock the *roles* now so iter-7 biomes reuse them via palette swap. Roles: wall interior / wall corner NE+NW / wall side L+R / floor primary / floor alt-1 (hairline crack) / floor alt-2 (small puddle) / floor alt-3 (bone fragment) / stairs down+up / door closed+open / chest closed+open. Working picks favour row 0-1 for walls, row 6-7 for floors, row 4 for stairs, rows 3 + 11 for doors/chests.
- **Alt-floor scatter pattern** — deterministic per-tile hash `(x*73 + y*149) % 256`. Map: 0-223 → primary (87.5% / 7-in-8); 224-239 → alt-1 (6.25%); 240-247 → alt-2 (3.1%); 248-255 → alt-3 (3.1%). Same shape as the town v3 grass-alt scatter — reproducible runs hold.
- **Trap visual treatment** —
  - **Hidden (unrevealed)**: NO visual change. Floor renders as normal floor. The whole point of perception rolls is that you don't see them yet.
  - **Spike (revealed)**: small `+` of metal points overlaid, alpha 0.85, pulse 0.85 → 0.7 over 1200 ms.
  - **Gas (revealed)**: pressure-plate disc inset into floor, sigil-engraved, static.
  - **Alarm (revealed)**: brass plate with faint runic ring, 1px white outline once every 4s in idle (subliminal).
- **Trap reveal animation** — 200 ms scale 1.2 → 1, alpha 0 → 1 (easeOutQuad), fires alongside the existing `!Spotted!` floating text. The scale-down is the cue ("locking in"). Currently the plan tweens the floating text only; tween the trap sprite too.
- **Iter-7 biome differentiation = palette swap on the same role table.** Sunken Mines: desat blue + ore-green + water tile alpha 0.7 ripple anim. Catacombs: bone white + deep purple + bone debris ×4 + sarcophagi as fixtures. Glass Halls: black + cyan rim + mirror tiles reflecting adjacent floor at 0.4 alpha. Authoring effort per biome ≈ ½ day if iter-3's role table lands cleanly. **The role table is the contract.**
- **Minimap polish pass.** The MVP shipped iter-2 stage 12 used the rect colours. Now that real tiles exist, the minimap pixel colour samples from the actual tile palette so each biome's minimap looks distinctly biome-coloured (caves grey, mines desat-blue, catacombs bone-white, glass-halls black-cyan). Door / stairs / chest get their own glyphs. **No new minimap features** — just colour fidelity and biome-awareness on the existing widget.

**Stage 4 — Action Wheel + verb resolver** (2–3 days)
The current `u`/`d`/`s`/`q` verb-key stack works for desktop but won't survive iter 4's spell/throw/equip additions, and a phone has none of the keys. Replace with a **contextual radial Action Wheel** as the discoverability layer, with keyboard bindings as a peer (not subordinate) layer.

- **Verb resolver** lifted out of `UseEffects.ts` into a generic `actions/Resolver.ts` that takes a target (self / floor tile / enemy / item-on-floor / item-in-bag / stairs / trap) and returns the valid verbs for that target. Single source of truth.
- **Action Wheel component** — Phaser radial menu, ≥48 px slots, sized for thumbs. Slots auto-populated from the resolver. Renders above all other UI, anchored to the target with off-screen clamping.
- **Gesture layer**:
  - Long-press on a tile / item / self → open wheel for that target.
  - Tap a wheel slot → fire the verb.
  - Tap-out → dismiss without firing.
  - Desktop: right-click also opens the wheel.
- **Keyboard remains a peer.** Direct keys (`q` search, `g` get, `u` use, `d` drop, etc.) fire the same resolver — they're shortcut paths, not subordinate to the wheel. Both projections of the same verb set.
- **Removes** the wait/search dual-purpose-button conflict from iter 2 stage 8 — Wait and Search become two adjacent slots on the self-target wheel.

> **Estimate revisited.** Designer asked ½ day; engineering says 2–3 days. The radial menu is a new component (Phaser has no primitive), the gesture layer needs to coexist with the existing click-to-path without misfires, and the resolver lift is non-trivial. Worth doing right because every iter-4+ verb hangs off this.

**Locked-in spec from refinement-002 §K:**

- **6 fixed clock-face slots, always 6** even if only 3 populated — empty slots are dimmed (alpha 0.3, no glyph). Spatial memory: muscle-memory says "Use is at 12 o'clock for items in bag," always. Keyboard `1`-`6` always maps to clock-face slots regardless of what's populated.
- **Slot size 56 px** (slightly above the 48px touch floor — the wheel is a *moment*, not chrome). Centre dead-zone 32 px. Total diameter ~180 px — fits a 5-inch landscape phone, clamps fine portrait.
- **Anchor rules**:
  - Long-press / right-click on target → wheel anchors at target sprite's centre with 12 px upward bias (target stays visible below the wheel)
  - Space / Action button (self) → bottom-right HUD corner, growing inward (natural thumb position)
  - Direct verb key (`u`, `q`, etc.) → **wheel does NOT appear**; resolver fires immediately. Wheel is the discovery surface only.
- **Off-screen target handling** — clamp wheel to viewport with 16 px margin, draw a 2 px line from wheel centre back to target sprite (anchor leader). Don't rotate the radial — slot order stays canonical.
- **The 12-o'clock slot is always the primary action for the target type** — players learn "long-press, top button = the obvious thing".
- **Per-target verb tables** (resolver dispatches):

  | Target | Slot 12 | Slot 2 | Slot 4 | Slot 6 | Slot 8 | Slot 10 |
  |---|---|---|---|---|---|---|
  | Self | Wait | Search | Inventory | Character | (empty) | (empty) |
  | Floor tile | Walk-to | Search | Examine | (empty) | (empty) | (empty) |
  | Enemy | Attack | Examine | (empty) | (empty) | (empty) | Cast (iter 4) |
  | Item on floor | Pick up | Examine | Step over | (empty) | (empty) | (empty) |
  | Item in bag | Use | Drop | Examine | (empty) | (empty) | (empty) |
  | Stairs | Descend | Climb | Examine | (empty) | (empty) | (empty) |
  | Trap (revealed) | Step over | Disarm (iter 4) | Examine | (empty) | (empty) | (empty) |

- **Slot icon language** — verb glyphs: Use (target-aware uses item icon), Drop (down-arrow into pouch), Examine (magnifier), Search (magnifier + sparkle), Wait (hourglass), Cast (open palm + spark), Pick up (up-arrow into pouch), Attack (sword), Walk-to (footprints), Descend/Climb (stair glyph), Step over (tiptoe), Disarm (wrench).
- **Empty-state** — if resolver returns zero verbs (rare; typically only walls): wheel doesn't open. Small `−` indicator pulses once at the target for 200 ms. Better than opening an empty wheel.
- **Dismiss — three peers**: tap-out (touch), `Esc` (keyboard), re-press the trigger (cancel). No "X" close button — the wheel is light, doesn't earn chrome.
- **Touch + mouse + keyboard parity in one component**:

  | Input | Open | Pick slot | Dismiss |
  |---|---|---|---|
  | Touch | long-press 350 ms | tap slot | tap-out |
  | Mouse | right-click | click slot | click-out |
  | Keyboard | Space (self) or Tab to target | 1-6 | Esc |

- **Animation** — open: 120 ms scale 0.8 → 1, alpha 0 → 1, easeOutBack (slight overshoot, settles). Close: 80 ms scale 1 → 0.9, alpha 1 → 0, easeInQuad (faster than open).
- **Architectural rule** — the resolver is the prize, not the wheel. **Do not** let the wheel logic encode "what's a valid verb for an item." That belongs in `actions/Resolver.ts`. The wheel is dumb; it asks the resolver and renders the answer. This is what makes adding the iter-4 Cast verb a one-line resolver change, not a hunt through the wheel component.

**Stage 5 — Found Founders system + Examine bottom-sheet + identification visual language** (2–3 days) — see below.

#### The Found Founders system
Specialists are NPCs you rescue from specific dungeon floors. Once rescued, they appear permanently in town and offer services that you upgrade with meta-resources.

| Specialist     | Found on                | Service                                            | Upgrades use         |
|----------------|-------------------------|----------------------------------------------------|----------------------|
| Apothecary     | Floor 3 (boss room)     | Sells potions; potency upgrades; identification    | Herbal Regimen       |
| Blacksmith     | Floor 6 (locked cell)   | Repairs gear; starting-gear upgrades; weapon +X    | Scrap Metal          |
| Runemaster     | Floor 10 (secret room)  | Rune sockets on weapons; rune crafting             | Ancient Shards       |
| *(more later)* | —                       | —                                                  | —                    |

#### Legacy Fragments — tiered meta-resources
- **Common** (Iron, Cloth) — basic shop construction, level-1 upgrades
- **Rare** (Gemstones, Tomes) — functional upgrades (e.g. "Apothecary now sells Identify scrolls")
- **Boss Drops** (Soul Remnants) — gate new classes and high-tier magic schools

#### Town upgrade tree
Each shop has 3–5 levels. Upgrades change what spawns in the dungeon, what you start with, or what services exist between runs. Spec'd in data, not code.

#### Identification as a visual language (lands with Founders)
Iter-2 ships 8 items with text-only identification labels ("Cloudy Potion", "Scroll of KIR"). The Apothecary unlocks the next tier of items (12-20+), at which point text-only labels stop scaling. Per the design memo, every unidentified item gains **four visual fields**:

1. **Form** — bottle shape, scroll seal, rune outline. Tied to category. Identifies *type*.
2. **Hue** — fixed palette (Cloudy / Amber / Jade / Rust / Ivory / Indigo / Ash). Identifies *this run's instance*.
3. **Sigil** — small mark stamped on the item. Same shuffle as the hue, redundant for colourblind safety.
4. **Name** — the existing colour-or-syllable label. Used in log lines + screen-reader output.

`Identification.ts` is extended to produce `{labels, identified, form, hue, sigilFrame}` from the seeded shuffle; the inventory renderer reads all four. Pre-empts the iter-2 "Scroll of KIR" illegibility complaint *before* the item pool grows past 8.

#### Examine bottom-sheet (lands with Founders)
A generic bottom-sheet info panel for any examinable target — items, NPCs, traps, enemies, tiles. Triggered by the Examine verb on the Action Wheel (iter-3 stage 4) or by long-press on touch. Two consumers in iter 3:
- Item examine — slot in inventory, item on floor, item in shop
- NPC examine — Founder dialogue, shop preview, town gossip

One generic component (`ui/ExamineSheet.ts`) parameterised by content. Slides up from the bottom edge, dismissable by tap-out / ESC. Solves the "where do tooltips live" question raised in the brief without requiring a separate tooltip system.

**Locked-content teaser format** (per refinement-002 §L) — the Examine sheet for a locked target shows: a `???` heading, a ~15-word flavour teaser ("Something tall. Something quiet. Stones older than the town."), and a single field "Locked: Renown V". The teaser is *flavour, not info* — never spoils the unlock. The lock condition is the only useful field.

#### Generic interior layout pattern (lands with Founders)
Per refinement-002 §D — author once as a Tiled template; each building is the template with a palette swap. **10×8 grid**, exit tile north-centre (cols 4-5, row 0), NPC stand position south-centre (col 4, row 6), shop counter east-side (cols 6-7, rows 4-5), decoration density target ~30% of non-wall non-fixture tiles (higher = cluttered, lower = empty stage; 30% reads as "lived in"). Exit is north because the player arrived from the south (exterior door faces south); walking north out of the shop is the natural reverse.

Per-building theming differs only in palette + decoration set, never layout:

| Building | Wall | Floor | Counter | Decoration set |
|---|---|---|---|---|
| Apothecary | plaster (warm cream) | wood plank | wood, herbs piled | cauldron · hanging herbs · bottle shelves · mortar+pestle · drying rack |
| Blacksmith | rough stone (cool grey) | flagstone | wood, soot-stained | anvil (2×1) · forge (2×2 — counter IS the forge) · water barrel · weapon racks · coal pile |
| Inn | wood plank | wood plank, alt = rug tile | bar (wood + tankards) | tables (2×2) ×2 · benches · hearth (2×1, lit) · barrels · candle on each table |
| Shrine | stone block (light) | polished stone | stone altar (replaces counter) | brazier (lit cyan) · kneeler benches · rune circle overlays · scroll racks |

Shrine exception: counter IS the altar (not wood). Decoration budget drops to ~15% — sparseness *is* the theme. Adding the iter-7 Wizard's Tower interior = copy the template, swap the palette, ship. The interior is content, not engineering — that's the prize.

#### Death summary expanded → Ledger (already shipped iter-2 stage 12)
The four-card Ledger lands in iter-2 closeout. Iter 3 extends it with the new "what's new" entries that the Founders system enables:
- "Apothecary rescued — open in town"
- "Apothecary L2 — Frost Potions now drop"
- "New rune type discovered: Soul Rune"

#### What the shops actually sell

Founders aren't just metaprogression flavour — each shop unlocks a new content **category** that the dungeon then starts seeding. The shop is the gate; the dungeon is the playground.

**Apothecary — the Expanded Manifest**

Iter 2 ships 3 potions (Healing, Fortitude, Poison) + 3 scrolls (Mapping, Blinking, Identification). The Apothecary's shop levels gate *additional* potion / scroll variety into the world drop pool:

- Level 1: **Invisibility** (drop aggro for N turns) and **Recharging** (refill wand charges, future-proofing for iter-4 magic).
- Level 2: **Rage** (+damage, -armor), **Frost** (slows enemy movement), **Summoning** (friendly distraction NPC for 10 turns).
- Level 3: **Fear** (enemies flee), **Returning Rune** (instant exit to town), **Shielding Rune** (temporary HP shield).

Each unlock activates *passive* drops in the dungeon, not just a shop SKU.

**Blacksmith — Trait-Based Equipment ("the Armory")**

Iter 2 keeps weapons / armor as flat ±X modifiers. The Blacksmith's arrival shifts the model from "+X stick" to **trait weapons + dodge/reduction armor**:

- **Weapon traits** (the trait *is* the play pattern, not a stat):
  - **Shortsword** — standard 1-tile bump (default behaviour)
  - **Spear** — strikes 2 tiles away in a straight line; can't hit diagonals
  - **Great-axe** — hits 3 frontal tiles in an arc, but has a 1-turn wind-up the player commits to (telegraphed)
- **Armor traits**:
  - **Leather** — 15% chance to negate a hit entirely (dodge)
  - **Plate** — high damage reduction, but increases hunger drain by 20% (encumbrance)

Combat math grows from "subtract" into "what's my pattern" — sets up iter-4 class differentiation (Brigand prefers leather, Ironclad prefers plate).

**Runemaster — Rune Sockets**

Found weapons gain 1–3 rune sockets. Runes (already 1 in the iter-2 manifest, expanded by Apothecary level 3) slot into sockets to grant on-hit / passive effects: Fire Rune adds Burn DoT; Frost Rune slows; Soul Rune grants Embers per kill. Sockets are forged by the Runemaster once rescued.

---

### Iteration 3.5 — Visible dice rolls (polish stage, ~½ day)
**Goal:** make seeded RNG *visible* and *honest*. The seeded-RNG ethos already says "the dice are fair" — let the player actually see them land.

**Scope:**
- 2D Kenney-style sprite dice (d6 + d20). Two atlas sheets, a few frames each. No 3D physics.
- ≤250 ms tween — bounce in, snap to result, fade out. Animation is purely *decorative* — the roll resolves instantly in the data layer; the dice celebrate the outcome that already happened. No combat logic ever waits on a tween.
- **Where they appear:** small floating cluster above the actor performing the roll, OR a fixed "dice tray" widget bottom-right. Decide by playtest.
- **When they appear (default):**
  - Player bump-attack — d20 roll for hit, d6/d8 for damage.
  - Search action that *successfully reveals* a trap (failed searches stay silent).
  - Iter-3+ critical hits / dodges (the moment that benefits most).
  - Loot chest opens (iter-5).
- **When they NEVER appear:** auto-path steps, hunger ticks, status DoT ticks, AI sight checks. Anything that fires multiple times per second would turn the dice into noise.
- **Settings toggle** (cross-cutting): `Show dice rolls: Off / Important moments / All rolls`. Default = Important. Accessibility (motion sensitivity), perf, and preference all served.
- **Why not earlier:** iter 2 combat is `power - armor` with no roll inflection — there's nothing interesting to *see* land. Once iter 3 brings crits + dodges + weapon trait procs, the visible dice become legibility, not decoration.

> Sequencing: lands after iter 3 ships and before iter 4 unlocks classes. If the iter-3 combat overhaul reveals the timing or visual language is wrong, the dice work is small enough to iterate on or punt entirely.

---

### Iteration 4 — Classes & magic & per-run Goals
**Goal:** runs feel different from each other. Build variety arrives.

- **Threshold Goals + Feats.** The Threshold screen (shipped iter-2 stage 12 as a one-screen world card) gains an optional Goal layer here, since Goals + Feats are the same shape — a list of objectives, scoring, reward modifiers, persistence of best results. Goals are short ("Reach floor 5", "Find the Apothecary", "Identify five items"); picking one bumps the Embers reward. Skipping is fine. Feats are long-lived ("Reach floor 5 without a melee weapon → unlock Mage"). Both consumed by the same `objectives/` data model; the UI surfaces them in the Threshold and the Ledger.
- **Town-only Feats** (per refinement-002 coda #3) — a deliberate sub-class of Feats that complete *without descending*: befriend an NPC across N visits; attend a festival (iter-7); chat with every Founder in a single town visit; read every Town Board entry. The point: when the town becomes residence-scale at Renown VII+ (NPCs walking around, festivals firing), the player should sometimes *return to town and not descend*. Town has to support being a destination, not just a hub. Token budget: 4-6 town-only Feats land here, paving the way for iter-7's "town as destination" promise.
- **Class blueprint system.** Iter 2's Wayfarer is the default; iter-4 unlocks three branching builds. Each is *data + a few overrides* on the same `Player` shape:
  - **Brigand** — high crit on full-HP enemies; starts with 2× Blinking Scroll. Plays around alpha strikes and disengages. Pairs with Leather armor.
  - **Acolyte** — cooldown-based "Mending" heal; higher perception (traps revealed sooner). Light combat, supports party / herself with status uptime.
  - **Ironclad** — starts with the Fortitude status active; cannot wear Leather. Plays around tanking through encounters. Pairs with Plate armor.
- **Charges system instead of mana.** A wand has *N* charges, regenerates 1 every *M* turns. Forces tactical conservation.
- **Spell library v1.** 4–6 spells across schools (Fire, Frost, Arcane, Shadow). Each is a data definition: range, AoE shape, damage formula, status effect.
- **Class unlocks via Feats.** Examples: "Reach floor 5 without a melee weapon" → unlock Mage. "Kill 100 enemies with daggers" → unlock Rogue.
- **Spell unlock tree** (per the design doc):
  - L0: doesn't drop in dungeon
  - L1: can spawn in chests (purchase in town)
  - L2: choose as a starting scroll
  - L3: passive bonus (e.g. ignore 20% magic resist)

---

### Iteration 5 — Content depth
**Goal:** runs are long, varied, and bossable.

- 10+ enemy archetypes with distinct behaviors (ranged, summoner, charger, healer, swarm).
- Floor biomes (caves vs crypts vs ruins) using different tile palettes.
- Bosses every 3–5 floors. Each boss drops a Soul Remnant and unlocks something specific.
- Equipment runes & sockets — fully implemented per design doc.
- Encumbrance / weight system.
- Item rarity tiers and affixes.
- Procedural item naming for unidentified items.

---

### Iteration 6 — Mobile / PWA port
**Goal:** Tallowmark plays well on a phone.

- PWA manifest + service worker (offline play).
- Touch input layer:
  - Single-tap adjacent tile → step. Single-tap distant tile → path to it.
  - Single-tap enemy → bump-attack one step.
  - Long-press → Action Wheel (already shipped iter-3 stage 4).
  - Contextual action button docked bottom-right.
- Responsive UI scale.
- Optional Capacitor wrapper for app stores once the web version is solid.

---

### Iteration 7 — World expansion
**Goal:** Tallowmark stops being *"a town and a dungeon"* and becomes *"a world worth exploring"*. The metaprogression spine grows to support the long arc the design vision promises.

#### Town Renown — the meta-progression spine
The town has a numeric **Renown** level (0–10) driven by total Embers earned, Founders rescued, dungeons completed, and Feats unlocked. Each Renown tier unlocks something *visible in town*. Renown is not a stat to optimise — it's the diegetic counter that tracks player investment. Tiers carry **diegetic names** (Stranger / Familiar / Welcome / Trusted / Counted / Notable / Esteemed / Storied / Renowned / Legend / Mythwalker), not just numbers — players should think "I'm Counted" not "I'm Renown 4". Roman numerals everywhere the tier is surfaced (see "Renown surfacing" below).

| Renown | Tier name | Unlocks (in addition to all prior) |
|---|---|---|
| 0 | *Stranger* | The 4 starting buildings + main dungeon entrance (current iter-3 baseline) |
| I | *Familiar* | First wandering NPC visits town periodically |
| II | *Welcome* | **Walled garden** behind the Inn opens — quest-NPC stand position, ambient |
| III | *Trusted* | **Second dungeon entrance** appears on the town map — the Sunken Mines |
| IV | *Counted* | **Catacombs** under the cemetery unlock — third dungeon, undead-themed |
| V | *Notable* | **Wizard's Tower** opens in the corner (visible as silhouette through dense fog from day 1) — new building, new Founder slot |
| VI | *Esteemed* | Day/night cycle activates; certain NPCs only present in certain phases |
| VII | *Storied* | **A second settlement** appears on a world map (zoomed-out view) |
| VIII | *Renowned* | Festival system unlocks — periodic events change loot pool / shop prices |
| IX | *Legend* | **The Glass Halls** — fourth dungeon, illusion enemies, mirror puzzles |
| X | *Mythwalker* | Endgame area unlocks |

#### Multiple dungeons
Each new dungeon entrance is a distinct biome / item pool / enemy mix / Founder. They share the same tile-engine and run-loop, but feel like different games on the inside.

| Dungeon | Theme | Founder | Key item type | Notes |
|---|---|---|---|---|
| The Caves (default) | Organic stone | Apothecary / Blacksmith / Runemaster (iter 3) | Standard manifest | Iter-3 baseline |
| The Sunken Mines | Water hazards, ore veins | Engineer (gear sockets, traps) | Gold / pickaxes | Renown 3 |
| The Catacombs | Crypts, undead | Necromancer (bone armor, raise) | Bone / consecrated water | Renown 4 |
| The Glass Halls | Mirrors, illusions | Seer (foresight, scrying) | Glass shards / mirrors | Renown 9 |

Each has its own seed family — a "Sunken Mines run" is meaningfully distinct from a "Caves run" and has its own depth track.

#### Renown surfacing — three layers (per refinement-002 §M)
The constraint: readable to a returning player after 30 days, invisible-but-felt to a new player mid-run. A HUD bar reads to both the same way; rules it out. Layered surface where each layer answers a different question:

1. **The Town Status strip — at-a-glance reminder.** Single line at the top of TownScene shows current state. Add Renown as a small **Roman numeral** after the day count: `TALLOWMARK · DAY 14 · IV · 2 SHOPS OPEN · 47 EMBERS · NEW: Apothecary L2 — Frost Potions now drop`. Roman is invisible to a new player (looks date-ish), instantly readable to a returning one ("oh, IV — I was at III last time"). One character of HUD, two reads. Roman because it gives the town a *stately* feel — Tallowmark has Renown the way a city has a charter.
2. **The Town Board — canonical check surface.** A physical bulletin board near the town centre (placed in the centre zone reserved iter-3). Tapping opens a parchment-style overlay with three panes: current Renown tier (name + numeral + paragraph of flavour), the next tier and what it unlocks, and the top 3 outstanding things you could do next (Founders to rescue, dungeons to beat, Feats close to completion). The Board is the *deliberate* way to check Renown — returning players go here first to remind themselves where they were.
3. **Diegetic acknowledgement — the felt layer.** Things that change as Renown grows without any UI saying so:
   - **NPC greetings shift.** Renown 0: "Hm." Renown IV: "Welcome back, friend." Renown VIII: "Mythwalker. Tea?" Same NPC, drifting tone. Players notice the *room got warmer*, not the line change.
   - **Sky / lighting drift.** Renown 0-III neutral daylight; IV-VI late-afternoon golden tint (alpha 0.08 amber overlay on town only — keep dungeons untinted); VII+ banners flap, distant church bells once on town entry.
   - **Ambient NPC count.** 0 wandering NPCs at Renown 0. +1 per tier from I. By VII the town has 7 wandering NPCs and the place feels alive.
   - **Mist dissipation animation on unlock.** As Renown rises and unlocks happen, the §L mist on those tiles dissipates *visibly* on the next town entry — 1.5 sec, mist drifts off-screen. **The dissipation animation is THE moment** the player feels the unlock land.

**Don't slap a Renown bar on the HUD.** The whole town is the bar.

#### Town as destination, not just hub (per refinement-002 coda #3)
At Renown VII+ the town becomes residence-scale: festivals, day/night, NPC schedules. The Threshold/Ledger pair (iter-2 stage 12) was framed around "a run begins, a run ends." That's still true — but at Renown VII+ the player might **return to town and not descend**. They might come back to attend a festival, talk to an NPC, check the Town Board, leave again *without a run*.

**Practical implications, all enforceable as iter-7 acceptance criteria:**
- The dungeon arch is NOT the only meaningful interaction in town. The Town Board, Founder dialogue, festival booths, walled garden quest-NPC, all exist as standalone destinations.
- Town-only Feats (delivered iter-4) give "I came to town and didn't descend" objective texture.
- The Threshold screen is dismissable without committing to a run — pressing Esc returns to town, and "leave town without descending" is a valid end-of-session state, not a soft fail.

**Don't ship iter-7 with a town that punishes you for not descending.**

#### Secret areas in town
Hidden content gated behind:
- **Locked doors** that open after specific Feats (the Apothecary's storeroom, after Identify-100-items)
- **Bricked-up walls** broken by item interactions (the Apothecary's "Salt of Dissolution" reveals a passage)
- **Time-of-day gates** (a door that only opens at night, once the Renown-6 day/night cycle is live)
- **NPC-trust gates** (a back room only opens after befriending an NPC across runs)

Visual language for locked content is the **mist + boarding** primary spec from iter-3 stage 2 (per refinement-002 §L). Density scales with how distant the unlock is — day-1 secret door = thin mist; day-1 Wizard's Tower = thick fog with barely-readable silhouette.

#### Festivals + events (Renown 8+)
Periodic in-game events change the town for a window:
- **Market Day** — shop prices reduced, special wares.
- **Founders' Festival** — extra dialogue, free L1 upgrades.
- **Eclipse** — the Catacombs activate special enemies for one run.

#### World map (Renown VII+)
Once the second settlement appears, a zoomed-out world-map view shows Tallowmark + the second settlement + dungeon entrances + travel routes. Quest objectives reference world-map locations. The world map is a Phaser scene; clicking a location enters it.

**The minimap widget IS the world-map widget** — same 120×80 corner element, same `m` toggle. When player is on TownScene the minimap shows town tiles + locked-area silhouettes (mist-fogged at the appropriate density per §L). When player descends, it switches to dungeon view. When the world-map scene unlocks at Renown VII, `m` from town shows the world map; `m` from a dungeon shows the dungeon minimap; `m` from the world-map scene shows the local town/dungeon for context. Single widget, three contexts, consistent muscle memory.

> **Why iter 7, not earlier:** Multiple dungeons require iter-5's biome system to be mature. Secret areas require iter-3 Founders + iter-4 Feats to be live so there's something to gate on. The Renown spine is itself the metaprogression skeleton — building it before the metaprogression *content* exists would be content-less scaffolding. **The iter-3 town authoring pattern (Tiled multi-tier exteriors, generic interior layout) was deliberately picked to support this expansion: adding a new building or new dungeon entrance to the town is a Tiled edit + a new scene file, not a TownScene rewrite.**

---

## Cross-cutting threads

These run alongside the iterations rather than slotting into one of them:

- **Audio.** Placeholder silent files in v1; user supplies real music & SFX over time. AudioManager has master / music / SFX buses from day one.
- **Balance.** Once iteration 4 lands, we start a balance pass. Track damage curves, run length, death causes via in-memory telemetry; emit to console in dev.
- **Town visual growth.** As the town levels up, its appearance changes — more NPCs walking around, lit windows at night, banners, etc. Iterative.
- **Accessibility.** Colorblind-safe palette options; remappable keys; reduced-motion mode (already trivial because we're turn-based).
- **CI & quality.** Lint + typecheck + unit + E2E gate every PR. Coverage target 70% for `core/`, no target for scenes.

### Tooling — level editor & frame inspector

Hand-authored maps need a way to be edited *as you play* — typing tile coordinates by hand is the wrong workflow. The roadmap here is intentionally lightweight; we keep tooling proportional to need.

- **v1 (already shipped):** `DebugSheetScene` (F9 in dev) lets you visually pick a frame from any loaded spritesheet. Maps directly into the constants in `src/world/FrameCatalog.ts`.
- **v2 — In-game dev paint mode (target: alongside iteration 2):** small toggleable mode in `TownScene` (and any future hand-authored scene) that lets you:
  - Hover a tile to see its current frame index.
  - Pick a tile from a palette overlay (driven by FrameCatalog).
  - Click-and-drag to paint that frame onto the map.
  - Save to a JSON map file (`public/maps/town.json`); the scene loads from that JSON at runtime.
  - Dev-only: gated by `import.meta.env.DEV` so it never reaches production builds.
  - Single terrain layer; no NPCs, no objects. This is intentionally minimum-viable — the win is not writing a great editor, it's killing the "edit FrameCatalog → reload → eyeball" cycle.
- **v3 — Switch to [Tiled](https://www.mapeditor.org/) (early iteration 3 — soon):** the in-game painter is intentionally *minimum-viable*. It exists to unblock iteration-2 town iteration, not to grow into a real editor. As soon as iteration 3 starts — *the very first stage* — we switch to Tiled. Trigger: hand-authored dungeon room templates and NPC placement, both of which need features the in-house painter shouldn't grow.
  - **Why Tiled gives us:**
    - Multi-layer maps (terrain / decoration / collision / object layers).
    - Object layers — drop NPCs / doors / triggers with custom properties (dialogue, item id, faction) per object.
    - **Auto-tiling** — paint a wall and Tiled picks the right corner / edge / interior frame automatically. Solves the wall-frame guessing problem permanently.
    - Tile properties (walkable, opaque, damage) defined once on the tileset, not in code.
    - Phaser 3 has first-party support: `this.load.tilemapTiledJSON()` + `this.add.tilemap()`. Migration is a swap, not a rewrite — the runtime loader already speaks the Tiled JSON format we emit.
  - **Cost of moving:** contributors install the Tiled desktop app (~30 MB, free, mac/win/linux), and we re-describe each Kenney sheet once as a tileset (`.tsx` file). The town and dungeon move from `add.image()` per tile to a tilemap layer.
  - **What retires:** the rpg-pack section of `FrameCatalog` mostly goes — Tiled stores frame indices internally; you reference tiles by layer + position. `CharsSheet` (sprites for player / enemies / NPCs) stays since those are GameObjects, not tilemap tiles.

The plan is *not* "build an in-game painter, then build it bigger, then build it bigger." The in-house painter is intentionally bounded — single-purpose dev tool to unblock the current town iteration. Iteration 3, stage 1: switch to Tiled.

---

## Open questions (parked)

- **Permadeath philosophy.** Pure permadeath, or "lose your inventory, keep your XP" softer model? Default: pure permadeath; metaprogression is the soft layer.
- **Cloud saves.** Vercel + Supabase mentioned for the future. No timeline yet.
- **Multiplayer / async features.** Daily seeds, leaderboards, ghost runs. Post-v6 at earliest.
- **Modding / data editing.** Likely yes once content systems mature, but not a v1 concern.
- **Monetization / release model.** Undecided.

---

## How to update this doc

When a decision is made, change the doc. When an iteration ships, mark its section "✅ Shipped" and link to the relevant commit/tag. When a parked question gets answered, move it out of "Open questions" into the iteration where it lands.
