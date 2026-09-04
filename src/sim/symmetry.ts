/**
 * Symmetry painting helpers — mirror through grid center.
 */

export type SymmetryMode = 'none' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';

export const SYMMETRY_OPTIONS: readonly { id: SymmetryMode; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'x', label: 'Mirror X' },
  { id: 'y', label: 'Mirror Y' },
  { id: 'z', label: 'Mirror Z' },
  { id: 'xy', label: 'Mirror XY' },
  { id: 'xz', label: 'Mirror XZ' },
  { id: 'yz', label: 'Mirror YZ' },
  { id: 'xyz', label: 'Mirror XYZ' },
] as const;

export interface CellCoord {
  x: number;
  y: number;
  z: number;
}

function mirrorCoord(v: number, size: number): number {
  return size - 1 - v;
}

/**
 * Expand a painted cell into all symmetry images (including the original).
 * Mirrors through the geometric center of the grid.
 */
export function expandSymmetry(
  x: number,
  y: number,
  z: number,
  size: number,
  mode: SymmetryMode,
): CellCoord[] {
  const cells: CellCoord[] = [{ x, y, z }];
  if (mode === 'none') return cells;

  const mx = mirrorCoord(x, size);
  const my = mirrorCoord(y, size);
  const mz = mirrorCoord(z, size);

  const mirrorX = mode === 'x' || mode === 'xy' || mode === 'xz' || mode === 'xyz';
  const mirrorY = mode === 'y' || mode === 'xy' || mode === 'yz' || mode === 'xyz';
  const mirrorZ = mode === 'z' || mode === 'xz' || mode === 'yz' || mode === 'xyz';

  const add = (cx: number, cy: number, cz: number) => {
    if (cx < 0 || cy < 0 || cz < 0 || cx >= size || cy >= size || cz >= size) return;
    if (!cells.some((c) => c.x === cx && c.y === cy && c.z === cz)) {
      cells.push({ x: cx, y: cy, z: cz });
    }
  };

  if (mirrorX) add(mx, y, z);
  if (mirrorY) add(x, my, z);
  if (mirrorZ) add(x, y, mz);
  if (mirrorX && mirrorY) add(mx, my, z);
  if (mirrorX && mirrorZ) add(mx, y, mz);
  if (mirrorY && mirrorZ) add(x, my, mz);
  if (mirrorX && mirrorY && mirrorZ) add(mx, my, mz);

  return cells;
}

/**
 * Brush stamps on the active slice plane (Chebyshev radius in the two free axes).
 */
export function brushCellsOnSlice(
  cx: number,
  cy: number,
  cz: number,
  size: number,
  axis: 'x' | 'y' | 'z',
  brushRadius: number,
): CellCoord[] {
  const r = Math.max(0, Math.floor(brushRadius));
  const out: CellCoord[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      // Chebyshev disk
      if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
      let x = cx;
      let y = cy;
      let z = cz;
      if (axis === 'x') {
        y = cy + dx;
        z = cz + dy;
      } else if (axis === 'y') {
        x = cx + dx;
        z = cz + dy;
      } else {
        x = cx + dx;
        y = cy + dy;
      }
      if (x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size) {
        out.push({ x, y, z });
      }
    }
  }
  return out;
}
