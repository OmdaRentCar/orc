import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n, TKey } from '../../i18n';
import LanguageSwitcher from '../public/LanguageSwitcher';
import BrandName from './BrandName';
import { IS_PLATFORM } from '../../services/agency';

// Agency site: its sections. General page: the sections for agency owners.
const NAV_LINKS: { label: TKey; target: string }[] = IS_PLATFORM
  ? [
    { label: 'platform.navFeatures', target: 'section-p-features' },
    { label: 'platform.navPricing', target: 'section-pricing' },
    { label: 'platform.navAgencies', target: 'section-agencies' },
    { label: 'platform.navFaq', target: 'section-faq' },
  ]
  : [
    { label: 'nav.overview', target: 'section-overview' },
    { label: 'nav.fleet', target: 'section-fleet' },
    { label: 'nav.features', target: 'section-features' },
  ];

const SECTION_IDS = ['section-hero', 'section-overview', ...NAV_LINKS.map((l) => l.target), 'section-cta'];

export default function Navbar() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const onHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setScrolled(window.scrollY > 20);
      if (!onHome) return;

      const mid = window.innerHeight * 0.45;
      let current = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= mid) current = id;
      }
      setActive(current);
    };
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', handler, { passive: true });
    update();
    return () => window.removeEventListener('scroll', handler);
  }, [onHome]);

  // On other pages the section links go back to the home page, which scrolls to the #hash
  function goToSection(id: string) {
    setMenuOpen(false);
    if (onHome) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else navigate(`/#${id}`);
  }

  const linkClass = (target: string) =>
    `cursor-pointer text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors duration-300 ${onHome && active === target ? 'text-brand-red' : 'text-brand-muted hover:text-brand-text'}`;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 pointer-events-none ${scrolled || !onHome ? 'bg-brand-dark/90 backdrop-blur-md border-b border-white/[0.05]' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between pointer-events-auto">
        <Link to="/" className="font-display font-extrabold text-2xl text-brand-text tracking-tight cursor-pointer" dir="ltr">
          <BrandName />
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ label, target }) => (
            <button key={target} onClick={() => goToSection(target)} className={linkClass(target)}>
              {t(label)}
            </button>
          ))}
          {!IS_PLATFORM && <Link
            to="/booking-status"
            className={`text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors ${location.pathname === '/booking-status' ? 'text-brand-red' : 'text-brand-muted hover:text-brand-text'}`}
          >
            {t('nav.myBooking')}
          </Link>}
          <LanguageSwitcher />
          {IS_PLATFORM ? (
            <>
              <a href="/login" className="text-[11px] font-semibold tracking-[0.2em] uppercase text-brand-muted hover:text-brand-text transition-colors">{t('platform.login')}</a>
              <a href="/signup" className="px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase bg-brand-red text-white hover:brightness-110 transition">{t('platform.create')}</a>
            </>
          ) : (
            <Link
              to="/login"
              className="cursor-pointer px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark transition-colors duration-300"
            >
              {t('nav.admin')}
            </Link>
          )}
        </div>

        <button
          className="md:hidden cursor-pointer flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t('nav.menu')}
          aria-expanded={menuOpen}
        >
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden pointer-events-auto bg-brand-surface/95 backdrop-blur-md border-t border-white/[0.05] px-6 py-5 flex flex-col gap-5">
          {NAV_LINKS.map(({ label, target }) => (
            <button key={target} onClick={() => goToSection(target)} className={`text-start ${linkClass(target)}`}>
              {t(label)}
            </button>
          ))}
          {!IS_PLATFORM && <Link to="/booking-status" onClick={() => setMenuOpen(false)} className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-muted">
            {t('nav.myBooking')}
          </Link>}
          <LanguageSwitcher className="-ms-2" />
          {IS_PLATFORM ? (
            <>
              <a href="/login" className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-text">{t('platform.login')}</a>
              <a href="/signup" className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-red">{t('platform.create')} →</a>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)} className="cursor-pointer text-xs font-semibold tracking-[0.2em] uppercase text-brand-red">
              {t('nav.admin')} →
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
