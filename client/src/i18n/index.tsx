import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import en, { Dictionary } from './en';
import fr from './fr';
import ar from './ar';
import { useAgency } from '../context/AgencyContext';

export type Lang = 'en' | 'fr' | 'ar';
export const LANGS: Lang[] = ['en', 'fr', 'ar'];

const DICTIONARIES: Record<Lang, Dictionary> = { en, fr, ar };
// Used by Intl for dates and month names
export const INTL_LOCALE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-TN' };

// "booking.errors.name"-style paths to every string in the dictionary
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string];
export type TKey = Paths<Dictionary>;

interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  money: (amount: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.includes(saved as Lang)) return saved as Lang;
  } catch {}
  const browser = navigator.language.slice(0, 2);
  return LANGS.includes(browser as Lang) ? (browser as Lang) : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const { agency } = useAgency();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  // Only the public site is translated; restore English + LTR when leaving it (e.g. for the admin area)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, [lang, dir]);

  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => {
    const lookup = (dict: Dictionary) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dict);
    const text = (lookup(DICTIONARIES[lang]) ?? lookup(en) ?? key) as string;
    const all: Record<string, string | number> = { brand: agency.name, ...vars };
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in all ? String(all[name]) : vars ? '' : match));
  }, [lang, agency.name]);

  const formatDate = useCallback((iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    // Plain YYYY-MM-DD dates are formatted in UTC so they never shift by a day
    return new Intl.DateTimeFormat(INTL_LOCALE[lang], { ...opts, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  }, [lang]);

  // "438 DT", or "438 د.ت" in Arabic so it reads correctly right to left
  const money = useCallback((amount: number) => {
    const n = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 3 }).format(Number(amount.toFixed(3)));
    return `${n} ${lang === 'ar' ? 'د.ت' : 'DT'}`;
  }, [lang]);

  const value = useMemo(() => ({ lang, dir, setLang, t, formatDate, money }), [lang, dir, setLang, t, formatDate, money]) as I18nValue;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
