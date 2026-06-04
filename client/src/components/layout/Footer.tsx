export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-brand-surface mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <p className="font-display font-extrabold text-xl text-brand-text mb-2">
            Omda<span className="text-brand-red">.</span>
          </p>
          <p className="text-sm text-brand-muted">Premium car rental. Drive what you love.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-text mb-3">Quick Links</p>
          <div className="flex flex-col gap-2">
            {['Cars', 'Features'].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-brand-muted hover:text-brand-red transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-text mb-3">Contact</p>
          <p className="text-sm text-brand-muted">omda@omdarentcar.tn</p>
          <p className="text-sm text-brand-muted mt-1">24/7 support available</p>
        </div>
      </div>
      <div className="border-t border-white/5 px-6 py-4 text-center">
        <p className="text-xs text-brand-muted">© {new Date().getFullYear()} Omda Rent Car. All rights reserved.</p>
      </div>
    </footer>
  );
}
