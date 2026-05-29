import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-brand-dark/95 backdrop-blur-md border-b border-white/5 shadow-xl' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display font-extrabold text-xl text-brand-text tracking-tight">
          Omda<span className="text-brand-red">.</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {['Cars', 'Features'].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className="text-sm text-brand-muted hover:text-brand-text transition-colors"
            >
              {label}
            </a>
          ))}
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500 transition-colors"
          >
            Admin
          </Link>
        </div>

        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-brand-text transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-brand-surface border-t border-white/5 px-6 py-4 flex flex-col gap-4">
          <a href="#cars" onClick={() => setMenuOpen(false)} className="text-sm text-brand-muted">Cars</a>
          <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm text-brand-muted">Features</a>
          <Link to="/login" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-brand-red">Admin →</Link>
        </div>
      )}
    </nav>
  );
}
