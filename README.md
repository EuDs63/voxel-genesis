# Voxel Genesis

An interactive gallery of digital life, built on a real 3D cellular automaton.

A cold-white gallery of ice-blue crystal and silver reflections, with editorial typography and a curated collection. Explore, unfold, sculpt, and evolve real cells inside nested worlds. The workbench starts collapsed so the sculpture has the stage.

The default specimen is **Continuum / 无尽之结** (`torus-knot`): a continuous trefoil knot made from 2,166 living cells in a 40³ grid, paired with the rule `B10/S10-26`. It opens paused; a saved session or valid shared URL takes precedence over this initial scene.

Stack: TypeScript + Vite + Three.js (WebGL). Vitest for simulation tests. No backend, no API keys.

## How to run

Use Node.js `^20.19.0` or `>=22.12.0`. Install dependencies, then start the Vite development server (port 5173).
Run the test suite with Vitest. Create a production build, then serve it with Vite preview (port 4173).

Scripts in package.json: `dev`, `build`, `test`, `preview`. All application code is normal TypeScript under `src`; development, tests, and builds use the same source directly.

## Controls

Space play/pause. N step. R reset. G randomize.
The stage also offers playback, Unfold structure / Assemble structure, and Open studio. Unfold changes the spacing between rendered cells without changing their cellular state, ages, or simulation rule. It switches painting to Orbit mode; with reduced motion the spacing changes immediately.
M toggles Orbit / Paint mode. P toggle paint plane. Bracket keys move plane. X Y Z set axis.
In Paint mode, hover shows snap-to-grid highlight and crosshair; choose Draw or Erase (Shift temporarily erases). Entering Paint pauses simulation. Orbit mode never edits cells.
Brush size and symmetry (Mirror X/Y/Z / multi-axis) live in the panel.
Camera presets 1–5: Orbit, Hero, Top-down, Close-up, Flyby (smooth lerp; instant if reduced motion).
O auto-orbit. T time trails. Question-mark toggles the side panel.
In Orbit mode, double-click a live voxel (double-tap on touch) to enter its recursively generated child world. U or Return upward goes back one level. Visited worlds and their camera positions are cached for exact backtracking during the session.
Share via Copy URL (hash state) or JSON export/import.
Restart restores the initial world of the current experiment, including a random or hand-painted world. Changing the rule or boundary establishes that current world and setting as the new experiment start. Restore defaults returns to the built-in seed and rule. Rule, boundary, resize, seed, random, import, and complete paint strokes can be undone; simulation frames are not recorded. Imports and page-refresh session restores always open paused.

The local Works library stores up to 12 named snapshots with thumbnails and refuses additional saves when full. The last session is restored after refresh (a valid shared URL takes priority). Storage writes are throttled and save failures leave old data intact.

The collection includes four locally rendered featured setups: Continuum, Torus, Menger, and Wave. Continuum uses a 40³ grid and `B10/S10-26`; Torus uses `B3/S4-6`; Menger and Wave use existing presets. The latter three open in 24³ grids. Each pairing is checked for continued life through 20 generations, without a guarantee of indefinite survival. Featured setups open paused and replace the world as one undoable edit. Gyroid remains available in the shape catalog.

The observation panel shows real population, occupancy, generation, rule, and a 120-step live-cell trend. Crystal, Ice blue, and Purple + pink palettes, along with Daylight, Warm horizon, and Blue grid environments, remain available. Observe returns to Orbit mode and closes the workbench; Create and Experiment open their respective tools.

Immersive view hides controls and helpers without changing simulation state; Escape or the visible exit button restores the previous editing view. Save Image exports the WebGL scene without interface or helper overlays. On smaller screens, the inspector opens as an overlay, the collection scrolls horizontally, and landscape mode prioritizes the sculpture and transport controls.

Mobile: use the Orbit/Paint FAB (and panel toggle). Paint mode disables orbit gestures so touches aim the brush.

First-run hint dismisses via localStorage.
Bloom starts disabled. When prefers-reduced-motion is set, bloom and auto-orbit remain off, trails start disabled, and camera and unfold transitions are immediate.

## Rules

Real 26-neighbor Moore CA. Not Conway 2333.
The rule picker describes the real conditions, for example “Birth 4 · Survive 4–5.” Each cell checks up to 26 neighbors, and every cell updates together from the previous step. The built-in rules use `B4/S4-5`, `B5/S5-6`, `B10-12/S9-14`, `B6/S5-7`, `B5/S4-6`, and `B7/S6-8`. An accessible advanced section explains and accepts custom B/S syntax. Boundary modes treat space outside the grid as empty or connect opposite sides.

## Seeds

The catalog includes Continuum, Gyroid, Menger, Wave, and handcrafted seeds such as Genesis Spark, Twin Stars, Spiral Helix, Crystal Seed, Ember Ring, Void Mandala, and Breathing Lattice.

## Surprise feature

Time-trail ghosts: fading translucent voxels of recent generations.

Recursive exploration: every live voxel is a deterministic address for another 3D cellular world. Child worlds are generated lazily, and only the two adjacent levels are rendered during a transition.

## Architecture

`src/sim` — grid, neighbors, rules, CA step, seeds, recursive universe addresses, symmetry, share (unit-tested)
`src/render` — instanced crystal voxels, physical material, studio environment and shadows, unfold animation, trails, slice plane + hover, camera framing, optional bloom/fog
`src/app.ts` — simulation, editing history, persistence, and universe orchestration
`src/ui/gallery.ts` — exhibition navigation and live specimen information
`tests/` — neighbor count, wrap/clamp, rule parse, seeds, symmetry, deterministic step

Live cells share one `InstancedMesh` with beveled geometry and a `MeshPhysicalMaterial`: transmission, clearcoat, and a generated PMREM studio environment create the crystal reflections. A directional shadow map supplies self-shadowing. These effects introduce additional rendering work beyond the main instanced draw. Age maps through the selected palette; the default Crystal palette runs from blue through ice blue to silver-white. Existing palette IDs remain compatible with saved works and links.

The renderer observes its actual canvas size. Camera fitting accounts for the projected shape in landscape and portrait viewports. Unfold animation updates rendered positions and raycast bounds while preserving the simulation grid. Bloom passes, the studio environment, and shadow resources are disposed with their owners.

See [the redesign review](docs/DESIGN_REVIEW.md) for the changes and the next optimization priorities.

## Performance

The default grid is 40³; the size control spans 12 to 40. Simulation cost depends on grid volume, while rendering also depends on visible cells, pixel ratio, transmission, shadow maps, and optional trails and bloom. Reducing grid size or disabling optional effects can help on slower devices.

The crystal material and shadows require profiling on representative devices before choosing adaptive quality settings. Next candidates include transmission quality, shadow resolution, pixel ratio, and trail budgets. There is no fixed frame-rate guarantee or automatic quality tier yet.

## License

MIT. Built for Eric Edward.
