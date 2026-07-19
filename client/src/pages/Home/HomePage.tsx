import { useState, useEffect, useMemo } from 'react';
import { ToastProvider, useToast } from '../../components/ui/Toast';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SplashScreen from './SplashScreen';
import HeroSection from './HeroSection';
import FilterBar from './FilterBar';
import CarCard from './CarCard';
import BookingModal from './BookingModal';
import FeaturesSection from './FeaturesSection';
import type { Car } from '../../types';
import { apiJSON } from '../../services/api';
import ScrollScene from '../../components/three/ScrollScene';

function OverviewSection() {
  return (
    <section id="section-overview" className="relative min-h-[110vh] flex items-center pointer-events-none px-6">
      <div className="max-w-xl">
        <p className="section-tag opacity-0 animate-fade-up">Overview</p>
        <h2 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[0.92] tracking-tight text-brand-text mb-8 opacity-0 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Built on Trust,<br />Driven by Passion
        </h2>
        <p className="text-brand-muted text-sm leading-[1.8] max-w-md opacity-0 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          Omda Rent Car was founded on a simple idea — renting a premium vehicle should feel as exceptional as driving one. Every car in our fleet is hand-inspected, every booking backed by a real team, and every journey treated like it's the only one that matters.
        </p>
      </div>
    </section>
  );
}

function CarsSection() {
  const { showToast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    type: '',
    maxPrice: 700,
    availableOnly: false,
  });

  useEffect(() => {
    Promise.all([
      apiJSON<Car[]>('/cars'),
      apiJSON<string[]>('/cars/brands'),
      apiJSON<string[]>('/cars/types'),
    ]).then(([c, b, t]) => {
      setCars(c);
      setBrands(b);
      setTypes(t);
    }).catch(() => showToast('Failed to load cars', 'error'));
  }, []);

  const filtered = useMemo(() => cars.filter((c) => {
    if (filters.availableOnly && !c.available) return false;
    if (filters.brand && c.brand !== filters.brand) return false;
    if (filters.type && c.type !== filters.type) return false;
    if (c.price > filters.maxPrice) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
    }
    return true;
  }), [cars, filters]);

  return (
    <>
      <section id="section-fleet" className="relative min-h-[110vh] pointer-events-none max-w-7xl mx-auto px-6 py-32">
        <div className="mb-10 pointer-events-auto">
          <p className="section-tag">Our Fleet</p>
          <h2 className="font-display text-4xl font-extrabold uppercase text-brand-text mb-6 tracking-tight">Premium Vehicles</h2>
          <FilterBar filters={filters} onChange={setFilters} brands={brands} types={types} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 pointer-events-auto">
            <p className="text-brand-muted text-sm uppercase tracking-[0.2em]">No cars match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pointer-events-auto">
            {filtered.map((car) => (
              <CarCard key={car.id} car={car} onClick={() => setSelectedCar(car)} />
            ))}
          </div>
        )}
      </section>

      <BookingModal
        car={selectedCar}
        onClose={() => setSelectedCar(null)}
        onSuccess={() => showToast('Booking submitted! Pending approval.', 'success')}
      />
    </>
  );
}

export default function HomePage() {
  return (
    <ToastProvider>
      <SplashScreen />
      <div className="relative min-h-screen bg-brand-dark">
        <ScrollScene />
        <Navbar />
        <div id="scroll-container" className="relative z-10 pointer-events-none">
          <HeroSection />
          <OverviewSection />
          <CarsSection />
          <FeaturesSection />
          <section id="section-cta" className="relative min-h-screen flex items-end pointer-events-none">
            <Footer />
          </section>
        </div>
      </div>
    </ToastProvider>
  );
}
