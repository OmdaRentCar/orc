import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Notification } from '../types';
import { apiJSON } from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from './AuthContext';

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  reload: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiJSON<Notification[]>('/dashboard/notifications');
      setNotifications(data);
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => { reload(); };
    socket.on('booking-update', handler);
    return () => { socket.off('booking-update', handler); };
  }, [reload]);

  const markRead = useCallback(async (id: number) => {
    await apiJSON(`/dashboard/notifications/${id}/read`, { method: 'PUT' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiJSON('/dashboard/notifications/read-all', { method: 'PUT' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, reload }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
