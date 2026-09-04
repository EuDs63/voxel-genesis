import { describe, it, expect } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { countNeighbors, MOORE_OFFSETS } from '../src/sim/neighbors';

describe('MOORE_OFFSETS', () => {
  it('has exactly 26 offsets and excludes origin', () => {
    expect(MOORE_OFFSETS).toHaveLength(26);
    expect(MOORE_OFFSETS.some(([x, y, z]) => x === 0 && y === 0 && z === 0)).toBe(false);
  });
});

describe('countNeighbors', () => {
  it('counts all 26 when fully surrounded (interior)', () => {
    const g = new Grid3D(5);
    for (let z = 0; z < 5; z++)
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) g.set(x, y, z, 1);
    expect(countNeighbors(g, 2, 2, 2, 'clamp')).toBe(26);
  });

  it('clamp treats out-of-bounds as dead', () => {
    const g = new Grid3D(4);
    g.set(0, 0, 0, 1);
    // Corner cell: only 7 possible in-bounds neighbors, all dead
    expect(countNeighbors(g, 0, 0, 0, 'clamp')).toBe(0);
    g.set(1, 0, 0, 1);
    g.set(0, 1, 0, 1);
    g.set(0, 0, 1, 1);
    expect(countNeighbors(g, 0, 0, 0, 'clamp')).toBe(3);
  });

  it('wrap counts toroidal neighbors', () => {
    const g = new Grid3D(4);
    g.set(3, 0, 0, 1);
    // From (0,0,0), wrap neighbor (-1,0,0) → (3,0,0)
    expect(countNeighbors(g, 0, 0, 0, 'wrap')).toBe(1);
    expect(countNeighbors(g, 0, 0, 0, 'clamp')).toBe(0);
  });

  it('does not count the cell itself', () => {
    const g = new Grid3D(4);
    g.set(1, 1, 1, 1);
    expect(countNeighbors(g, 1, 1, 1, 'clamp')).toBe(0);
  });
});
