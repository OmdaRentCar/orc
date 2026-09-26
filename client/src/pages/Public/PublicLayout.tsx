import { Outlet } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import WhatsAppButton from '../../components/public/WhatsAppButton';

// Everything customers see: translated, with the WhatsApp button. The admin area stays in English.
export default function PublicLayout() {
  return (
    <I18nProvider>
      <ToastProvider>
        <Outlet />
        <WhatsAppButton />
      </ToastProvider>
    </I18nProvider>
  );
}
