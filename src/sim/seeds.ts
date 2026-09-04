/**
 * Handcrafted evocative seeds — not just noise.
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

/** Dense glowing core — the first spark. */
function genesisSpark(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(2, Math.floor(grid.size * 0.16));
  for (let z = -r; z <= r; z++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= r * 0.85) setAge(grid, cx + x, cy + y, cz + z, 1);
        else if (d <= r && (x + y + z) % 2 === 0) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Two offset spheres orbiting the void. */
function twinStars(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const offset = Math.max(3, Math.floor(grid.size * 0.18));
  const r = Math.max(2, Math.floor(grid.size * 0.1));
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
  const height = Math.floor(grid.size * 0.7);
  const y0 = Math.floor((grid.size - height) / 2);
  const radius = Math.max(2, Math.floor(grid.size * 0.14));
  const turns = 2.5;
  for (let i = 0; i < height; i++) {
    const t = (i / height) * turns * Math.PI * 2;
    const y = y0 + i;
    for (const phase of [0, Math.PI]) {
      const x = Math.round(cx + Math.cos(t + phase) * radius);
      const z = Math.round(cz + Math.sin(t + phase) * radius);
      setAge(grid, x, y, z, 1);
      setAge(grid, x + 1, y, z, 1);
      setAge(grid, x, y, z + 1, 1);
    }
  }
}

/** Classic 3D plus / axis cross. */
function crossOfAges(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const arm = Math.max(4, Math.floor(grid.size * 0.28));
  const thick = Math.max(1, Math.floor(grid.size * 0.04));
  for (let i = -arm; i <= arm; i++) {
    for (let t = -thick; t <= thick; t++) {
      setAge(grid, cx + i, cy + t, cz, 1);
      setAge(grid, cx + t, cy + i, cz, 1);
      setAge(grid, cx, cy + t, cz + i, 1);
      setAge(grid, cx + t, cy, cz + i, 1);
      setAge(grid, cx, cy + i, cz + t, 1);
    }
  }
}

/** Toroidal ember ring in the XZ plane. */
function emberRing(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const R = Math.max(4, Math.floor(grid.size * 0.28));
  const tube = Math.max(1, Math.floor(grid.size * 0.06));
  for (let z = -R - tube; z <= R + tube; z++) {
    for (let y = -tube - 1; y <= tube + 1; y++) {
      for (let x = -R - tube; x <= R + tube; x++) {
        const dist = Math.sqrt(x * x + z * z);
        const d = Math.sqrt((dist - R) ** 2 + y * y);
        if (d <= tube + 0.4) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Vertical cascading pillar with terraced platforms. */
function cascadePillar(grid: Grid3D): void {
  const [cx, , cz] = center(grid);
  const h = Math.floor(grid.size * 0.75);
  const y0 = Math.floor((grid.size - h) / 2);
  for (let i = 0; i < h; i++) {
    const y = y0 + i;
    const tier = Math.floor(i / Math.max(3, Math.floor(h / 5)));
    const r = Math.max(1, 2 + (tier % 3));
    for (let z = -r; z <= r; z++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + z * z <= r * r + 0.5) {
          setAge(grid, cx + x, y, cz + z, 1);
        }
      }
    }
    // occasional wing
    if (i % 5 === 0) {
      const wing = r + 2;
      for (let w = -wing; w <= wing; w++) {
        setAge(grid, cx + w, y, cz, 1);
        setAge(grid, cx, y, cz + w, 1);
      }
    }
  }
}

export const SEEDS: readonly SeedDefinition[] = [
  {
    id: 'genesis-spark',
    name: 'Genesis Spark',
    description: 'A dense ember core — the first light in the void',
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
    id: 'cross-of-ages',
    name: 'Cross of Ages',
    description: 'An axial cross of living matter',
    apply: crossOfAges,
  },
  {
    id: 'ember-ring',
    name: 'Ember Ring',
    description: 'A toroidal ring of fire',
    apply: emberRing,
  },
  {
    id: 'cascade-pillar',
    name: 'Cascade Pillar',
    description: 'Terraced pillar rising from the abyss',
    apply: cascadePillar,
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
