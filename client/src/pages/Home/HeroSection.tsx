import ThreeScene from '../../components/three/ThreeScene';

const STATS = [
  { value: '200+', label: 'Premium Cars' },
  { value: '98%', label: 'Satisfaction' },
  { value: '24/7', label: 'Support' },
];

export default function HeroSection() {
  return (
    <section className="relative h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <ThreeScene />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-24 pointer-events-none">
        <div className="max-w-xl">
          <p className="text-brand-red text-sm font-semibold tracking-widest uppercase mb-3">Premium Fleet</p>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-brand-text leading-none tracking-tight mb-6">
            Drive<br />
            <span className="text-brand-red">Extraordinary</span>
          </h1>
          <p className="text-brand-muted text-lg leading-relaxed mb-8">
            Experience luxury and performance with our exclusive fleet of premium vehicles.
          </p>
          <a
            href="#cars"
            className="pointer-events-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-red text-white font-semibold hover:bg-red-500 transition-colors"
          >
            Browse Fleet
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-10 pointer-events-none">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="font-display text-3xl font-extrabold text-brand-red">{value}</p>
              <p className="text-xs text-brand-muted uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
