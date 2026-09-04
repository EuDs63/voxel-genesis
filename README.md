# Voxel Genesis

Voxel Genesis is a cinematic, immediately playable browser-based 3D cellular automaton (3D Game of Life style) built with **TypeScript + Vite + Three.js**.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Controls

- **Camera**: drag to orbit, right-drag to pan, wheel to zoom
- **Simulation**: play/pause, step, reset, randomize
- **Simulation tuning**: speed, size, density
- **Rules**: choose named 3D B/S presets or enter custom `B.../S...` notation
- **Seeds**: stamp handcrafted seed presets
- **Painting**: choose paint/erase and click on the active glowing **Z slice** plane
- **State sharing**:
  - URL hash auto-updates with current state
  - Copy JSON / Load JSON for explicit export/import

## Included rule presets

- **Nebula Bloom** `B6/S5,6,7`
- **Crystal Drift** `B5/S4,5`
- **Pulse Lattice** `B7/S6,7,8`
- **Aether Weave** `B6,7/S5,6,7,8`

## Visual direction

- Dark void scene with fog, ember/cyan age-based cell coloration, and tasteful glow
- Smooth birth/death transitions using display interpolation
- Surprise feature: fading recent-generation ghost trails for dead cells
- Optional cinematic auto-orbit (disabled when `prefers-reduced-motion` is detected)
- First-run hint overlay that dismisses and stays out of the way

## Architecture

- `src/sim/grid.ts`: bounded 3D automaton state and deterministic stepping with full 26-neighbor Moore counts
- `src/sim/rules.ts`: B/S parsing + preset definitions
- `src/sim/seeds.ts`: handcrafted seed definitions and centered stamping
- `src/render/voxelScene.ts`: Three.js scene + **InstancedMesh** rendering + slice picking
- `src/state.ts`: URL-hash and JSON serialization helpers
- `src/main.ts`: app wiring, UI controls, loop orchestration

Simulation and rendering are separated: simulation evolves in typed arrays; renderer consumes display/age/ghost buffers.

## Performance notes

- Live cells and ghost trails render via `InstancedMesh` (not thousands of individual `Mesh` objects)
- Default grid is `24³` (13,824 cells), iterated in tight typed-array loops
- Rendering updates instance transforms/colors each frame while stepping occurs at configurable fixed-rate speed
