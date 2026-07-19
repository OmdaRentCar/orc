import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-brand-dark flex items-center justify-center overflow-hidden transition-opacity duration-700">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-brand-red/20"
            style={{
              width: `${(i + 1) * 120}px`,
              height: `${(i + 1) * 120}px`,
              animation: `ping ${1.5 + i * 0.3}s ease-out ${i * 0.2}s infinite`,
              opacity: 0.3 - i * 0.04,
            }}
          />
        ))}
      </div>
      <div className="relative text-center">
        <h1 className="font-display text-6xl font-black uppercase tracking-tight text-brand-text">
          Omda<span className="text-brand-red">.</span>
        </h1>
        <p className="mt-2 text-brand-muted text-[11px] tracking-[0.3em] uppercase">Car Rental</p>
        <div className="mt-6 flex justify-center">
          <div className="w-8 h-px bg-brand-red animate-pulse" />
        </div>
      </div>
    </div>
  );
}
