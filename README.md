# Tallowmark

A web-based 2D roguelite. Classic turn-based grid combat in the spirit of Rogue and Shattered Pixel Dungeon, with persistent town-building metaprogression in the spirit of Darkest Dungeon.

> **Working title.** "Tallowmark" is the hub town's name and the project codename — easy to rename later.

## What it is

- **Hub:** the town of Tallowmark. Safe zone you return to between runs. Grows as you rescue specialists from the dungeon and spend meta-resources to upgrade their shops.
- **Run:** descend into a procedurally generated dungeon. Turn-based grid movement, bump combat, fog of war, hunger clock, item identification — the classic feel.
- **Death:** wipes the run, banks meta-currency, drops you back in town to upgrade and try again with a new seed.

See [roadmap.md](roadmap.md) for the full vision and what's planned per iteration.

## Tech stack

- [Phaser 3](https://phaser.io/) — game framework
- [TypeScript](https://www.typescriptlang.org/) — typed source
- [Vite](https://vitejs.dev/) — dev server & build
- [rot.js](https://ondras.github.io/rot.js/) — dungeon generation, FOV, A*, seeded RNG
- [Vitest](https://vitest.dev/) — unit tests
- [Playwright](https://playwright.dev/) — end-to-end tests
- ESLint + Prettier — lint & format
- GitHub Actions — CI

## Quickstart

```bash
npm install
npm run dev          # dev server with HMR
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

## Project layout

```
src/                       # game code
  scenes/                  # Phaser scenes (menu, town, dungeon, UI overlays)
  core/                    # turn engine, RNG, grid, pathfinding, FOV, save store
  world/                   # map data, tile types, dungeon generators
  entities/                # player, enemies, AI
  combat/                  # damage resolution
  items/                   # inventory, equipment, identification
  audio/                   # music + SFX manager
  ui/                      # Kenney-themed widgets (buttons, panels, nine-patches)
  state/                   # PersistentState (survives death) vs RunState (wiped)
public/assets/             # game-ready asset copies (linked from kenney_* folders)
test/unit/                 # Vitest specs
test/e2e/                  # Playwright specs
kenney_*/                  # source asset packs (CC0)
```

## Asset attribution

All art is from [Kenney](https://kenney.nl/) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Packs in use:

- `kenney_roguelike-rpg-pack` — overworld + dungeon tiles, items
- `kenney_roguelike-characters` — character sprites
- `kenney_roguelike-indoors` — town interiors
- `kenney_ui-pack-pixel-adventure` — game UI
- `kenney_minimap-pack` — minimap icons
- `kenney_input-prompts-pixel` — control prompts

> A dedicated `kenney_roguelike-caves-dungeons` pack is planned but not currently in-repo. The RPG pack covers dungeon tiles for v1; we can swap when the pack is re-added.

Audio (music + SFX) is placeholder until the user supplies real files.

## License

TBD. Code-only license to be decided before any public release. Asset packs retain their original CC0 license.
