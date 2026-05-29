import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import NotificationsPanel from '../../components/layout/NotificationsPanel';
import { ToastProvider } from '../../components/ui/Toast';
import { joinAdmin } from '../../services/socket';
import { useEffect } from 'react';

const NAV = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: '📋', end: false },
  { to: '/admin/cars', label: 'Manage Cars', icon: '🚗', end: false },
  { to: '/admin/history', label: 'History', icon: '📜', end: false },
];

function AdminSidebar({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-64 bg-brand-surface border-r border-white/5 flex flex-col h-full flex-shrink-0">
      <div className="p-6 border-b border-white/5">
        <p className="font-display text-xl font-extrabold text-brand-text">
          Omda<span className="text-brand-red">.</span>
        </p>
        <p className="text-xs text-brand-muted mt-1">{user?.username}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' : 'text-brand-muted hover:text-brand-text hover:bg-white/5'}`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
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
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    joinAdmin();
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-brand-dark overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <AdminSidebar onClose={() => {}} />
        </div>

        {/* Mobile sidebar */}
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
            >
              ☰
            </button>
            <p className="text-xs text-brand-muted hidden md:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <button
              onClick={() => setNotifOpen(true)}
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-red text-white text-xs flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>

        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      </div>
    </ToastProvider>
  );
}
