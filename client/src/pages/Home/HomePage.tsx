import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
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
import { useI18n } from '../../i18n';
import ScrollScene from '../../components/three/ScrollScene';
import { useAgency } from '../../context/AgencyContext';
import { useBusinessSettings } from '../../services/settings';
import { AgencyDirectory, Faq, HowItWorks, PlatformCallToAction, PlatformFeatures, Pricing } from './PlatformSections';

function OverviewSection() {
  const { t } = useI18n();
  const { agency } = useAgency();
  const settings = useBusinessSettings();
  const text = agency.isPlatform ? t('platform.overviewText') : settings?.siteAbout || t('overview.text');
  const tag = agency.isPlatform ? t('platform.overviewTag', { brand: agency.name }) : t('overview.tag');
  const title1 = agency.isPlatform ? t('platform.overviewTitle1') : t('overview.title1');
  const title2 = agency.isPlatform ? t('platform.overviewTitle2') : t('overview.title2');
  return (
    <section id="section-overview" className="relative min-h-[110vh] flex items-center pointer-events-none px-6">
      <div className="max-w-xl">
        <p className="section-tag opacity-0 animate-fade-up">{tag}</p>
        <h2 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[0.92] tracking-tight text-brand-text mb-8 opacity-0 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {title1}<br />{title2}
        </h2>
        <p className="text-brand-muted text-sm leading-[1.8] max-w-md opacity-0 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          {text}
        </p>
      </div>
    </section>
  );
}

// Each agency sets its own prices: the price filter goes up to its dearest car (rounded up to 50 DT)
const ceilingFor = (cars: Car[]) => Math.max(100, Math.ceil(Math.max(0, ...cars.map((c) => c.price)) / 50) * 50);

function CarsSection() {
  const { t } = useI18n();

  const { showToast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    brand: '',
    type: '',
    maxPrice: Infinity, // no price limit until the fleet is known
    availableOnly: false,
  });

  useEffect(() => {
    Promise.all([
      apiJSON<Car[]>('/cars'),
      apiJSON<string[]>('/cars/brands'),
      apiJSON<string[]>('/cars/types'),
    ]).then(([c, b, ty]) => {
      setCars(c);
      // The slider starts at the dearest car, so no car is hidden before the visitor filters
      setFilters((f) => ({ ...f, maxPrice: ceilingFor(c) }));
      setBrands(b);
      setTypes(ty);
    }).catch(() => showToast(t('fleet.loadFailed'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => cars.filter((c) => {
    if (filters.availableOnly && (!c.available || c.documentsExpired?.length)) return false;
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
          <p className="section-tag">{t('fleet.tag')}</p>
          <h2 className="font-display text-4xl font-extrabold uppercase text-brand-text mb-6 tracking-tight">{t('fleet.title')}</h2>
          <FilterBar filters={filters} onChange={setFilters} brands={brands} types={types} priceCeiling={ceilingFor(cars)} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 pointer-events-auto">
            <p className="text-brand-muted text-sm uppercase tracking-[0.2em]">{t('fleet.noMatch')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pointer-events-auto">
            {filtered.map((car) => (
              <CarCard key={car.id} car={car} onBook={() => setSelectedCar(car)} />
            ))}
          </div>
        )}
      </section>

      <BookingModal car={selectedCar} onClose={() => setSelectedCar(null)} onSuccess={() => {}} />
    </>
  );
}

export default function HomePage() {
  const { hash } = useLocation();
  const { agency } = useAgency();

  // Links from other pages arrive as /#section-fleet; scroll there once the page has laid out
  useEffect(() => {
    if (!hash) return;
    const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 600);
    return () => clearTimeout(timer);
  }, [hash]);

  return (
    <>
      <SplashScreen />
      <div className="relative min-h-screen bg-brand-dark">
        <ScrollScene />
        <Navbar />
        <div id="scroll-container" className="relative z-10 pointer-events-none">
          <HeroSection />
          <OverviewSection />
          {agency.isPlatform ? (
            // General page: for agency owners. The fleet and booking live on each agency's own site.
            <>
              <PlatformFeatures />
              <HowItWorks />
              <Pricing />
              <AgencyDirectory />
              <Faq />
            </>
          ) : (
            <>
              <CarsSection />
              <FeaturesSection />
            </>
          )}
          <section id="section-cta" className="relative min-h-screen flex flex-col justify-end pointer-events-none">
            {agency.isPlatform && <PlatformCallToAction />}
            <Footer />
          </section>
        </div>
      </div>
    </>
  );
}
