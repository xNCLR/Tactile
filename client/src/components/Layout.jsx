import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import WaveBackground from './WaveBackground';

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

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => api.getUnreadCount().then(data => setUnreadCount(data.count)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

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

  const handleNotificationClick = async (n) => {
    setShowNotifications(false);
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: 1 } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {}
    }
    navigate(n.link || '/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <WaveBackground />
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand/60 sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl text-bark tracking-tight italic">
            Tactile
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/search" className="text-stone hover:text-bark transition-colors">Find Teachers</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-stone hover:text-bark transition-colors">Dashboard</Link>
                <Link to="/messages" className="text-stone hover:text-bark transition-colors">Messages</Link>

                <div className="relative" ref={notifRef}>
                  <button onClick={handleOpenNotifications} className="relative text-stone hover:text-bark p-1 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-terracotta text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-sand shadow-lg overflow-hidden z-50 flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-sand/40">
                        <h3 className="font-serif text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs font-mono text-terracotta hover:text-brand-700">Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-stone text-center py-8">No notifications yet</p>
                        ) : (
                          notifications.map(n => (
                            <button key={n.id} onClick={() => handleNotificationClick(n)}
                              className={`block w-full text-left px-4 py-3 border-b border-sand/20 hover:bg-paper transition-colors cursor-pointer ${!n.read ? 'bg-blush/40' : ''}`}>
                              <p className="text-sm font-medium text-bark">{n.title}</p>
                              <p className="text-xs text-stone mt-0.5">{n.message}</p>
                              <p className="text-xs text-clay font-mono mt-1">{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </button>
                          ))
                        )}
                      </div>
                      <Link to="/notifications" onClick={() => setShowNotifications(false)} className="px-4 py-3 border-t border-sand/40 text-sm text-center text-terracotta hover:bg-paper transition-colors">
                        View all notifications
                      </Link>
                    </div>
                  )}
                </div>

                <button onClick={handleLogout} className="text-stone hover:text-bark transition-colors">Log out</button>
                <span className="text-xs font-mono bg-blush text-bark px-2.5 py-1 rounded-full">{user.name}</span>
              </>
            ) : (
              <>
                <Link to="/login" className="text-stone hover:text-bark transition-colors">Log in</Link>
                <Link to="/register" className="bg-bark text-white px-4 py-1.5 rounded-full text-sm hover:bg-charcoal transition-colors">Sign up</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-1 text-bark" aria-label="Menu">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </nav>

        {menuOpen && (
          <div className="md:hidden border-t border-sand/40 bg-white">
            <div className="px-4 py-3 space-y-3">
              <Link to="/search" onClick={closeMenu} className="block text-sm text-bark hover:text-terracotta">Find Teachers</Link>
              {user ? (
                <>
                  <Link to="/dashboard" onClick={closeMenu} className="block text-sm text-bark hover:text-terracotta">Dashboard</Link>
                  <Link to="/messages" onClick={closeMenu} className="block text-sm text-bark hover:text-terracotta">Messages</Link>
                  <div className="flex items-center gap-2 text-sm">
                    <button onClick={handleOpenNotifications} className="relative text-bark hover:text-terracotta flex-1 text-left">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="ml-2 inline-block w-4 h-4 bg-terracotta text-white text-[9px] font-bold rounded-full text-center leading-4">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                  <Link to="/profile/edit" onClick={closeMenu} className="block text-sm text-bark hover:text-terracotta">Edit Profile</Link>
                  <button onClick={handleLogout} className="block text-sm text-terracotta hover:text-brand-700">Log out</button>
                  <div className="text-xs font-mono text-stone pt-1 border-t border-sand/40">Signed in as {user.name}</div>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMenu} className="block text-sm text-bark hover:text-terracotta">Log in</Link>
                  <Link to="/register" onClick={closeMenu} className="block text-sm bg-bark text-white text-center py-2 rounded-full hover:bg-charcoal">Sign up</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <footer className="py-8 mt-auto relative z-10">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="font-serif text-lg text-bark italic mb-1">Tactile</p>
          <p className="text-xs font-mono text-stone tracking-wide">In-person photography lessons in London</p>
        </div>
      </footer>
    </div>
  );
}
