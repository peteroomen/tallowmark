# CLAUDE.md — Tallowmark project conventions

This file is read by Claude (and other agents) every session. It captures the rules that aren't obvious from the code alone. **Keep it concise.** Anything that can be inferred by reading the source belongs in the source, not here.

## What this project is

Tallowmark is a browser-based 2D **turn-based** roguelite with persistent town metaprogression. See `README.md` for the public summary and `roadmap.md` for the planned scope per iteration.

## Tech stack

- Phaser 3 + TypeScript + Vite
- rot.js for dungeon generation, FOV, A*, seeded RNG
- Vitest (unit) + Playwright (E2E)
- ESLint + Prettier
- GitHub Actions CI: lint, typecheck, unit, E2E

## Commands

```bash
npm run dev          # dev server
npm test             # unit
npm run test:e2e     # E2E
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

Run `npm run lint && npm run typecheck && npm test` before declaring a task done.

## Architectural rules (do not violate without discussion)

1. **Turn-based, not real-time.** The world only ticks when the player acts. All actor logic lives behind `TurnEngine`. Never use Phaser Arcade Physics for actor movement. Tweens are fine for *visual interpolation only* — they must not gate game logic.

2. **Data layer separate from render layer.** The authoritative game state is plain TypeScript (`Grid`, `Entity`, `RunState`, `PersistentState`). Phaser sprites are a render projection of that state. This means the data layer is unit-testable without booting Phaser. Don't read game state off sprite positions; sprites mirror state, not the other way around.

3. **All randomness through the seeded `Rng` service.** Never call `Math.random()` directly. Determinism (given a seed) is required for reproducible bugs, tests, and "share a seed" features. Lint rule enforces this.

4. **Save model split.**
   - `PersistentState` — survives death (meta-currency, NPC unlocks, town upgrades, settings, identified spell pool).
   - `RunState` — wiped on death (current seed, dungeon map, inventory, HP, hunger, per-run item identity mapping).
   - `SaveStore` is the only thing that touches `localStorage`. Schema is versioned; bumping the schema requires a migration.

5. **Touch-friendly from day one, even though v1 is desktop.** UI hit targets ≥ 32px. Avoid hover-only affordances. We're planning a PWA/Capacitor mobile port later — don't paint ourselves into a corner with hover-dependent UX.

6. **8-directional grid movement.** Diagonals cost the same as cardinals (classic roguelike). A* over the 8-neighbour grid.

7. **Bump combat.** Moving into an enemy's tile triggers an attack instead of movement. Damage resolution lives in `CombatSystem`, never inline in the move handler.

## Coding conventions

- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`).
- Prefer plain functions and small classes. No DI framework.
- Prefer `readonly` on fields that don't mutate post-construction.
- Public APIs of `core/` modules get a one-line doc comment explaining intent. Private helpers don't.
- Tests live next to the source as `foo.test.ts` for unit, in `test/e2e/` for Playwright.
- No emoji in code or commit messages.

## Asset conventions

- Source tiles are 16×16 with 1px gutters (Kenney standard). Render scale is 3× → 48px effective.
- Use the `*_transparent.png` sheets, not the magenta-keyed variants.
- Placeholder audio files are silent stubs at `public/assets/audio/`. Real files will be dropped in by the user.

## Where to find things

- High-level vision and iteration plan: `roadmap.md`
- Asset packs: `kenney_*/` (CC0; do not modify in place — copy what we need into `public/assets/`)
- Save key in `localStorage`: `tallowmark:save:v1`

## Things to ask before doing

- Adding a new top-level dependency.
- Changing the save schema (requires a migration).
- Adding a new Phaser scene (it should fit the existing scene model).
- Anything that touches the turn loop ordering.
