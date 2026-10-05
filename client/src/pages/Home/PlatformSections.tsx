import { useEffect, useState } from 'react';
import { useI18n, TKey } from '../../i18n';
import { apiJSON } from '../../services/api';
import { useAgency } from '../../context/AgencyContext';

// Sections of the general page (the platform's own address): it speaks to agency owners.
// Same look as the agencies' 3D site; no fleet and no booking here, those live on each agency's site.

const section = 'relative min-h-screen flex items-center pointer-events-none px-6 py-24';
const tagCls = 'section-tag';
const titleCls = 'font-display text-[clamp(36px,5vw,72px)] font-extrabold uppercase leading-[0.92] tracking-tight text-brand-text mb-10';

export function PlatformFeatures() {
  const { t } = useI18n();
  const items = [1, 2, 3, 4, 5, 6] as const;
  return (
    <section id="section-p-features" className={section}>
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className={tagCls}>{t('platform.featuresTag')}</p>
        <h2 className={titleCls}>{t('platform.featuresTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] max-w-5xl">
          {items.map((n) => (
            <div key={n} className="bg-brand-dark/80 backdrop-blur-sm p-7">
              <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-red mb-3">0{n}</p>
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-brand-text mb-2">{t(`platform.f${n}T` as TKey)}</h3>
              <p className="text-xs leading-[1.7] text-brand-muted">{t(`platform.f${n}D` as TKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section id="section-how" className={section}>
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className={tagCls}>{t('platform.howTag')}</p>
        <h2 className={titleCls}>{t('platform.howTitle')}</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="border-t border-brand-red/40 pt-6 bg-brand-dark/60 backdrop-blur-sm pe-6 pb-6">
              <p className="font-display text-6xl font-black text-brand-red/80 leading-none">{n}</p>
              <h3 className="font-display text-xl font-bold uppercase tracking-wide text-brand-text mt-4 mb-2">{t(`platform.s${n}T` as TKey)}</h3>
              <p className="text-sm leading-[1.7] text-brand-muted">{t(`platform.s${n}D` as TKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Plan { id: string; name: string; monthly: number; maxCars: number | null; highlights: string[]; highlightsEn: string[]; highlightsAr: string[] }

export function Pricing() {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [yearly, setYearly] = useState(false);
  useEffect(() => {
    apiJSON<{ plans: Plan[]; trialDays: number }>('/platform/info').then((i) => { setPlans(i.plans); setTrialDays(i.trialDays); }).catch(() => {});
  }, []);
  const lines = (p: Plan) => (lang === 'fr' ? p.highlights : lang === 'ar' ? p.highlightsAr : p.highlightsEn);

  return (
    <section id="section-pricing" className={section}>
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className={tagCls}>{t('platform.pricingTag')}</p>
        <h2 className={titleCls}>{t('platform.pricingTitle')}</h2>
        <div className="inline-flex border border-white/10 mb-8 text-[11px] font-semibold tracking-[0.15em] uppercase">
          <button onClick={() => setYearly(false)} className={`cursor-pointer px-5 py-2.5 ${!yearly ? 'bg-brand-red text-white' : 'text-brand-muted hover:text-brand-text'}`}>{t('platform.monthly')}</button>
          <button onClick={() => setYearly(true)} className={`cursor-pointer px-5 py-2.5 ${yearly ? 'bg-brand-red text-white' : 'text-brand-muted hover:text-brand-text'}`}>{t('platform.yearly')}</button>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl">
          {plans.map((p) => (
            <div key={p.id} className={`relative flex flex-col p-7 backdrop-blur-sm border ${p.id === 'pro' ? 'bg-brand-red/[0.08] border-brand-red/40' : 'bg-brand-dark/80 border-white/[0.08]'}`}>
              {p.id === 'pro' && <span className="absolute -top-3 start-7 px-2.5 py-1 bg-brand-red text-white text-[10px] font-bold uppercase tracking-[0.15em]">{t('platform.popular')}</span>}
              <p className="font-display text-2xl font-bold uppercase tracking-wide text-brand-text">{p.name}</p>
              <p className="mt-4 mb-6" dir="ltr">
                <span className="font-display text-5xl font-black text-brand-text">{yearly ? p.monthly * 10 : p.monthly}</span>
                <span className="text-xs text-brand-muted ms-2">{t(yearly ? 'platform.perYear' : 'platform.perMonth')}</span>
              </p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {lines(p).map((h) => <li key={h} className="text-xs text-brand-muted flex gap-2.5"><span className="text-brand-red">✓</span>{h}</li>)}
              </ul>
              <a href={`/signup?plan=${p.id}`} className={`block text-center py-3 text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors ${p.id === 'pro' ? 'bg-brand-red text-white hover:brightness-110' : 'border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark'}`}>
                {t('platform.tryFree', { days: trialDays })}
              </a>
            </div>
          ))}
        </div>
        <p className="text-xs text-brand-muted mt-5">{t('platform.pricingNote')}</p>
      </div>
    </section>
  );
}

interface DirectoryAgency { name: string; slug: string; city: string | null; logoUrl: string | null; color: string; siteUrl: string; cars: number }

export function AgencyDirectory() {
  const { t } = useI18n();
  const { agency } = useAgency();
  const [list, setList] = useState<DirectoryAgency[] | null>(null);
  useEffect(() => { apiJSON<DirectoryAgency[]>('/platform/agencies').then(setList).catch(() => setList([])); }, []);

  return (
    <section id="section-agencies" className={section}>
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className={tagCls}>{t('platform.agenciesTag')}</p>
        <h2 className={titleCls}>{t('platform.agenciesTitle', { brand: agency.name })}</h2>
        {list && list.length === 0 ? (
          <p className="text-brand-muted text-sm">{t('platform.agenciesEmpty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl">
            {(list ?? []).map((a) => (
              <a key={a.slug} href={a.siteUrl} className="group flex items-center gap-4 p-5 bg-brand-dark/80 backdrop-blur-sm border border-white/[0.08] hover:border-brand-red/40 transition-colors">
                <span className="w-14 h-14 flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: a.color }}>
                  {a.logoUrl ? <img src={a.logoUrl} alt="" className="w-full h-full object-contain bg-white" /> : <span className="font-display text-2xl font-black text-white">{a.name[0]}</span>}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-lg font-bold uppercase tracking-wide text-brand-text truncate">{a.name}</span>
                  <span className="block text-[11px] text-brand-muted uppercase tracking-[0.15em]">{a.city ? `${a.city} · ` : ''}{t('platform.carsCount', { count: a.cars })}</span>
                  <span className="block text-[11px] text-brand-red mt-1.5 group-hover:translate-x-0.5 transition-transform">{t('platform.visit')} →</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="section-faq" className={section}>
      <div className="max-w-3xl w-full mx-auto pointer-events-auto">
        <p className={tagCls}>{t('platform.faqTag')}</p>
        <h2 className={titleCls}>{t('platform.faqTitle')}</h2>
        <div className="space-y-px bg-white/[0.06]">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <div key={n} className="bg-brand-dark/85 backdrop-blur-sm">
              <button onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n} className="cursor-pointer w-full flex items-center justify-between gap-4 px-6 py-5 text-start text-sm font-semibold text-brand-text">
                {t(`platform.q${n}` as TKey)}<span className="text-brand-red text-lg">{open === n ? '−' : '+'}</span>
              </button>
              {open === n && <p className="px-6 pb-5 text-sm leading-[1.7] text-brand-muted">{t(`platform.a${n}` as TKey)}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlatformCallToAction() {
  const { t } = useI18n();
  return (
    <div className="max-w-7xl mx-auto px-6 mb-16 pointer-events-auto">
      <div className="border border-brand-red/30 bg-brand-red/[0.08] backdrop-blur-sm p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-brand-text">{t('platform.ctaTitle')}</h2>
          <p className="text-sm text-brand-muted mt-2">{t('platform.ctaText')}</p>
        </div>
        <a href="/signup" className="flex-shrink-0 px-7 py-3.5 bg-brand-red text-white text-[11px] font-semibold tracking-[0.2em] uppercase hover:brightness-110">{t('platform.create')}</a>
      </div>
    </div>
  );
}
