/**
 * 26-neighbor Moore neighborhood counting for 3D CA.
 */

import type { BoundaryMode, Grid3D } from './grid';

/** All 26 Moore neighbor offsets (excludes self). */
export const MOORE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const offsets: Array<[number, number, number]> = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        offsets.push([dx, dy, dz]);
      }
    }
  }
  return offsets;
})();

/**
 * Count live Moore neighbors around (x,y,z).
 * clamp: out-of-bounds neighbors count as dead.
 * wrap: toroidal wrap.
 */
export function countNeighbors(
  grid: Grid3D,
  x: number,
  y: number,
  z: number,
  boundary: BoundaryMode = 'clamp',
): number {
  let count = 0;
  const s = grid.size;
  const cells = grid.cells;

  for (let i = 0; i < MOORE_OFFSETS.length; i++) {
    const [dx, dy, dz] = MOORE_OFFSETS[i]!;
    let nx = x + dx;
    let ny = y + dy;
    let nz = z + dz;

    if (boundary === 'wrap') {
      nx = ((nx % s) + s) % s;
      ny = ((ny % s) + s) % s;
      nz = ((nz % s) + s) % s;
    } else if (nx < 0 || ny < 0 || nz < 0 || nx >= s || ny >= s || nz >= s) {
      continue;
    }

    if (cells[nx + ny * s + nz * s * s]! > 0) count++;
  }
  return count;
}
