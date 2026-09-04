/**
 * Deterministic 3D cellular automaton step (26-neighbor Moore + B/S rules).
 */

import type { Grid3D } from './grid';
import type { BoundaryMode } from './grid';
import type { Rule } from './rules';
import { shouldLive } from './rules';
import { countNeighbors } from './neighbors';

export interface StepResult {
  births: number;
  deaths: number;
  population: number;
}

/**
 * Advance one generation. Writes into `next` (must be same size).
 * Live cells age up (capped at 255); new births start at age 1.
 * Fully deterministic for a given grid + rule + boundary.
 */
export function step(
  current: Grid3D,
  next: Grid3D,
  rule: Rule,
  boundary: BoundaryMode = 'clamp',
): StepResult {
  if (current.size !== next.size) throw new Error('grid size mismatch');

  const s = current.size;
  const src = current.cells;
  const dst = next.cells;
  let births = 0;
  let deaths = 0;
  let population = 0;

  for (let z = 0; z < s; z++) {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const i = x + y * s + z * s * s;
        const age = src[i]!;
        const alive = age > 0;
        const n = countNeighbors(current, x, y, z, boundary);
        const live = shouldLive(alive, n, rule);

        if (live) {
          if (alive) {
            dst[i] = age >= 255 ? 255 : age + 1;
          } else {
            dst[i] = 1;
            births++;
          }
          population++;
        } else {
          dst[i] = 0;
          if (alive) deaths++;
        }
      }
    }
  }

  next.population = population;
  return { births, deaths, population };
}

/** In-place step using a scratch buffer (swaps cell arrays). */
export function stepInPlace(
  grid: Grid3D,
  scratch: Grid3D,
  rule: Rule,
  boundary: BoundaryMode = 'clamp',
): StepResult {
  const result = step(grid, scratch, rule, boundary);
  // Swap buffers so `grid` holds the new state without reallocating.
  const tmp = grid.cells;
  (grid as { cells: Uint8Array }).cells = scratch.cells;
  (scratch as { cells: Uint8Array }).cells = tmp;
  grid.population = scratch.population;
  return result;
}
