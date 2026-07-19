const FEATURES = [
  {
    num: '01',
    title: 'Premium Fleet',
    desc: 'Over 200 luxury and exotic vehicles from the world\'s finest automakers, hand-inspected before every rental.',
  },
  {
    num: '02',
    title: 'Flexible Booking',
    desc: 'Instant confirmation, no hidden fees. Cancel or modify your reservation anytime, from anywhere.',
  },
  {
    num: '03',
    title: 'Concierge Delivery',
    desc: 'Your vehicle delivered to any location in the city, fueled and ready, at your convenience.',
  },
  {
    num: '04',
    title: '24/7 Support',
    desc: 'Round-the-clock assistance from our expert team, wherever your journey takes you.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="section-features" className="relative min-h-screen flex items-end pointer-events-none px-6 py-24">
      <div className="max-w-7xl mx-auto w-full pointer-events-auto">
        <p className="section-tag">Why Choose Omda</p>
        <h2 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[0.92] tracking-tight text-brand-text mb-10">The Omda Advantage</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px max-w-3xl bg-white/[0.06]">
          {FEATURES.map(({ num, title, desc }) => (
            <div key={title} className="bg-brand-dark/80 backdrop-blur-sm p-7">
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
