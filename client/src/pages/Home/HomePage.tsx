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
      <section id="cars" className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-brand-red text-sm font-semibold tracking-widest uppercase mb-2">Our Fleet</p>
          <h2 className="font-display text-4xl font-extrabold text-brand-text mb-6">Premium Vehicles</h2>
          <FilterBar filters={filters} onChange={setFilters} brands={brands} types={types} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-brand-muted">No cars match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
      <div className="min-h-screen bg-brand-dark">
        <Navbar />
        <HeroSection />
        <CarsSection />
        <FeaturesSection />
        <Footer />
      </div>
    </ToastProvider>
  );
}
