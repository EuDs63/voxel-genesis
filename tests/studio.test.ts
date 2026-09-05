import { Grid3D } from '../src/sim/grid';
import { stepInPlace } from '../src/sim/ca';
import { applySeed } from '../src/sim/seeds';
import { getPresetById, ruleFromPreset } from '../src/sim/rules';
import { FEATURED_SCENES } from '../src/ui/featured-scenes';
import { PopulationTrend } from '../src/ui/trend';

describe('studio observations', () => {
  it('keeps each featured setup observable and behaviorally distinct for 20 steps', () => {
    const signatures = new Set<string>();
    for (const feature of FEATURED_SCENES) {
      const grid = new Grid3D(24), scratch = new Grid3D(24); applySeed(grid, feature.seedId);
      const preset = getPresetById(feature.ruleId)!; const rule = ruleFromPreset(preset); const populations = [grid.population];
      for (let i = 0; i < 20; i++) { stepInPlace(grid, scratch, rule); populations.push(grid.population); }
      expect(populations[1], feature.id).toBeGreaterThan(0);
      expect(populations.some((value, index) => index > 0 && value > 0)).toBe(true);
      signatures.add(populations.join(','));
    }
    expect(signatures.size).toBe(FEATURED_SCENES.length);
  });

  it('caps trend samples and resets to a new baseline', () => {
    const trend = new PopulationTrend(3); trend.reset(0, 10);
    trend.push(1, { births: 2, deaths: 1, population: 11 }); trend.push(2, { births: 1, deaths: 3, population: 9 }); trend.push(3, { births: 0, deaths: 2, population: 7 });
    expect(trend.points).toHaveLength(3); expect(trend.points[0]?.generation).toBe(1); expect(trend.path()).toMatch(/^M/);
    trend.reset(8, 42); expect(trend.points).toEqual([{ generation: 8, population: 42, births: 0, deaths: 0 }]);
  });
});
