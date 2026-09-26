import { useI18n, LANGS } from '../../i18n';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('nav.language')} className={`flex items-center gap-1 ${className}`}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          title={t(`lang.${code}`)}
          className={`cursor-pointer px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${lang === code ? 'text-brand-red' : 'text-brand-muted hover:text-brand-text'}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
