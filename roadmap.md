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

**Stage 10 — Multi-Floor Descent** (½ day)
- Stairs-down increments `runState.floor`, regenerates the dungeon with `seed + floor`, **keeps** player state (HP, inventory, statuses, embers), **clears** `exploredTiles` (each floor is its own map).
- Per-floor scaling: `enemy.hp = 5 + floor`, `enemy.power = 2 + Math.floor(floor / 3)`, enemy count `min(2 + floor, 8)` (already in place).
- Stairs-up only on floor 1 — climbing exits to town with banked Embers. Deeper floors are descent-only.
- Embers reward scales with deepest floor reached.
- **Bosses deferred** to iter 3+. Floor 10 just shows a "you've reached the deepest known level" wrap screen for now.

**Stage 11 — The Wayfarer** (½ day)
Default starting class. Not a true class system — that's iter 4. This is naming + stats + starting kit so the character sheet shows a coherent identity.
- Class: **Wayfarer** (replaces "Wanderer (placeholder)" in CharacterScene)
- Stats: HP 30 (was 20), Power 5 (was 4), Armor 1 (unchanged), foodMax 200, perception 30%
- Starting kit: 1× Hardtack + 1× random unidentified potion in the inventory at run start
- "Class blueprint" architecture: `entities/classes/Wayfarer.ts` defines stats + starting kit as data; future classes (iter 4: Brigand, Acolyte, Ironclad) slot into the same shape.

**Stage 12 — Iter 2 manual test pass + commit**
Run the full test plan against stages 5-11. Fix P0/P1s. Document iter-2 closeout.

---

**Cross-cutting infra to ship before / during the above:**
- Z-depth hierarchy: tiles 0 / actors 9-10 / hover-marker 60 / fog 50 / floating text 70 / ghost markers 8 / HUD 1000+
- Action-verb model: extend onKey to `u` (use), `d` (drop), `s` (search/wait toggle)
- Character stat aggregation: `Player.effectiveStats()` = base + equipped item bonuses (Equipment class already exists; just needs to be wired)

**Iter 2 estimate (refined):** ~6–7 working days for stages 5-11, plus ½ day Stage 12 closeout.

---

### Iteration 3 — Town growth & Found Founders
**Goal:** the metaprogression loop kicks in. The town stops being a static map.

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

#### Death summary expanded
Currency-by-source breakdown; "what's new" callouts; pending unlocks.

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

### Iteration 4 — Classes & magic
**Goal:** runs feel different from each other. Build variety arrives.

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
  - Single-tap tile → path to it.
  - Single-tap enemy → bump-attack one step.
  - Long-press → examine.
  - Contextual action button (Search / Open / Eat / Pickup) docked bottom-right.
- Responsive UI scale.
- Optional Capacitor wrapper for app stores once the web version is solid.

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
