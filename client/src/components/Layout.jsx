import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  // Poll for unread notifications
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => api.getUnreadCount().then(data => setUnreadCount(data.count)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Click-outside handler for notification panel
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotifications = async () => {
    if (!showNotifications) {
      try {
        const data = await api.getNotifications();
        setNotifications(data.notifications);
      } catch (err) {}
    }
    setShowNotifications(!showNotifications);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {}
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-600 tracking-tight">
            Tactile
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link to="/search" className="text-gray-600 hover:text-gray-900">Find Teachers</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
                <Link to="/messages" className="text-gray-600 hover:text-gray-900">Messages</Link>

                {/* Notification bell */}
                <div className="relative" ref={notifRef}>
                  <button onClick={handleOpenNotifications} className="relative text-gray-600 hover:text-gray-900 p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50 flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:text-brand-800">Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-8">No notifications yet</p>
                        ) : (
                          notifications.map(n => (
                            <Link key={n.id} to={n.link || '/dashboard'} onClick={() => setShowNotifications(false)}
                              className={`block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-brand-50/50' : ''}`}>
                              <p className="text-sm font-medium text-gray-900">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                              <p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </Link>
                          ))
                        )}
                      </div>
                      <Link to="/notifications" onClick={() => setShowNotifications(false)} className="px-4 py-3 border-t border-gray-100 text-sm text-center text-brand-600 hover:bg-gray-50 transition-colors">
                        View all notifications
                      </Link>
                    </div>
                  )}
                </div>

                <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">Log out</button>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full font-medium">{user.name}</span>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900">Log in</Link>
                <Link to="/register" className="bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors">Sign up</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-1 text-gray-600" aria-label="Menu">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-3">
              <Link to="/search" onClick={closeMenu} className="block text-sm text-gray-700 hover:text-gray-900">Find Teachers</Link>
              {user ? (
                <>
                  <Link to="/dashboard" onClick={closeMenu} className="block text-sm text-gray-700 hover:text-gray-900">Dashboard</Link>
                  <Link to="/messages" onClick={closeMenu} className="block text-sm text-gray-700 hover:text-gray-900">Messages</Link>
                  <div className="flex items-center gap-2 text-sm">
                    <button onClick={handleOpenNotifications} className="relative text-gray-700 hover:text-gray-900 flex-1 text-left">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="ml-2 inline-block w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full text-center leading-4">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                  <Link to="/profile/edit" onClick={closeMenu} className="block text-sm text-gray-700 hover:text-gray-900">Edit Profile</Link>
                  <button onClick={handleLogout} className="block text-sm text-red-500 hover:text-red-700">Log out</button>
                  <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">Signed in as {user.name}</div>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMenu} className="block text-sm text-gray-700 hover:text-gray-900">Log in</Link>
                  <Link to="/register" onClick={closeMenu} className="block text-sm bg-brand-600 text-white text-center py-2 rounded-lg hover:bg-brand-700">Sign up</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          Tactile — In-person photography lessons in London
        </div>
      </footer>
    </div>
  );
}
