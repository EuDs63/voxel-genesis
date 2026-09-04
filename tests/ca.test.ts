import { describe, it, expect } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { step, stepInPlace } from '../src/sim/ca';
import { parseRuleNotation } from '../src/sim/rules';

describe('step', () => {
  it('is deterministic', () => {
    const rule = parseRuleNotation('B4-6/S5-7');
    const a = new Grid3D(8);
    a.randomize(0.15, () => {
      // fixed sequence via closure
      return 0.1;
    });
    // Better: paint a known pattern
    const g1 = new Grid3D(8);
    const g2 = new Grid3D(8);
    for (let i = 3; i <= 5; i++)
      for (let j = 3; j <= 5; j++)
        for (let k = 3; k <= 5; k++) {
          g1.set(i, j, k, 1);
          g2.set(i, j, k, 1);
        }
    const n1 = new Grid3D(8);
    const n2 = new Grid3D(8);
    const r1 = step(g1, n1, rule, 'clamp');
    const r2 = step(g2, n2, rule, 'clamp');
    expect(r1).toEqual(r2);
    expect([...n1.cells]).toEqual([...n2.cells]);
  });

  it('ages surviving cells and births at age 1', () => {
    // Rule: everything with 0 neighbors survives/births? Use B0/S0 for isolated
    const rule = parseRuleNotation('B0/S0');
    const g = new Grid3D(5);
    g.set(2, 2, 2, 3);
    const n = new Grid3D(5);
    step(g, n, rule, 'clamp');
    expect(n.get(2, 2, 2)).toBe(4); // aged
  });

  it('clamp vs wrap differ at edges', () => {
    const rule = parseRuleNotation('B1/S1-26');
    const g = new Grid3D(4);
    g.set(0, 0, 0, 1);
    g.set(3, 0, 0, 1);
    const clampNext = new Grid3D(4);
    const wrapNext = new Grid3D(4);
    step(g, clampNext, rule, 'clamp');
    step(g, wrapNext, rule, 'wrap');
    // Under wrap, (0,0,0) and (3,0,0) are neighbors → different dynamics
    expect([...clampNext.cells].join(',')).not.toBe([...wrapNext.cells].join(','));
  });

  it('stepInPlace swaps buffers correctly', () => {
    const rule = parseRuleNotation('B4-6/S5-7');
    const g = new Grid3D(6);
    const scratch = new Grid3D(6);
    g.set(2, 2, 2, 1);
    g.set(2, 2, 3, 1);
    g.set(2, 3, 2, 1);
    g.set(3, 2, 2, 1);
    const before = g.cells.slice();
    stepInPlace(g, scratch, rule, 'clamp');
    expect([...g.cells]).not.toEqual([...before]);
    expect(g.population).toBeGreaterThanOrEqual(0);
  });
});
