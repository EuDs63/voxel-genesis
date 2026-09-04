import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectBrowserLocale,
  resolveInitialLocale,
  setLocale,
  getLocale,
  t,
  assertLocaleKeyParity,
  LOCALE_STORAGE_KEY,
  type NavigatorLike,
} from '../src/i18n';
import { RULE_PRESETS } from '../src/sim/rules';
import { SEEDS } from '../src/sim/seeds';
import { SYMMETRY_OPTIONS } from '../src/sim/symmetry';
import { CAMERA_PRESETS } from '../src/render/camera';

describe('assertLocaleKeyParity', () => {
  it('en and zh share the same keys with non-empty values', () => {
    const result = assertLocaleKeyParity();
    expect(result).toEqual({ ok: true });
  });
});

describe('detectBrowserLocale', () => {
  it('returns zh when language starts with zh', () => {
    expect(detectBrowserLocale({ language: 'zh-CN' })).toBe('zh');
    expect(detectBrowserLocale({ language: 'zh-TW' })).toBe('zh');
    expect(detectBrowserLocale({ language: 'zh' })).toBe('zh');
  });

  it('returns zh when any languages entry starts with zh', () => {
    const nav: NavigatorLike = { language: 'en-US', languages: ['en-US', 'zh-CN'] };
    expect(detectBrowserLocale(nav)).toBe('zh');
  });

  it('returns en for non-Chinese locales', () => {
    expect(detectBrowserLocale({ language: 'en-US' })).toBe('en');
    expect(detectBrowserLocale({ language: 'ja-JP' })).toBe('en');
    expect(detectBrowserLocale({ languages: ['fr-FR', 'de'] })).toBe('en');
  });

  it('defaults to en when navigator is empty', () => {
    expect(detectBrowserLocale(null)).toBe('en');
    expect(detectBrowserLocale({})).toBe('en');
  });
});

describe('resolveInitialLocale', () => {
  it('prefers localStorage over browser language', () => {
    const store = new Map<string, string>([[LOCALE_STORAGE_KEY, 'en']]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
    };
    expect(
      resolveInitialLocale({
        storage,
        navigator: { language: 'zh-CN' },
      }),
    ).toBe('en');
  });

  it('falls back to browser when storage empty', () => {
    const storage = { getItem: () => null };
    expect(
      resolveInitialLocale({
        storage,
        navigator: { language: 'zh-Hans' },
      }),
    ).toBe('zh');
  });
});

describe('t / setLocale', () => {
  beforeEach(() => {
    setLocale('en', { persist: false });
  });

  it('translates keys and interpolates vars', () => {
    expect(t('btn.play')).toBe('Play');
    setLocale('zh', { persist: false });
    expect(t('btn.play')).toBe('播放');
    expect(t('toast.rule', { notation: 'B4/S4-5' })).toBe('规则 B4/S4-5');
    expect(getLocale()).toBe('zh');
  });

  it('covers preset display-name keys for rules, seeds, symmetry, cameras', () => {
    for (const locale of ['en', 'zh'] as const) {
      setLocale(locale, { persist: false });
      for (const p of RULE_PRESETS) {
        expect(t(`rule.${p.id}.name`).length).toBeGreaterThan(0);
        expect(t(`rule.${p.id}.desc`).length).toBeGreaterThan(0);
        expect(t(`rule.${p.id}.name`)).not.toBe(`rule.${p.id}.name`);
      }
      for (const s of SEEDS) {
        expect(t(`seed.${s.id}.name`).length).toBeGreaterThan(0);
        expect(t(`seed.${s.id}.desc`).length).toBeGreaterThan(0);
      }
      for (const s of SYMMETRY_OPTIONS) {
        expect(t(`symmetry.${s.id}`).length).toBeGreaterThan(0);
      }
      for (const c of CAMERA_PRESETS) {
        expect(t(`camera.${c.id}`).length).toBeGreaterThan(0);
      }
    }
  });
});
