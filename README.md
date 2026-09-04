# Voxel Genesis

Cinematic browser 3D cellular automaton.

Ember and cyan living cells in a dark void. Bloom, fog, age-colored voxels.

Stack: TypeScript + Vite + Three.js (WebGL). Vitest for simulation tests. No backend, no API keys.

## How to run

Install dependencies, then start the Vite development server (port 5173).
Run the test suite with Vitest. Create a production build, then serve it with Vite preview (port 4173).

Scripts in package.json: dev, build, test, preview.

## Controls

Space play/pause. N step. R reset. G randomize.
P toggle paint plane. Bracket keys move plane. X Y Z set axis.
Click the slice to paint; Shift-click to erase.
O auto-orbit. T time trails. Question-mark toggles the side panel.
Share via Copy URL (hash state) or JSON export/import.

First-run hint dismisses via localStorage.
When prefers-reduced-motion is set, bloom and auto-orbit stay off.

## Rules

Real 26-neighbor Moore CA. Not Conway 2333.
Default preset: Ember Bloom, notation B4-6/S5-7.
Other presets: Crystal Veins B5-6/S4-6, Nebula Drift B13/S13,
Coral Reef B6/S5-8,10, Pyroclastic B4-7/S6-8, Amoeba B9/S5-7,12-13.
Custom B/S editor included. Boundary modes: clamp or wrap.

## Seeds

Handcrafted: Genesis Spark, Twin Stars, Spiral Helix,
Cross of Ages, Ember Ring, Cascade Pillar.

## Surprise feature

Time-trail ghosts: fading translucent voxels of recent generations.

## Architecture

src/sim — grid, neighbors, rules, CA step, seeds, share (unit-tested)
src/render — InstancedMesh voxels, trails, slice plane, bloom/fog
src/app.ts — orchestration and HUD bindings
tests/ — neighbor count, wrap/clamp, rule parse, deterministic step

One InstancedMesh for all live cells. Age maps ember to cyan.

## Performance

Default grid 24 cubed. Size control 12 to 40.
If slow, reduce grid size rather than breaking the renderer.
Bloom is the costliest effect; trails are optional.

## License

MIT. Built for Eric Edward.
