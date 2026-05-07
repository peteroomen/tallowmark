# Tiled workflow

> Iter-3 stage 1 substrate. The in-house painter (`src/editor/`) stays as a
> dev-only fallback during iter-3; stage 2 retires it once the full town is
> Tiled-authored.

## Install Tiled

[Tiled](https://www.mapeditor.org/) — free, MIT, mac/win/linux. ~30 MB.

```bash
# macOS
brew install --cask tiled

# Linux
sudo apt install tiled        # or: sudo dnf install tiled

# Windows: download installer from mapeditor.org
```

We track Tiled v1.10+ for the JSON format we ship.

## Repo layout

```
public/assets/maps/
├── rpg.tsj         tileset descriptor for kenney_rougelike-rpg-pack
├── caves.tsj       tileset for kenney_roguelike-caves-dungeons (added iter-3 stage 3)
├── town.tmj        the town map (this file is what Tiled edits)
└── ...
```

`.tsj` = Tiled tileset (JSON). `.tmj` = Tiled map (JSON). Both are
plain text — diff-friendly, editor-agnostic.

## Editing the town

```bash
tiled public/assets/maps/town.tmj
```

The town opens with its tileset ready. Painting is left-click; tile picking
is right-click on the tileset panel. Save with `Cmd+S` / `Ctrl+S` — Phaser
hot-reloads on next page refresh (Vite watches `public/`).

## Layer conventions for `town.tmj`

Per refinement-002 §N — the renderer assumes these layer names exist (one
or more may be empty):

| Layer | Type | Purpose |
|---|---|---|
| `terrain` | tile | Base ground — grass, paths, water |
| `terrain_alt` | tile | Alt-floor scatter (deterministic per seed) |
| `decoration_low` | tile | Bushes, small rocks — beneath actors |
| `building_exterior_T0` | tile | Locked variant per building (iter-3 stage 2) |
| `building_exterior_T1` | tile | Founded variant |
| `building_exterior_T2` | tile | Practiced variant |
| `decoration_high` | tile | Tall trees — above actors with alpha when passing behind |
| `mist_locked` | object | Fog overlays for locked content |
| `objects` | object | NPCs, doors, triggers, signs |
| `collision` | tile | Explicit walkable mask for ambiguous tiles |

The minimum a `.tmj` needs for the engine to load it is a `terrain` layer.
Iter-3 stage 1 ships exactly that; stage 2 fills in the rest.

## Object naming grammar

Per refinement-002 §N — Tiled object names are parsed as `kind:id[:modifier]`
and dispatched by `kind`:

```
door:apothecary_main
door:secret_passage:feat_identify_100
npc:wandering_merchant:renown_3
trigger:dungeon_arch_1:none
trigger:dungeon_arch_2:renown_3
trigger:world_map_portal:renown_7
spawn:player_default
decoration:fountain
```

Adding a new kind in iter-7 = add one parser branch + one renderer branch.
Don't hardcode building IDs in `TownScene`.

## Tile global IDs (gids)

A Tiled `.tmj` layer's `data` array holds tile **global IDs**:

- `0` = empty (no tile)
- `firstgid + localId` = the tile

For our `rpg.tsj` (firstgid 1):
- Frame 0 in the rpg-pack → gid `1`
- Frame 5 (grass) → gid `6`
- Frame 7 (dirt) → gid `8`

Cheat sheet: **gid = `FrameCatalog.TilesRPG.<thing>` + 1**.

## Adding a new tileset

1. Drop the `.png` in `public/assets/sprites/`
2. Create a sibling `.tsj` describing the sheet:

   ```json
   {
     "columns": <colcount>,
     "image": "../sprites/<file>.png",
     "imageheight": <H>,
     "imagewidth": <W>,
     "margin": 0,
     "name": "<short-name>",
     "spacing": 1,
     "tilecount": <cols * rows>,
     "tileheight": 16,
     "tilewidth": 16,
     "type": "tileset",
     "version": "1.10"
   }
   ```

3. In Tiled: `Map → Add External Tileset…` → pick the `.tsj`. Tiled
   assigns the next `firstgid`.
4. In code: `map.addTilesetImage('<short-name>', ASSET_KEYS.sprites.<key>)`.

## What the engine does on load

1. `BootScene` calls `this.load.tilemapTiledJSON(key, path)`. Phaser
   fetches the `.tmj` AND any external `.tsj` it references.
2. `TownScene` checks `this.cache.tilemap.exists(key)`.
3. If present: `this.make.tilemap({ key })` + `addTilesetImage` +
   `createLayer` per layer. Each layer becomes a Phaser `TilemapLayer`,
   which uses the engine's optimised batch renderer (much faster than the
   in-house `add.image` per tile).
4. If absent (file missing or load failed): falls through to the in-house
   renderer. Lets the dev painter keep working during the migration.

## Migration status

- ✅ Iter-3 stage 1 — substrate: loader + tileset + minimal `town.tmj` (grass + road).
- ⏳ Iter-3 stage 2 — full town authored in Tiled with 3-tier exteriors + interiors.
- ⏳ Iter-3 stage 3 — dungeon authored in Tiled with caves-dungeons tileset.
- 🪦 In-house painter retires once stage 2 ships.
