import { useI18n } from '../../i18n';
import { useAgency } from '../../context/AgencyContext';
import { useBusinessSettings } from '../../services/settings';

export default function HeroSection() {
  const { t } = useI18n();
  const { agency } = useAgency();
  const settings = useBusinessSettings();
  const own = agency.isPlatform ? null : settings;

  // The agency's real numbers (or the platform's), never the same figures for everyone
  const s = agency.stats;
  const p = agency.platformStats;
  const stats = p
    ? [
      { value: String(p.agencies), label: t('platform.statAgencies') },
      p.cities > 0 ? { value: String(p.cities), label: t('platform.statCities') } : { value: '24/7', label: t('hero.statSupport') },
      { value: String(p.trialDays), label: t('platform.statTrial') },
    ]
    : [
      { value: String(s?.cars ?? 0), label: t('hero.statAvailable') },
      s && s.customers >= 10
        ? { value: `${s.customers}+`, label: t('hero.statCustomers') }
        : { value: String(s?.since ?? new Date().getFullYear()), label: t('hero.statSince') },
      { value: '24/7', label: t('hero.statSupport') },
    ];
  const tag = own?.siteTag || t(agency.isPlatform ? 'platform.heroTag' : 'hero.tag');
  const line1 = own?.siteTitle1 || t(agency.isPlatform ? 'platform.heroLine1' : 'hero.line1');
  const line2 = own?.siteTitle2 || t(agency.isPlatform ? 'platform.heroLine2' : 'hero.line2');
  const text = own?.siteText || t(agency.isPlatform ? 'platform.heroText' : 'hero.text');

  return (
    <section id="section-hero" className="relative min-h-screen flex items-end pointer-events-none px-6 pb-24">
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <p className="section-tag opacity-0 animate-fade-down" style={{ animationDelay: '0.2s' }}>{tag}</p>
          <h1 className="font-display font-black uppercase text-[clamp(56px,12vw,160px)] leading-[0.9] tracking-tight text-brand-text mb-6">
            <span className="block opacity-0 animate-fade-up" style={{ animationDelay: '0.45s' }}>{line1}</span>
            <span className="block stroke-text opacity-0 animate-fade-up" style={{ animationDelay: '0.6s' }}>{line2}</span>
          </h1>
          <p className="text-brand-muted text-base md:text-lg leading-relaxed mb-8 max-w-md opacity-0 animate-fade-up" style={{ animationDelay: '0.8s' }}>
            {text}
          </p>
          {agency.isPlatform ? (
            // General page: owners create an agency or log in; no fleet to browse here
            <div className="flex flex-wrap gap-3 opacity-0 animate-fade-up" style={{ animationDelay: '0.95s' }}>
              <a href="/signup" className="pointer-events-auto cursor-pointer inline-flex items-center gap-3 px-7 py-3.5 text-xs font-semibold tracking-[0.15em] uppercase bg-brand-red text-white hover:brightness-110 transition">
                {t('platform.create')}
              </a>
              <a href="/login" className="pointer-events-auto cursor-pointer inline-flex items-center gap-3 px-7 py-3.5 text-xs font-semibold tracking-[0.15em] uppercase border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark transition-colors duration-300">
                {t('platform.login')}
              </a>
            </div>
          ) : (
          <a
              href="#section-fleet"
              className="pointer-events-auto cursor-pointer inline-flex items-center gap-3 px-7 py-3.5 text-xs font-semibold tracking-[0.15em] uppercase border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark transition-colors duration-300 opacity-0 animate-fade-up"
              style={{ animationDelay: '0.95s' }}
            >
              {t('hero.cta')}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rtl:rotate-180"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          )}
        </div>
      </div>

      <div className="absolute end-6 bottom-24 z-10 hidden md:flex flex-col items-end gap-6 opacity-0 animate-slide-in-right" style={{ animationDelay: '1s' }}>
        <div className="flex gap-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-end">
              <p className="font-display text-3xl font-bold text-brand-red tracking-tight" dir="ltr">{value}</p>
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 opacity-0 animate-fade-in" style={{ animationDelay: '1.3s' }}>
          <span className="text-[10px] text-brand-muted uppercase tracking-[0.2em]">{t('hero.scroll')}</span>
          <span className="w-10 h-px bg-gradient-to-l from-brand-red to-transparent animate-pulse" />
        </div>
      </div>
    </section>
  );
}
