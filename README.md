# Voxel Genesis

Cinematic browser 3D cellular automaton.

Ember and cyan living cells in a dark void. Bloom, fog, age-colored voxels.

Stack: TypeScript + Vite + Three.js (WebGL). Vitest for simulation tests. No backend, no API keys.

## How to run

Use Node.js `^20.19.0` or `>=22.12.0`. Install dependencies, then start the Vite development server (port 5173).
Run the test suite with Vitest. Create a production build, then serve it with Vite preview (port 4173).

Scripts in package.json: `dev`, `build`, `test`, `preview`. All application code is normal TypeScript under `src`; development, tests, and builds use the same source directly.

## Controls

Space play/pause. N step. R reset. G randomize.
M toggles Orbit / Paint mode. P toggle paint plane. Bracket keys move plane. X Y Z set axis.
In Paint mode, hover shows snap-to-grid highlight and crosshair; choose Draw or Erase (Shift temporarily erases). Entering Paint pauses simulation. Orbit mode never edits cells.
Brush size and symmetry (Mirror X/Y/Z / multi-axis) live in the panel.
Camera presets 1–5: Orbit, Hero, Top-down, Close-up, Flyby (smooth lerp; instant if reduced motion).
O auto-orbit. T time trails. Question-mark toggles the side panel.
Share via Copy URL (hash state) or JSON export/import.
Restart restores the initial world of the current experiment, including a random or hand-painted world. Changing the rule or boundary establishes that current world and setting as the new experiment start. Restore defaults returns to the built-in seed and rule. Rule, boundary, resize, seed, random, import, and complete paint strokes can be undone; simulation frames are not recorded. Imports and page-refresh session restores always open paused.

The local Works library stores up to 12 named snapshots with thumbnails and refuses additional saves when full. The last session is restored after refresh (a valid shared URL takes priority). Storage writes are throttled and save failures leave old data intact.

The Watch panel includes three locally rendered featured setups, a 120-step live-cell trend, and three saved color themes. Featured setups open paused and replace the world as one undoable edit. Immersive view hides controls and helpers without changing simulation state; Escape or the visible exit button restores the previous editing view. Save Image exports the WebGL scene without interface or helper overlays.

Mobile: use the Orbit/Paint FAB (and panel toggle). Paint mode disables orbit gestures so touches aim the brush.

First-run hint dismisses via localStorage.
When prefers-reduced-motion is set, bloom, auto-orbit, and camera lerps stay off / instant.

## Rules

Real 26-neighbor Moore CA. Not Conway 2333.
The rule picker describes the real conditions, for example “Birth 4 · Survive 4–5.” Each cell checks up to 26 neighbors, and every cell updates together from the previous step. The built-in rules use `B4/S4-5`, `B5/S5-6`, `B10-12/S9-14`, `B6/S5-7`, `B5/S4-6`, and `B7/S6-8`. An accessible advanced section explains and accepts custom B/S syntax. Boundary modes treat space outside the grid as empty or connect opposite sides.

## Seeds

Handcrafted: Genesis Spark, Twin Stars, Spiral Helix,
Crystal Seed, Ember Ring, Void Mandala, Breathing Lattice.

## Surprise feature

Time-trail ghosts: fading translucent voxels of recent generations.

## Architecture

`src/sim` — grid, neighbors, rules, CA step, seeds, symmetry, share (unit-tested)
`src/render` — InstancedMesh voxels, trails, slice plane + hover, camera presets, bloom/fog
`src/app.ts` — orchestration and HUD bindings
`tests/` — neighbor count, wrap/clamp, rule parse, seeds, symmetry, deterministic step

One InstancedMesh for all live cells. Age maps ember to cyan.

## Performance

Default grid 24 cubed. Size control 12 to 40.
If slow, reduce grid size rather than breaking the renderer.
Bloom is the costliest effect; trails are optional.

## License

MIT. Built for Eric Edward.
