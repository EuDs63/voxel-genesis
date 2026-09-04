# Voxel Genesis

Cinematic browser 3D cellular automaton.

Ember and cyan living cells in a dark void. Bloom, fog, age-colored voxels.

Stack: TypeScript + Vite + Three.js (WebGL). Vitest for simulation tests. No backend, no API keys.

## How to run

Install dependencies, then start the Vite development server (port 5173).
Run the test suite with Vitest. Create a production build, then serve it with Vite preview (port 4173).

Scripts in package.json: `dev`, `build`, `test`, `preview`.

## Controls

Space play/pause. N step. R reset. G randomize.
M toggles Orbit / Paint mode. P toggle paint plane. Bracket keys move plane. X Y Z set axis.
In Paint mode, hover shows snap-to-grid highlight and crosshair; click to paint; Shift erase.
Brush size and symmetry (Mirror X/Y/Z / multi-axis) live in the panel.
Camera presets 1–5: Orbit, Hero, Top-down, Close-up, Flyby (smooth lerp; instant if reduced motion).
O auto-orbit. T time trails. Question-mark toggles the side panel.
Share via Copy URL (hash state) or JSON export/import.

Mobile: use the Orbit/Paint FAB (and panel toggle). Paint mode disables orbit gestures so touches aim the brush.

First-run hint dismisses via localStorage.
When prefers-reduced-motion is set, bloom, auto-orbit, and camera lerps stay off / instant.

## Rules

Real 26-neighbor Moore CA. Not Conway 2333.
Default: **Ember Breath** `B4/S4-5` — sparse pulsing embers.
Also: Crystal Veins `B5/S5-6`, Nebula Drift `B10-12/S9-14`,
Coral Scaffold `B6/S5-7`, Pyro Bloom `B5/S4-6`, Void Whisper `B7/S6-8`.
Custom B/S editor included. Boundary modes: clamp or wrap.

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
