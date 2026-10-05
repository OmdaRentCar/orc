import { useState, useEffect } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAgency } from '../../context/AgencyContext';
import SubscriptionBanner from './SubscriptionBanner';
import Tour, { TourStep } from './Tour';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import NotificationsPanel from '../../components/layout/NotificationsPanel';
import { ToastProvider } from '../../components/ui/Toast';
import { joinAdmin, disconnectSocket } from '../../services/socket';
import { apiJSON } from '../../services/api';
import type { AdminUser } from '../../types';
import BrandName from '../../components/layout/BrandName';

const NAV = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true, ownerOnly: false },
  { to: '/admin/bookings', label: 'Bookings', icon: '📋', end: false, ownerOnly: false },
  { to: '/admin/calendar', label: 'Calendar', icon: '🗓️', end: false, ownerOnly: false },
  { to: '/admin/cars', label: 'Manage Cars', icon: '🚗', end: false, ownerOnly: false },
  { to: '/admin/customers', label: 'Customers', icon: '👥', end: false, ownerOnly: false },
  { to: '/admin/fines', label: 'Fines', icon: '🚨', end: false, ownerOnly: false },
  { to: '/admin/finances', label: 'Profit per Car', icon: '💹', end: false, ownerOnly: false },
  { to: '/admin/history', label: 'History', icon: '📜', end: false, ownerOnly: false },
  { to: '/admin/team', label: 'Team', icon: '🔑', end: false, ownerOnly: true },
  { to: '/admin/activity', label: 'Activity Log', icon: '🕓', end: false, ownerOnly: true },
  { to: '/admin/billing', label: 'Subscription', icon: '💳', end: false, ownerOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', end: false, ownerOnly: false },
];

const TOUR: (TourStep & { ownerOnly?: boolean })[] = [
  { title: 'Welcome to your dashboard', text: 'A one-minute tour of where everything is. You can skip it now and replay it any time with the “Tour” button at the top.' },
  { target: 'stats', title: 'Your day at a glance', text: 'Cars out on rent, revenue, cars in maintenance and bookings waiting for your answer. Below: revenue per month and the pick-ups and returns coming up.' },
  { target: 'nav:/admin/bookings', title: 'Bookings', text: 'Every booking from your website or added by hand. Approve or decline, record payments, send the contract for online signature, do the pick-up and return check.' },
  { target: 'nav:/admin/calendar', title: 'Calendar', text: 'Which car is out when, on one screen, so a car is never rented twice.' },
  { target: 'nav:/admin/cars', title: 'Manage cars', text: 'Photos, prices, papers (insurance, vignette, technical inspection) and the next service. You get an alert before anything expires.' },
  { target: 'nav:/admin/customers', title: 'Customers', text: 'Everyone who booked, with their history and spending. Block a bad payer: they can no longer book online.' },
  { target: 'nav:/admin/fines', title: 'Fines', text: 'Received a speed camera fine? Enter the plate, date and time: the dashboard tells you who was driving.' },
  { target: 'nav:/admin/finances', title: 'Profit per car', text: 'Revenue minus expenses for each car, so you know which ones really earn money.' },
  { target: 'nav:/admin/team', title: 'Your team', text: 'Give your staff their own login. Staff can handle bookings; only owners manage the team, prices and the subscription.', ownerOnly: true },
  { target: 'nav:/admin/billing', title: 'Subscription', text: 'Your plan, what it includes, online payment and your invoices.', ownerOnly: true },
  { target: 'nav:/admin/settings', title: 'Settings', text: 'Your name, logo and colours, prices, extras, delivery fee, seasons, contact details and WhatsApp number used by your website.' },
  { target: 'bell', title: 'Notifications', text: 'New bookings, late returns and expiring papers show up here in real time.' },
  { target: 'site', title: 'Your booking website', text: 'This is the site your customers book on. Share the link on Facebook, Instagram, WhatsApp and Google. You’re all set!' },
];

function AdminSidebar({ onClose }: { onClose: () => void }) {
  const { user, isOwner, logout } = useAuth();
  const { agency } = useAgency();
  const paused = agency.status === 'suspended' || agency.status === 'cancelled';
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-64 bg-brand-surface border-r border-white/5 flex flex-col h-full flex-shrink-0">
      <div className="p-6 border-b border-white/5">
        <p className="font-display text-xl font-extrabold text-brand-text">
          <BrandName />
        </p>
        <p className="text-xs text-brand-muted mt-1">
          {user?.username} <span className="px-1.5 py-0.5 ms-1 rounded bg-white/5 text-[10px] uppercase tracking-wider">{user?.role}</span>
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.filter((item) => !item.ownerOnly || isOwner).map(({ to, label, icon, end }) => (paused && to !== '/admin/billing' ? (
          // Paused agency: everything but the subscription is locked until payment
          <span key={to} title="Locked until the subscription is paid" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-brand-muted/40 cursor-not-allowed">
            <span className="opacity-40">{icon}</span>
            {label}
            <span className="ms-auto text-xs">🔒</span>
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-tour={`nav:${to}`}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' : 'text-brand-muted hover:text-brand-text hover:bg-white/5'}`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        )))}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-1">
        <a href={`${agency.platform.url}/login`} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5">
          <span>🔁</span>
          My agencies
        </a>
        {isOwner && (
          <a href={`${agency.platform.url}/signup?email=${encodeURIComponent(user?.email ?? '')}`} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text hover:bg-white/5">
            <span>➕</span>
            New agency
          </a>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-brand-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const { token, updateUser, isOwner, user } = useAuth();
  const { agency } = useAgency();
  const location = useLocation();
  const paused = agency.status === 'suspended' || agency.status === 'cancelled';
  const navigate = useNavigate();
  const tourKey = `tour-done:${agency.slug}:${user?.username ?? ''}`;
  const [touring, setTouring] = useState(false);

  // First visit of this account: offer the tour once (not while the dashboard is paused)
  useEffect(() => {
    if (paused) return;
    try { if (!localStorage.getItem(tourKey)) setTouring(true); } catch { /* storage blocked: no automatic tour */ }
  }, [tourKey, paused]);

  function startTour() {
    navigate('/admin');
    setSidebarOpen(false);
    setTouring(true);
  }
  function endTour() {
    setTouring(false);
    try { localStorage.setItem(tourKey, '1'); } catch { /* it will be offered again next time */ }
  }
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    joinAdmin(token);
    // Picks up role changes made by an owner, and the role for sessions from before roles existed
    apiJSON<AdminUser>('/auth/me').then((me) => updateUser(token, me)).catch(() => {});
    return () => disconnectSocket();
  }, [token, updateUser]);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-brand-dark overflow-hidden">
        <div className="hidden md:flex">
          <AdminSidebar onClose={() => {}} />
        </div>

        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
            <div className="fixed left-0 top-0 h-full z-40 flex">
              <AdminSidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 h-14 border-b border-white/5 flex items-center justify-between px-6 bg-brand-surface">
            <button
              className="md:hidden text-brand-muted hover:text-brand-text transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <p className="text-xs text-brand-muted hidden md:block">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2">
            <a href={agency.siteUrl} target="_blank" rel="noreferrer" data-tour="site" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-brand-muted hover:text-brand-text hover:bg-white/5">
              🌐 View my site
            </a>
            {!paused && (
              <button onClick={startTour} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-brand-muted hover:text-brand-text hover:bg-white/5" title="Replay the dashboard tour">
                🧭 Tour
              </button>
            )}
            <button
              data-tour="bell"
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-red text-white text-xs flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            </div>
          </header>

          <SubscriptionBanner />

          <main className="flex-1 overflow-y-auto p-6">
            {/* While suspended, the owner only gets the subscription page; staff see why */}
            {paused && !location.pathname.startsWith('/admin/billing')
              ? (isOwner ? <Navigate to="/admin/billing" replace /> : <p className="text-sm text-brand-muted">The dashboard is paused until the subscription is renewed by the agency owner.</p>)
              : <Outlet />}
          </main>
        </div>

        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        {touring && <Tour steps={TOUR.filter((t) => !t.ownerOnly || isOwner)} onClose={endTour} />}
      </div>
    </ToastProvider>
  );
}
