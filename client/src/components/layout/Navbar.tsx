import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Overview', target: 'section-overview' },
  { label: 'Fleet', target: 'section-fleet' },
  { label: 'Features', target: 'section-features' },
];

const SECTION_IDS = ['section-hero', 'section-overview', 'section-fleet', 'section-features', 'section-cta'];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setScrolled(window.scrollY > 20);

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
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 pointer-events-none ${scrolled ? 'bg-brand-dark/90 backdrop-blur-md border-b border-white/[0.05]' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between pointer-events-auto">
        <Link to="/" className="font-display font-extrabold text-2xl text-brand-text tracking-tight cursor-pointer">
          Omda<span className="text-brand-red">.</span>
        </Link>

        <div className="hidden md:flex items-center gap-9">
          {NAV_LINKS.map(({ label, target }) => (
            <button
              key={target}
              onClick={() => scrollToSection(target)}
              className={`cursor-pointer text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors duration-300 ${active === target ? 'text-brand-red' : 'text-brand-muted hover:text-brand-text'}`}
            >
              {label}
            </button>
          ))}
          <Link
            to="/login"
            className="cursor-pointer px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark transition-colors duration-300"
          >
            Admin
          </Link>
        </div>

        <button
          className="md:hidden cursor-pointer flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden pointer-events-auto bg-brand-surface/95 backdrop-blur-md border-t border-white/[0.05] px-6 py-5 flex flex-col gap-5">
          {NAV_LINKS.map(({ label, target }) => (
            <button
              key={target}
              onClick={() => { scrollToSection(target); setMenuOpen(false); }}
              className={`cursor-pointer text-left text-xs font-semibold tracking-[0.2em] uppercase ${active === target ? 'text-brand-red' : 'text-brand-muted'}`}
            >
              {label}
            </button>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)} className="cursor-pointer text-xs font-semibold tracking-[0.2em] uppercase text-brand-red">Admin →</Link>
        </div>
      )}
    </nav>
  );
}
