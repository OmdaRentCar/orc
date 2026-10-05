import { ReactNode, useEffect, useState } from 'react';
import { loadInfo, PlatformInfo } from './api';
import { useI18n, TKey } from '../i18n';
import LanguageSwitcher from '../components/public/LanguageSwitcher';
import BrandName from '../components/layout/BrandName';

export function usePlatformInfo(): PlatformInfo | null {
  const [p, setP] = useState<PlatformInfo | null>(null);
  useEffect(() => { loadInfo().then(setP).catch(() => {}); }, []);
  return p;
}

export function Logo({ name }: { name?: string }) {
  return <span className="font-display font-extrabold text-2xl text-brand-text tracking-tight">{name ?? 'RentCar'}<span className="text-brand-red">.</span></span>;
}

// Same sections as the general page's menu: these pages are part of it
const LINKS: { label: TKey; href: string }[] = [
  { label: 'platform.navFeatures', href: '/#section-p-features' },
  { label: 'platform.navPricing', href: '/#section-pricing' },
  { label: 'platform.navAgencies', href: '/#section-agencies' },
  { label: 'platform.navFaq', href: '/#section-faq' },
];

// Frame of the sign-up and login pages: the general page's header and footer, in the visitor's language
export default function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const link = 'text-[11px] font-semibold tracking-[0.2em] uppercase text-brand-muted hover:text-brand-text transition-colors';

  return (
    <div className="min-h-screen bg-brand-dark text-brand-text flex flex-col">
      <header className="sticky top-0 z-40 bg-brand-dark/90 backdrop-blur-md border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="font-display font-extrabold text-2xl tracking-tight" dir="ltr"><BrandName /></a>
          <nav className="hidden md:flex items-center gap-7">
            {LINKS.map((l) => <a key={l.href} href={l.href} className={link}>{t(l.label)}</a>)}
            <LanguageSwitcher />
            <a href="/login" className={link}>{t('platform.login')}</a>
            <a href="/signup" className="px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase bg-brand-red text-white hover:brightness-110 transition">{t('platform.create')}</a>
          </nav>
          <button className="md:hidden flex flex-col gap-1.5 p-2" onClick={() => setOpen(!open)} aria-label={t('nav.menu')} aria-expanded={open}>
            <span className="block w-5 h-0.5 bg-brand-text" /><span className="block w-5 h-0.5 bg-brand-text" /><span className="block w-5 h-0.5 bg-brand-text" />
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/[0.05] px-6 py-5 flex flex-col gap-5 bg-brand-surface/95">
            {LINKS.map((l) => <a key={l.href} href={l.href} className={link}>{t(l.label)}</a>)}
            <LanguageSwitcher className="-ms-2" />
            <a href="/login" className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-text">{t('platform.login')}</a>
            <a href="/signup" className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-red">{t('platform.create')} →</a>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-brand-muted max-w-sm">{t('platform.footerTagline')}</p>
          <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em]">© {new Date().getFullYear()} <BrandName dot={false} /> — {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
