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

### Iteration 2 — Roguelike depth
**Goal:** the dungeon starts to feel like a *roguelike*, not a tile demo.

- **Fog of war / FOV** (rot.js precise shadowcasting). Memory of explored-but-unseen tiles.
- **Hunger clock** ticks each turn; starvation deals damage; food items.
- **Item identification** — per-run shuffled labels for potions and scrolls. Initial library: 3 potions, 3 scrolls.
- **Traps** — hidden tiles, Perception stat, status effects on trigger.
- **Status effects framework** — poison, paralysis, regen, etc.
- **A second enemy archetype** (e.g. Skeleton Archer) to make line-of-sight matter.
- **Stairs down** working — multi-floor descent, increasing difficulty curve.

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

---

### Iteration 4 — Classes & magic
**Goal:** runs feel different from each other. Build variety arrives.

- **Class blueprint system.** `BasePlayer` → `Warrior`, `Mage`, `Rogue` subclasses (component-based; classes are *data + a few overrides*).
  - Warrior: melee starter kit, higher HP, lower mana.
  - Mage: starts with a wand, lower HP, charge-based casting.
  - Rogue: stealth, daggers, traps.
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
