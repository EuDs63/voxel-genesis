import { describe, it, expect } from 'vitest';
import { brushCellsOnSlice, collectPaintCells, mirroredCells } from '../src/sim/paint';

describe('mirroredCells', () => {
  it('mirrors across requested axes through center', () => {
    const cells = mirroredCells({ x: 2, y: 3, z: 4 }, 10, 'mirror-xyz');
    expect(cells).toHaveLength(8);
    expect(cells).toContainEqual({ x: 2, y: 3, z: 4 });
    expect(cells).toContainEqual({ x: 7, y: 3, z: 4 });
    expect(cells).toContainEqual({ x: 2, y: 6, z: 4 });
    expect(cells).toContainEqual({ x: 2, y: 3, z: 5 });
    expect(cells).toContainEqual({ x: 7, y: 6, z: 5 });
  });

  it('deduplicates center-plane mirrors', () => {
    const cells = mirroredCells({ x: 4, y: 4, z: 4 }, 9, 'mirror-x');
    expect(cells).toEqual([{ x: 4, y: 4, z: 4 }]);
  });
});

describe('brushCellsOnSlice', () => {
  it('keeps brush on active slice axis', () => {
    const yPlane = brushCellsOnSlice({ x: 4, y: 2, z: 4 }, 'y', 3, 12);
    expect(yPlane.every((cell) => cell.y === 2)).toBe(true);
    const xPlane = brushCellsOnSlice({ x: 5, y: 4, z: 4 }, 'x', 2, 12);
    expect(xPlane.every((cell) => cell.x === 5)).toBe(true);
  });
});

describe('collectPaintCells', () => {
  it('combines brush and symmetry', () => {
    const cells = collectPaintCells({ x: 2, y: 3, z: 2 }, 'y', 1, 'mirror-xz', 8);
    expect(cells).toEqual(
      expect.arrayContaining([
        { x: 2, y: 3, z: 2 },
        { x: 5, y: 3, z: 2 },
        { x: 2, y: 3, z: 5 },
        { x: 5, y: 3, z: 5 },
      ]),
    );
  });
});
