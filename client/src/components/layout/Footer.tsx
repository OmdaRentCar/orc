export default function Footer() {
  return (
    <footer className="w-full pointer-events-auto px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="border-t border-white/10 pt-10 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p className="font-display font-extrabold text-2xl text-brand-text tracking-tight mb-2">
              Omda<span className="text-brand-red">.</span>
            </p>
            <p className="text-xs text-brand-muted leading-relaxed max-w-[220px]">Premium car rental. Drive what you love.</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-[0.2em] mb-4">Quick Links</p>
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Overview', target: 'section-overview' },
                { label: 'Fleet', target: 'section-fleet' },
                { label: 'Features', target: 'section-features' },
              ].map(({ label, target }) => (
                <button
                  key={target}
                  onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })}
                  className="cursor-pointer text-left text-xs text-brand-muted hover:text-brand-red transition-colors uppercase tracking-[0.15em]"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-[0.2em] mb-4">Contact</p>
            <p className="text-xs text-brand-text">omda@omdarentcar.tn</p>
            <p className="text-xs text-brand-muted mt-1.5 uppercase tracking-[0.15em]">24/7 support available</p>
          </div>
        </div>
        <div className="border-t border-white/10 mt-10 pt-6">
          <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] text-right">© {new Date().getFullYear()} Omda Rent Car — All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
