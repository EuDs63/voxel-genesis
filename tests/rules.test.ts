import { describe, it, expect } from 'vitest';
import {
  parseCountList,
  parseRuleNotation,
  formatNotation,
  shouldLive,
  ruleFromPreset,
  getPresetById,
  RULE_PRESETS,
  DEFAULT_RULE_ID,
} from '../src/sim/rules';

describe('parseCountList', () => {
  it('parses singles, ranges, and lists', () => {
    expect([...parseCountList('5')].sort((a, b) => a - b)).toEqual([5]);
    expect([...parseCountList('4-6')].sort((a, b) => a - b)).toEqual([4, 5, 6]);
    expect([...parseCountList('5-8,10')].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 10]);
  });

  it('rejects out of range', () => {
    expect(() => parseCountList('27')).toThrow();
    expect(() => parseCountList('-1')).toThrow();
  });
});

describe('parseRuleNotation', () => {
  it('parses canonical B/S', () => {
    const r = parseRuleNotation('B4/S4-5');
    expect([...r.birth].sort((a, b) => a - b)).toEqual([4]);
    expect([...r.survive].sort((a, b) => a - b)).toEqual([4, 5]);
    expect(r.notation).toBe('B4/S4-5');
  });

  it('is case-insensitive and ignores spaces', () => {
    const r = parseRuleNotation(' b4,5,6 / s5-7 ');
    expect(r.notation).toBe('B4-6/S5-7');
  });

  it('rejects garbage', () => {
    expect(() => parseRuleNotation('Conway')).toThrow();
    expect(() => parseRuleNotation('B2/3')).toThrow();
  });
});

describe('formatNotation', () => {
  it('compacts contiguous ranges', () => {
    expect(formatNotation(new Set([4, 5, 6]), new Set([5, 7]))).toBe('B4-6/S5,7');
  });
});

describe('shouldLive', () => {
  const rule = parseRuleNotation('B4/S4-5');
  it('births and survives correctly', () => {
    expect(shouldLive(false, 4, rule)).toBe(true);
    expect(shouldLive(false, 3, rule)).toBe(false);
    expect(shouldLive(true, 5, rule)).toBe(true);
    expect(shouldLive(true, 3, rule)).toBe(false);
  });
});

describe('presets', () => {
  it('all presets parse and are not Conway 2333', () => {
    for (const p of RULE_PRESETS) {
      const r = ruleFromPreset(p);
      expect(r.notation).toBe(p.notation);
      expect(r.notation).not.toBe('B3/S2-3');
    }
    expect(DEFAULT_RULE_ID).toBe('ember-breath');
    expect(getPresetById('ember-breath')?.notation).toBe('B4/S4-5');
    expect(getPresetById('crystal-veins')?.notation).toBe('B5/S5-6');
  });

  it('favors narrow birth sets to avoid instant fill', () => {
    for (const p of RULE_PRESETS) {
      const r = ruleFromPreset(p);
      // No preset should birth on more than 6 distinct neighbor counts
      expect(r.birth.size).toBeLessThanOrEqual(6);
    }
  });
});
