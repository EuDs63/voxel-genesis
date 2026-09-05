import { describe, expect, it } from 'vitest';
import { stepInPlace } from '../src/sim/ca';
import { Grid3D } from '../src/sim/grid';
import { Interventions } from '../src/sim/interventions';
import { parseRuleNotation } from '../src/sim/rules';
import { encodeCells, parseSnapshotJSON, type AppSnapshot } from '../src/sim/share';

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  const grid = new Grid3D(8);
  grid.set(4, 4, 4, 1);
  return {
    v: 2,
    size: 8,
    generation: 0,
    rule: 'B4/S4-5',
    ruleName: 'Test',
    boundary: 'clamp',
    seedName: 'Test',
    cells: encodeCells(grid),
    ...overrides,
  };
}

describe('interventions', () => {
  it('keeps source and barrier marks mutually exclusive', () => {
    const marks = new Interventions(8);
    marks.set(10, 'source');
    expect(marks.indices('source')).toEqual([10]);
    marks.set(10, 'barrier');
    expect(marks.indices('source')).toEqual([]);
    expect(marks.indices('barrier')).toEqual([10]);
    marks.set(10, 'source');
    expect(marks.indices('source')).toEqual([10]);
    expect(marks.indices('barrier')).toEqual([]);
  });

  it('enforces marks before and after every CA step', () => {
    const grid = new Grid3D(8), scratch = new Grid3D(8), marks = new Interventions(8);
    const source = grid.index(1, 1, 1), barrier = grid.index(6, 6, 6);
    marks.set(source, 'source');
    marks.set(barrier, 'barrier');
    grid.cells[barrier] = 9;
    grid.recount();
    const rule = parseRuleNotation('B0/S', 'Hostile test');

    for (let generation = 0; generation < 3; generation++) {
      marks.apply(grid);
      stepInPlace(grid, scratch, rule, 'clamp');
      marks.apply(grid);
      expect(grid.cells[source]).toBeGreaterThan(0);
      expect(grid.cells[barrier]).toBe(0);
    }
  });

  it('maps marks around the grid center when resized and clips overflow', () => {
    const marks = new Interventions(8);
    marks.set(4 + 4*8 + 4*64, 'source');
    marks.set(1 + 2*8 + 3*64, 'barrier');
    marks.set(0, 'source');

    const larger = marks.resize(12);
    expect(larger.indices('source')).toContain(6 + 6*12 + 6*144);
    expect(larger.indices('barrier')).toContain(3 + 4*12 + 5*144);

    const smaller = marks.resize(4);
    expect(smaller.indices('source')).toEqual([2 + 2*4 + 2*16]);
    expect(smaller.indices('barrier')).toEqual([]);
  });

  it.each([
    ['non-array', { sources: '4' }],
    ['fractional', { sources: [1.5] }],
    ['negative', { barriers: [-1] }],
    ['out of bounds', { sources: [8 ** 3] }],
    ['overlapping', { sources: [7], barriers: [7] }],
  ])('rejects %s snapshot intervention indices', (_case, fields) => {
    expect(() => parseSnapshotJSON(JSON.stringify({ ...snapshot(), ...fields }))).toThrow();
  });

  it('accepts legacy snapshots without interventions or environment', () => {
    const legacy = snapshot({ v: 1, environment: undefined, sources: undefined, barriers: undefined });
    const parsed = parseSnapshotJSON(JSON.stringify(legacy));
    expect(parsed.environment).toBeUndefined();
    expect(parsed.sources).toBeUndefined();
    expect(parsed.barriers).toBeUndefined();
  });
});
