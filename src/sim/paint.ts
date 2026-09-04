import type { SliceAxis } from '../render/slice';

export interface PaintCell {
  x: number;
  y: number;
  z: number;
}

export type PaintSymmetry =
  | 'none'
  | 'mirror-x'
  | 'mirror-y'
  | 'mirror-z'
  | 'mirror-xy'
  | 'mirror-xz'
  | 'mirror-yz'
  | 'mirror-xyz';

function pushUnique(cells: PaintCell[], seen: Set<string>, x: number, y: number, z: number, size: number): void {
  if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return;
  const key = `${x},${y},${z}`;
  if (seen.has(key)) return;
  seen.add(key);
  cells.push({ x, y, z });
}

function symmetryAxes(mode: PaintSymmetry): [boolean, boolean, boolean] {
  if (mode === 'none') return [false, false, false];
  return [mode.includes('x'), mode.includes('y'), mode.includes('z')];
}

export function mirroredCells(cell: PaintCell, size: number, mode: PaintSymmetry): PaintCell[] {
  const seen = new Set<string>();
  const cells: PaintCell[] = [];
  const [mx, my, mz] = symmetryAxes(mode);
  const xs = mx ? [cell.x, size - 1 - cell.x] : [cell.x];
  const ys = my ? [cell.y, size - 1 - cell.y] : [cell.y];
  const zs = mz ? [cell.z, size - 1 - cell.z] : [cell.z];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        pushUnique(cells, seen, x, y, z, size);
      }
    }
  }
  return cells;
}

export function brushCellsOnSlice(
  center: PaintCell,
  axis: SliceAxis,
  brushSize: number,
  size: number,
): PaintCell[] {
  const radius = Math.max(0, Math.min(6, Math.floor(brushSize) - 1));
  const seen = new Set<string>();
  const cells: PaintCell[] = [];
  for (let a = -radius; a <= radius; a++) {
    for (let b = -radius; b <= radius; b++) {
      if (a * a + b * b > radius * radius) continue;
      if (axis === 'x') pushUnique(cells, seen, center.x, center.y + a, center.z + b, size);
      else if (axis === 'y') pushUnique(cells, seen, center.x + a, center.y, center.z + b, size);
      else pushUnique(cells, seen, center.x + a, center.y + b, center.z, size);
    }
  }
  return cells;
}

export function collectPaintCells(
  center: PaintCell,
  axis: SliceAxis,
  brushSize: number,
  symmetry: PaintSymmetry,
  size: number,
): PaintCell[] {
  const base = brushCellsOnSlice(center, axis, brushSize, size);
  const seen = new Set<string>();
  const cells: PaintCell[] = [];
  for (const cell of base) {
    for (const mirror of mirroredCells(cell, size, symmetry)) {
      pushUnique(cells, seen, mirror.x, mirror.y, mirror.z, size);
    }
  }
  return cells;
}
