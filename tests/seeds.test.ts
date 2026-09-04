import { describe, it, expect } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { SEEDS, applySeed, getSeedById, DEFAULT_SEED_ID } from '../src/sim/seeds';
import { stepInPlace } from '../src/sim/ca';
import { getDefaultRule } from '../src/sim/rules';

describe('seeds', () => {
  it('all seeds apply and produce live cells', () => {
    for (const seed of SEEDS) {
      const g = new Grid3D(24);
      expect(applySeed(g, seed.id)).toBe(true);
      expect(g.population).toBeGreaterThan(0);
      expect(g.population).toBeLessThan(24 * 24 * 24 * 0.25);
    }
  });

  it('default seed exists', () => {
    expect(getSeedById(DEFAULT_SEED_ID)?.name).toBe('Genesis Spark');
  });

  it('includes evocative named seeds', () => {
    const names = SEEDS.map((s) => s.id);
    expect(names).toContain('crystal-seed');
    expect(names).toContain('void-mandala');
    expect(names).toContain('breathing-lattice');
  });

  it('default seed + rule does not fill the grid in 20 steps', () => {
    const g = new Grid3D(24);
    const scratch = new Grid3D(24);
    applySeed(g, DEFAULT_SEED_ID);
    const rule = getDefaultRule();
    for (let i = 0; i < 20; i++) {
      stepInPlace(g, scratch, rule, 'clamp');
    }
    const fill = g.population / g.volume;
    expect(fill).toBeLessThan(0.45);
  });
});
