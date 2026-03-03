import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await api.getNotifications();
        setNotifications(data.notifications);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleClickNotification = async (notification) => {
    if (!notification.read) {
      try {
        await api.markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: 1 } : n
          )
        );
      } catch (err) {
        console.error(err);
      }
    }
    navigate(notification.link || '/dashboard');
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl text-bark mb-6">Notifications</h1>
        <p className="text-stone py-8 text-center font-serif italic">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-bark">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-terracotta hover:text-brand-700"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-sand/60 p-8 text-center text-stone">
          <p className="font-serif italic">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClickNotification(notification)}
              className={`block w-full text-left rounded-2xl border transition-colors p-4 cursor-pointer ${
                !notification.read
                  ? 'bg-blush/40 border-sand hover:bg-blush'
                  : 'bg-white border-sand/60 hover:bg-paper'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-bark">
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-terracotta"></span>
                    )}
                  </div>
                  <p className="text-sm text-stone">{notification.message}</p>
                  <p className="text-xs font-mono text-clay mt-1">
                    {new Date(notification.created_at).toLocaleDateString(
                      'en-GB',
                      {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-sand flex-shrink-0 ml-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
