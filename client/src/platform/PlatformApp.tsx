import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import { I18nProvider } from '../i18n';
import ConsoleLayout, { ConsoleLogin } from './console/ConsoleLayout';
import { Admins, AgencyDetail, Agencies, Events, Invoices, Overview } from './console/ConsolePages';

// Separate pages of the platform address: sign-up, single login and console (the general page is the 3D site)
export default function PlatformApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Same languages as the general page (the visitor's choice is remembered) */}
        <Route path="/signup" element={<I18nProvider><Signup /></I18nProvider>} />
        <Route path="/login" element={<I18nProvider><Login /></I18nProvider>} />
        <Route path="/console/login" element={<ConsoleLogin />} />
        <Route path="/console" element={<ConsoleLayout />}>
          <Route index element={<Overview />} />
          <Route path="agencies" element={<Agencies />} />
          <Route path="agencies/:id" element={<AgencyDetail />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="events" element={<Events />} />
          <Route path="admins" element={<Admins />} />
        </Route>
        {/* Anything else is the general page: leave this app with a full page load */}
        <Route path="*" element={<LeaveToSite />} />
      </Routes>
    </BrowserRouter>
  );
}

function LeaveToSite() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => { window.location.replace(pathname + search + hash); }, [pathname, search, hash]);
  return <div className="min-h-screen bg-brand-dark" />;
}
