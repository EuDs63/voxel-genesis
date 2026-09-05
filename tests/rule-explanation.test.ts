import { formatNeighborCounts, ruleConditionLabel, ruleExplanation } from '../src/sim/rule-explanation';
import { parseRuleNotation } from '../src/sim/rules';

describe('plain-language rule explanations', () => {
  it('formats ranges and discrete counts without merging gaps', () => {
    expect(formatNeighborCounts(new Set([1, 2, 3, 6, 8, 9]), 'zh')).toBe('1–3、6、8–9');
    expect(formatNeighborCounts(new Set([1, 3]), 'en')).toBe('1, 3');
    expect(ruleConditionLabel(parseRuleNotation('B4/S4-5'), 'zh')).toBe('新生 4 · 保留 4–5');
    expect(ruleConditionLabel(parseRuleNotation('B10-12/S9-14'), 'en')).toBe('Birth 10–12 · Survive 9–14');
  });

  it('explains empty birth and survival sets explicitly in both languages', () => {
    const rule = parseRuleNotation('B/S');
    expect(formatNeighborCounts(rule.birth, 'zh')).toBe('永不');
    expect(ruleExplanation(rule, 'zh')).toEqual({
      empty: '空格子：无论周围有多少活细胞，下一步都保持空白。',
      live: '已有细胞：下一步全部消失。',
    });
    expect(ruleExplanation(rule, 'en').empty).toContain('never grows');
    expect(ruleExplanation(rule, 'en').live).toContain('always disappears');
  });
});
