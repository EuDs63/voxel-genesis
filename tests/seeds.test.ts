import { describe, it, expect } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { SEEDS, applySeed, getSeedById, DEFAULT_SEED_ID } from '../src/sim/seeds';
import { stepInPlace } from '../src/sim/ca';
import { getDefaultRule } from '../src/sim/rules';

describe('seeds', () => {
  it('all seeds apply and produce live cells', () => {
    expect(SEEDS.length).toBeGreaterThanOrEqual(20);
    for (const size of [12, 24, 40]) for (const seed of SEEDS) {
      const g = new Grid3D(size);
      expect(applySeed(g, seed.id)).toBe(true);
      expect(g.population).toBeGreaterThan(0);
      expect(g.population).toBeLessThan(g.volume * 0.25);
      expect([...g.cells].every(age => age === 0 || age === 1)).toBe(true);
    }
  });

  it('each catalog shape has distinct 24-grid geometry', () => {
    const hashes = SEEDS.map(seed => {
      const g = new Grid3D(24); seed.apply(g);
      let h = 2166136261;
      for (let i=0;i<g.cells.length;i++) if(g.cells[i]) { h^=i; h=Math.imul(h,16777619); }
      return h>>>0;
    });
    expect(new Set(hashes).size).toBe(SEEDS.length);
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

  it('default 24³ seed is visible and evolves without immediately vanishing', () => {
    const g = new Grid3D(24);
    const scratch = new Grid3D(24);
    applySeed(g, DEFAULT_SEED_ID);
    expect(g.population).toBeGreaterThan(1);
    const rule = getDefaultRule();
    const populations = [g.population];
    for (let i = 0; i < 20; i++) {
      stepInPlace(g, scratch, rule, 'clamp');
      populations.push(g.population);
    }
    const fill = g.population / g.volume;
    expect(fill).toBeLessThan(0.45);
    expect(populations[1]).toBeGreaterThan(0);
    expect(populations.slice(1).some((population) => population !== populations[0])).toBe(true);
    expect(populations.slice(1).some((population) => population > 0)).toBe(true);
  });
});
