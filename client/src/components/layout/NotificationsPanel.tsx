import { useNotifications } from '../../context/NotificationsContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ open, onClose }: Props) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const typeIcon: Record<string, string> = {
    new_booking: '📋',
    booking_approved: '✅',
    booking_declined: '❌',
    booking_pending: '⏳',
    info: 'ℹ️',
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-brand-surface border-l border-white/5 z-40 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div>
            <p className="font-semibold text-brand-text">Notifications</p>
            {unreadCount > 0 && <p className="text-xs text-brand-muted">{unreadCount} unread</p>}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-red hover:underline">Mark all read</button>
            )}
            <button onClick={onClose} className="text-brand-muted hover:text-brand-text text-lg">×</button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-64px)]">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-brand-muted text-sm">No notifications</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{typeIcon[n.type] ?? 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.read ? 'text-brand-muted' : 'text-brand-text'}`}>{n.message}</p>
                    <p className="text-xs text-brand-muted mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-brand-red flex-shrink-0 mt-1" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
