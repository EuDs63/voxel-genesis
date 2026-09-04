import { describe, it, expect } from 'vitest';
import { expandSymmetry, brushCellsOnSlice } from '../src/sim/symmetry';

describe('expandSymmetry', () => {
  it('returns only the original for none', () => {
    expect(expandSymmetry(3, 4, 5, 10, 'none')).toEqual([{ x: 3, y: 4, z: 5 }]);
  });

  it('mirrors X through center', () => {
    // size 10 → mirror of 2 is 7
    const cells = expandSymmetry(2, 4, 5, 10, 'x');
    expect(cells).toContainEqual({ x: 2, y: 4, z: 5 });
    expect(cells).toContainEqual({ x: 7, y: 4, z: 5 });
    expect(cells).toHaveLength(2);
  });

  it('mirrors XYZ into up to 8 cells', () => {
    const cells = expandSymmetry(1, 2, 3, 8, 'xyz');
    expect(cells.length).toBe(8);
  });

  it('dedupes when on the center plane', () => {
    // size 5, center index 2 mirrors to itself
    const cells = expandSymmetry(2, 1, 1, 5, 'x');
    expect(cells).toHaveLength(1);
  });
});

describe('brushCellsOnSlice', () => {
  it('paints a single cell at radius 0', () => {
    expect(brushCellsOnSlice(5, 5, 5, 12, 'y', 0)).toEqual([{ x: 5, y: 5, z: 5 }]);
  });

  it('expands on the free axes for radius 1', () => {
    const cells = brushCellsOnSlice(5, 5, 5, 12, 'y', 1);
    expect(cells.length).toBe(9); // 3x3 on XZ
    expect(cells.every((c) => c.y === 5)).toBe(true);
  });

  it('clamps to grid bounds', () => {
    const cells = brushCellsOnSlice(0, 0, 0, 8, 'z', 2);
    expect(cells.every((c) => c.x >= 0 && c.y >= 0 && c.z === 0)).toBe(true);
  });
});
