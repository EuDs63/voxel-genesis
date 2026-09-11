/**
 * Deterministic addresses and child-world generation for recursive exploration.
 *
 * The visible universe stays finite. A child is only materialized when it is
 * visited, and its address is enough to reproduce the same starting world.
 */

import { Grid3D } from './grid';
import { SEED_CATALOG, applySeed } from './seeds';

export interface UniverseAddressStep {
  x: number;
  y: number;
  z: number;
  generation: number;
  age: number;
}

export interface GeneratedUniverse {
  grid: Grid3D;
  seedId: string;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashByte(hash: number, byte: number): number {
  return Math.imul((hash ^ (byte & 0xff)) >>> 0, FNV_PRIME) >>> 0;
}

function hashInt(hash: number, value: number): number {
  let next = hash >>> 0;
  const n = value >>> 0;
  next = hashByte(next, n);
  next = hashByte(next, n >>> 8);
  next = hashByte(next, n >>> 16);
  return hashByte(next, n >>> 24);
}

/** Stable seed for turning the current finite world into a recursive root. */
export function seedUniverseRoot(
  grid: Pick<Grid3D, 'size' | 'cells'>,
  generation: number,
  ruleNotation: string,
): number {
  let hash = hashInt(FNV_OFFSET, grid.size);
  hash = hashInt(hash, generation);
  for (let i = 0; i < ruleNotation.length; i++) {
    hash = hashInt(hash, ruleNotation.charCodeAt(i));
  }
  for (let i = 0; i < grid.cells.length; i++) {
    hash = hashByte(hash, grid.cells[i]!);
  }
  return hash || 1;
}

/** Human-readable cache key for a lazily materialized address. */
export function universeAddressKey(path: readonly UniverseAddressStep[]): string {
  if (path.length === 0) return 'root';
  return path
    .map(({ x, y, z, generation, age }) => `${x},${y},${z}@${generation}:${age}`)
    .join('/');
}

export function hashUniverseAddress(
  rootSeed: number,
  path: readonly UniverseAddressStep[],
): number {
  let hash = hashInt(FNV_OFFSET, rootSeed);
  for (const step of path) {
    hash = hashInt(hash, step.x);
    hash = hashInt(hash, step.y);
    hash = hashInt(hash, step.z);
    hash = hashInt(hash, step.generation);
    hash = hashInt(hash, step.age);
  }
  return hash || 1;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Materialize one child universe. Hand-authored shapes provide legible
 * silhouettes; deterministic perforation makes repeated addresses distinct.
 */
export function generateChildUniverse(
  size: number,
  rootSeed: number,
  path: readonly UniverseAddressStep[],
): GeneratedUniverse {
  if (path.length === 0) throw new Error('Child universe requires a non-empty address');
  const addressSeed = hashUniverseAddress(rootSeed, path);
  const rng = mulberry32(addressSeed);
  const seed = SEED_CATALOG[addressSeed % SEED_CATALOG.length]!;
  const grid = new Grid3D(size);
  applySeed(grid, seed.id);

  const volume = grid.volume;
  const edits = Math.max(8, Math.floor(volume * (0.004 + rng() * 0.006)));
  for (let i = 0; i < edits; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const z = Math.floor(rng() * size);
    const current = grid.get(x, y, z);
    if (current > 0) {
      if (rng() < 0.68) grid.set(x, y, z, 0);
    } else if (rng() < 0.34) {
      grid.set(x, y, z, 1 + Math.floor(rng() * 3));
    }
  }

  // Keep every destination explorable even when perforation hits a tiny seed.
  if (grid.population === 0) {
    const c = Math.floor(size / 2);
    grid.set(c, c, c, 1);
  }
  return { grid, seedId: seed.id };
}
