import { useI18n } from '../../i18n';

export default function FeaturesSection() {
  const { t } = useI18n();
  const features = [
    { num: '01', title: t('features.f1Title'), desc: t('features.f1Desc') },
    { num: '02', title: t('features.f2Title'), desc: t('features.f2Desc') },
    { num: '03', title: t('features.f3Title'), desc: t('features.f3Desc') },
    { num: '04', title: t('features.f4Title'), desc: t('features.f4Desc') },
  ];

  return (
    <section id="section-features" className="relative min-h-screen flex items-end pointer-events-none px-6 py-24">
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className="section-tag">{t('features.tag')}</p>
        <h2 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[0.92] tracking-tight text-brand-text mb-10">{t('features.title')}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px max-w-3xl bg-white/[0.06]">
          {features.map(({ num, title, desc }) => (
            <div key={num} className="bg-brand-dark/80 backdrop-blur-sm p-7">
              <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-red mb-3">{num}</p>
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-brand-text mb-2">{title}</h3>
              <p className="text-xs leading-[1.7] text-brand-muted">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
