import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import PublicLayout from './pages/Public/PublicLayout';
import HomePage from './pages/Home/HomePage';
import CarPage from './pages/Public/CarPage';
import StatusPage from './pages/Public/StatusPage';
import SignContract from './pages/Public/SignContract';
import VerifyContract from './pages/Public/VerifyContract';
import LoginPage from './pages/Login/LoginPage';
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import Bookings from './pages/Admin/Bookings';
import FleetCalendar from './pages/Admin/FleetCalendar';
import Cars from './pages/Admin/Cars';
import Customers from './pages/Admin/Customers';
import History from './pages/Admin/History';
import Team from './pages/Admin/Team';
import Activity from './pages/Admin/Activity';
import Settings from './pages/Admin/Settings';
import Handover from './pages/Admin/Handover';
import Fines from './pages/Admin/Fines';
import Finances from './pages/Admin/Finances';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function OwnerRoute({ children }: { children: ReactNode }) {
  const { isOwner } = useAuth();
  return isOwner ? <>{children}</> : <Navigate to="/admin" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/cars/:id" element={<CarPage />} />
        <Route path="/booking-status" element={<StatusPage />} />
        <Route path="/sign/:token" element={<SignContract />} />
        <Route path="/verify" element={<VerifyContract />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <NotificationsProvider>
              <AdminLayout />
            </NotificationsProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id/handover/:type" element={<Handover />} />
        <Route path="fines" element={<Fines />} />
        <Route path="finances" element={<Finances />} />
        <Route path="calendar" element={<FleetCalendar />} />
        <Route path="cars" element={<Cars />} />
        <Route path="customers" element={<Customers />} />
        <Route path="history" element={<History />} />
        <Route path="team" element={<OwnerRoute><Team /></OwnerRoute>} />
        <Route path="activity" element={<OwnerRoute><Activity /></OwnerRoute>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
