const STATS = [
  { value: '200+', label: 'Premium Cars' },
  { value: '98%', label: 'Satisfaction' },
  { value: '24/7', label: 'Support' },
];

export default function HeroSection() {
  return (
    <section id="section-hero" className="relative min-h-screen flex items-end pointer-events-none px-6 pb-24">
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <p className="section-tag opacity-0 animate-fade-down" style={{ animationDelay: '0.2s' }}>Premium Fleet</p>
          <h1 className="font-display font-black uppercase text-[clamp(56px,12vw,160px)] leading-[0.9] tracking-tight text-brand-text mb-6">
            <span className="block opacity-0 animate-fade-up" style={{ animationDelay: '0.45s' }}>Drive</span>
            <span className="block stroke-text opacity-0 animate-fade-up" style={{ animationDelay: '0.6s' }}>Extraordinary</span>
          </h1>
          <p className="text-brand-muted text-base md:text-lg leading-relaxed mb-8 max-w-md opacity-0 animate-fade-up" style={{ animationDelay: '0.8s' }}>
            Experience luxury and performance with our exclusive fleet of premium vehicles — delivered wherever you are.
          </p>
          <a
            href="#section-fleet"
            className="pointer-events-auto cursor-pointer inline-flex items-center gap-3 px-7 py-3.5 text-xs font-semibold tracking-[0.15em] uppercase border border-brand-text/25 text-brand-text hover:bg-brand-text hover:text-brand-dark transition-colors duration-300 opacity-0 animate-fade-up"
            style={{ animationDelay: '0.95s' }}
          >
            Browse Fleet
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>
      </div>

      <div className="absolute right-6 bottom-24 z-10 hidden md:flex flex-col items-end gap-6 opacity-0 animate-slide-in-right" style={{ animationDelay: '1s' }}>
        <div className="flex gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-right">
              <p className="font-display text-3xl font-bold text-brand-red tracking-tight">{value}</p>
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 opacity-0 animate-fade-in" style={{ animationDelay: '1.3s' }}>
          <span className="text-[10px] text-brand-muted uppercase tracking-[0.2em]">Scroll</span>
          <span className="w-10 h-px bg-gradient-to-l from-brand-red to-transparent animate-pulse" />
        </div>
      </div>
    </section>
  );
}
