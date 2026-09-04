/**
 * Handcrafted evocative seeds — sparse, sculptural, not noise blobs.
 */

import { Grid3D } from './grid';

export interface SeedDefinition {
  id: string;
  name: string;
  description: string;
  /** Paint into a cleared grid of any size (centered). */
  apply: (grid: Grid3D) => void;
}

function setAge(grid: Grid3D, x: number, y: number, z: number, age = 1): void {
  if (grid.inBounds(x, y, z)) grid.set(x, y, z, age);
}

function center(grid: Grid3D): [number, number, number] {
  const c = Math.floor(grid.size / 2);
  return [c, c, c];
}

/** Compact glowing core — the first spark (kept small so rules can breathe). */
function genesisSpark(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(1, Math.floor(grid.size * 0.08));
  for (let z = -r; z <= r; z++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= r * 0.9) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Two offset spheres destined to dance. */
function twinStars(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const offset = Math.max(3, Math.floor(grid.size * 0.2));
  const r = Math.max(1, Math.floor(grid.size * 0.07));
  for (const ox of [-offset, offset]) {
    for (let z = -r; z <= r; z++) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y + z * z <= r * r) {
            setAge(grid, cx + x + ox, cy + y, cz + z, 1);
          }
        }
      }
    }
  }
}

/** DNA-like double helix along Y. */
function spiralHelix(grid: Grid3D): void {
  const [cx, , cz] = center(grid);
  const height = Math.floor(grid.size * 0.65);
  const y0 = Math.floor((grid.size - height) / 2);
  const radius = Math.max(2, Math.floor(grid.size * 0.14));
  const turns = 2.2;
  for (let i = 0; i < height; i++) {
    const t = (i / height) * turns * Math.PI * 2;
    const y = y0 + i;
    for (const phase of [0, Math.PI]) {
      const x = Math.round(cx + Math.cos(t + phase) * radius);
      const z = Math.round(cz + Math.sin(t + phase) * radius);
      setAge(grid, x, y, z, 1);
      setAge(grid, x + 1, y, z, 1);
    }
  }
}

/** Octahedral crystal seed — sharp diamond for Crystal Veins. */
function crystalSeed(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(2, Math.floor(grid.size * 0.14));
  for (let z = -r; z <= r; z++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) === r) {
          setAge(grid, cx + x, cy + y, cz + z, 1);
        }
      }
    }
  }
  // tiny core
  setAge(grid, cx, cy, cz, 1);
}

/** Toroidal ember ring in the XZ plane. */
function emberRing(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const R = Math.max(3, Math.floor(grid.size * 0.26));
  const tube = Math.max(1, Math.floor(grid.size * 0.04));
  for (let z = -R - tube; z <= R + tube; z++) {
    for (let y = -tube; y <= tube; y++) {
      for (let x = -R - tube; x <= R + tube; x++) {
        const dist = Math.sqrt(x * x + z * z);
        const d = Math.sqrt((dist - R) ** 2 + y * y);
        if (d <= tube + 0.35) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Sparse radial mandala — eight spokes + rings. */
function voidMandala(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const maxR = Math.max(4, Math.floor(grid.size * 0.32));
  for (let r = 2; r <= maxR; r += 2) {
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * r);
      const z = Math.round(cz + Math.sin(t) * r);
      setAge(grid, x, cy, z, 1);
      setAge(grid, x, cy + 1, z, 1);
    }
  }
  // vertical axis accent
  const h = Math.floor(maxR * 0.6);
  for (let y = -h; y <= h; y++) {
    if (y % 2 === 0) setAge(grid, cx, cy + y, cz, 1);
  }
}

/** Open lattice cage — good for breathing rules. */
function breathingLattice(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const half = Math.max(3, Math.floor(grid.size * 0.22));
  const step = Math.max(2, Math.floor(half / 2));
  for (let y = -half; y <= half; y += step) {
    for (let x = -half; x <= half; x += step) {
      setAge(grid, cx + x, cy + y, cz - half, 1);
      setAge(grid, cx + x, cy + y, cz + half, 1);
    }
    for (let z = -half; z <= half; z += step) {
      setAge(grid, cx - half, cy + y, cz + z, 1);
      setAge(grid, cx + half, cy + y, cz + z, 1);
    }
  }
  for (let z = -half; z <= half; z += step) {
    for (let x = -half; x <= half; x += step) {
      setAge(grid, cx + x, cy - half, cz + z, 1);
      setAge(grid, cx + x, cy + half, cz + z, 1);
    }
  }
}

export const SEEDS: readonly SeedDefinition[] = [
  {
    id: 'genesis-spark',
    name: 'Genesis Spark',
    description: 'A compact ember core — the first light in the void',
    apply: genesisSpark,
  },
  {
    id: 'twin-stars',
    name: 'Twin Stars',
    description: 'Two spheres destined to dance and collide',
    apply: twinStars,
  },
  {
    id: 'spiral-helix',
    name: 'Spiral Helix',
    description: 'A double helix climbing through empty space',
    apply: spiralHelix,
  },
  {
    id: 'crystal-seed',
    name: 'Crystal Seed',
    description: 'An octahedral diamond — sharp edges for lattice growth',
    apply: crystalSeed,
  },
  {
    id: 'ember-ring',
    name: 'Ember Ring',
    description: 'A slender toroidal ring of fire',
    apply: emberRing,
  },
  {
    id: 'void-mandala',
    name: 'Void Mandala',
    description: 'Radial spokes and rings — ritual geometry in the dark',
    apply: voidMandala,
  },
  {
    id: 'breathing-lattice',
    name: 'Breathing Lattice',
    description: 'An open cage that expands and contracts under Ember Breath',
    apply: breathingLattice,
  },
] as const;

export const DEFAULT_SEED_ID = 'genesis-spark';

export function getSeedById(id: string): SeedDefinition | undefined {
  return SEEDS.find((s) => s.id === id);
}

export function applySeed(grid: Grid3D, seedId: string): boolean {
  const seed = getSeedById(seedId);
  if (!seed) return false;
  grid.clear();
  seed.apply(grid);
  return true;
}
