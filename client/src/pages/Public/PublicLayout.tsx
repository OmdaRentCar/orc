import { Outlet } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import WhatsAppButton from '../../components/public/WhatsAppButton';
import { useAgency } from '../../context/AgencyContext';
import BrandName from '../../components/layout/BrandName';

// Everything customers see: translated, with the WhatsApp button. The admin area stays in English.
export default function PublicLayout() {
  const { agency } = useAgency();
  if (agency.status === 'suspended' || agency.status === 'cancelled') return <AgencyPaused closed={agency.status === 'cancelled'} />;
  return (
    <I18nProvider>
      <ToastProvider>
        <Outlet />
        <WhatsAppButton />
      </ToastProvider>
    </I18nProvider>
  );
}

// Shown to customers while the agency's subscription is suspended (in the three site languages)
function AgencyPaused({ closed }: { closed: boolean }) {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-6 text-center">
      <div className="max-w-lg">
        <p className="font-display font-extrabold text-4xl text-brand-text mb-6"><BrandName /></p>
        <h1 className="text-xl font-semibold text-brand-text mb-2">{closed ? 'Cette agence n’accepte plus de réservations.' : 'Les réservations en ligne sont momentanément indisponibles.'}</h1>
        <p className="text-brand-muted text-sm">{closed ? 'This agency no longer takes bookings.' : 'Online booking is temporarily unavailable. Please contact the agency directly.'}</p>
        <p className="text-brand-muted text-sm mt-1" dir="rtl">{closed ? 'لم تعد هذه الوكالة تقبل الحجوزات.' : 'الحجز عبر الإنترنت غير متاح مؤقتًا. يرجى الاتصال بالوكالة مباشرة.'}</p>
      </div>
    </div>
  );
}
