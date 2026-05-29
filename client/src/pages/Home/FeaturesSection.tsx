const FEATURES = [
  {
    icon: '🚗',
    title: 'Premium Fleet',
    desc: 'Over 200 luxury and exotic vehicles from the world\'s finest automakers.',
    stat: '200+',
  },
  {
    icon: '📅',
    title: 'Flexible Booking',
    desc: 'Instant confirmation, no hidden fees. Cancel or modify anytime.',
    stat: '0 fees',
  },
  {
    icon: '🚚',
    title: 'Concierge Delivery',
    desc: 'Your vehicle delivered to any location in the city at your convenience.',
    stat: 'Any location',
  },
  {
    icon: '🛟',
    title: '24/7 Support',
    desc: 'Round-the-clock assistance from our expert team wherever you are.',
    stat: '24/7',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <p className="text-brand-red text-sm font-semibold tracking-widest uppercase mb-2">Why Choose Omda</p>
        <h2 className="font-display text-4xl font-extrabold text-brand-text">The Omda Advantage</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map(({ icon, title, desc, stat }) => (
          <div key={title} className="glass-card p-6 hover:border-brand-red/20 transition-colors">
            <div className="text-4xl mb-4">{icon}</div>
            <p className="font-display font-extrabold text-2xl text-brand-red mb-1">{stat}</p>
            <h3 className="font-semibold text-brand-text mb-2">{title}</h3>
            <p className="text-sm text-brand-muted leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
