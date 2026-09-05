import type { Locale } from '../i18n';
import type { Rule } from './rules';

function runs(values: readonly number[]): string[] {
  const parts: string[] = [];
  for (let i = 0; i < values.length;) {
    let end = i;
    while (end + 1 < values.length && values[end + 1] === values[end]! + 1) end++;
    parts.push(end > i ? `${values[i]}–${values[end]}` : String(values[i]));
    i = end + 1;
  }
  return parts;
}

export function formatNeighborCounts(counts: ReadonlySet<number>, locale: Locale): string {
  const values = [...counts].sort((a, b) => a - b);
  if (!values.length) return locale === 'zh' ? '永不' : 'never';
  return runs(values).join(locale === 'zh' ? '、' : ', ');
}

export function ruleConditionLabel(rule: Rule, locale: Locale): string {
  const birth = formatNeighborCounts(rule.birth, locale);
  const survive = formatNeighborCounts(rule.survive, locale);
  return locale === 'zh' ? `新生 ${birth} · 保留 ${survive}` : `Birth ${birth} · Survive ${survive}`;
}

export function ruleExplanation(rule: Rule, locale: Locale): { empty: string; live: string } {
  const birth = formatNeighborCounts(rule.birth, locale);
  const survive = formatNeighborCounts(rule.survive, locale);
  if (locale === 'zh') {
    return {
      empty: rule.birth.size ? `空格子：周围有 ${birth} 个活细胞时，下一步长出细胞；否则保持空白。` : '空格子：无论周围有多少活细胞，下一步都保持空白。',
      live: rule.survive.size ? `已有细胞：周围有 ${survive} 个活细胞时，下一步保留；否则消失。` : '已有细胞：下一步全部消失。',
    };
  }
  return {
    empty: rule.birth.size ? `Empty cell: grows when ${birth} neighbors are alive; otherwise stays empty.` : 'Empty cell: never grows, regardless of its neighbors.',
    live: rule.survive.size ? `Live cell: remains when ${survive} neighbors are alive; otherwise disappears.` : 'Live cell: always disappears on the next step.',
  };
}
