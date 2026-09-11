import { Grid3D } from '../src/sim/grid';
import {
  generateChildUniverse,
  seedUniverseRoot,
  universeAddressKey,
  type UniverseAddressStep,
} from '../src/sim/universe';

const path: UniverseAddressStep[] = [
  { x: 3, y: 5, z: 7, generation: 12, age: 4 },
];

describe('recursive universe generation', () => {
  it('recreates the same child from the same address', () => {
    const first = generateChildUniverse(24, 12345, path);
    const second = generateChildUniverse(24, 12345, path);
    expect(first.seedId).toBe(second.seedId);
    expect(first.grid.cells).toEqual(second.grid.cells);
    expect(first.grid.population).toBeGreaterThan(0);
  });

  it('changes when the focus address changes', () => {
    const first = generateChildUniverse(24, 12345, path);
    const second = generateChildUniverse(24, 12345, [
      { ...path[0]!, x: path[0]!.x + 1 },
    ]);
    expect(first.grid.cells).not.toEqual(second.grid.cells);
  });

  it('derives stable root seeds and readable path keys', () => {
    const grid = new Grid3D(12);
    grid.set(2, 3, 4, 5);
    expect(seedUniverseRoot(grid, 8, 'B4/S4-5')).toBe(
      seedUniverseRoot(grid.clone(), 8, 'B4/S4-5'),
    );
    expect(universeAddressKey([])).toBe('root');
    expect(universeAddressKey(path)).toBe('3,5,7@12:4');
  });
});
