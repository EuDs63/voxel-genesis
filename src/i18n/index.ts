/**
 * Lightweight i18n: dictionaries + t(key) + setLocale that re-renders static DOM.
 */
import { en, type MessageKey } from './en';
import { zh } from './zh';

export type Locale = 'en' | 'zh';
export type { MessageKey };

export const LOCALES: readonly Locale[] = ['en', 'zh'] as const;

export const LOCALE_STORAGE_KEY = 'voxel-genesis-locale';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, zh };

let current: Locale = 'en';
const listeners = new Set<() => void>();

export type NavigatorLike = {
  language?: string;
  languages?: readonly string[];
};

/** Prefer zh* from navigator.languages / language; otherwise English. */
export function detectBrowserLocale(nav?: NavigatorLike | null): Locale {
  const languages =
    nav?.languages && nav.languages.length > 0
      ? [...nav.languages]
      : nav?.language
        ? [nav.language]
        : [];
  for (const lang of languages) {
    if (typeof lang === 'string' && lang.toLowerCase().startsWith('zh')) return 'zh';
  }
  return 'en';
}

export function readStoredLocale(
  storage?: Pick<Storage, 'getItem'> | null,
): Locale | null {
  try {
    const raw = storage?.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'en' || raw === 'zh') return raw;
  } catch {
    /* private mode / blocked */
  }
  return null;
}

export function writeStoredLocale(
  locale: Locale,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

/** localStorage override, else browser language. */
export function resolveInitialLocale(opts?: {
  storage?: Pick<Storage, 'getItem'> | null;
  navigator?: NavigatorLike | null;
}): Locale {
  const stored = readStoredLocale(
    opts?.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null),
  );
  if (stored) return stored;
  return detectBrowserLocale(
    opts?.navigator ?? (typeof navigator !== 'undefined' ? navigator : null),
  );
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey | string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[current];
  let text =
    (dict as Record<string, string>)[key] ??
    (en as Record<string, string>)[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function onLocaleChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Apply data-i18n / data-i18n-title / data-i18n-aria / data-i18n-placeholder. */
export function applyStaticDOM(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.title = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key) return;
    el.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    (el as HTMLInputElement).placeholder = t(key);
  });
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
    const title = document.querySelector('title');
    if (title) title.textContent = t('meta.title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.description'));
  }
}

export function setLocale(locale: Locale, opts?: { persist?: boolean }): void {
  if (locale !== 'en' && locale !== 'zh') return;
  current = locale;
  if (opts?.persist !== false) {
    writeStoredLocale(
      locale,
      typeof localStorage !== 'undefined' ? localStorage : null,
    );
  }
  if (typeof document !== 'undefined') {
    applyStaticDOM(document);
    syncLangToggle(document);
  }
  for (const cb of listeners) cb();
}

export function initLocale(opts?: {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  navigator?: NavigatorLike | null;
}): Locale {
  const locale = resolveInitialLocale(opts);
  current = locale;
  if (typeof document !== 'undefined') {
    applyStaticDOM(document);
    syncLangToggle(document);
  }
  return locale;
}

export function syncLangToggle(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-locale]').forEach((btn) => {
    const loc = btn.getAttribute('data-locale');
    btn.classList.toggle('active', loc === current);
    btn.setAttribute('aria-pressed', loc === current ? 'true' : 'false');
  });
}

/** Same keys in every locale (no missing translations). */
export function assertLocaleKeyParity(): { ok: true } | { ok: false; missing: string[] } {
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  const missing: string[] = [];
  for (const k of enKeys) {
    if (!(k in zh) || !zh[k as MessageKey]) missing.push(`zh missing: ${k}`);
  }
  for (const k of zhKeys) {
    if (!(k in en)) missing.push(`en missing: ${k}`);
  }
  return missing.length ? { ok: false, missing } : { ok: true };
}

export function ruleNameKey(id: string): MessageKey {
  return `rule.${id}.name` as MessageKey;
}
export function ruleDescKey(id: string): MessageKey {
  return `rule.${id}.desc` as MessageKey;
}
export function seedNameKey(id: string): MessageKey {
  return `seed.${id}.name` as MessageKey;
}
export function seedDescKey(id: string): MessageKey {
  return `seed.${id}.desc` as MessageKey;
}
export function symmetryKey(id: string): MessageKey {
  return `symmetry.${id}` as MessageKey;
}
export function cameraKey(id: string): MessageKey {
  return `camera.${id}` as MessageKey;
}
