import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-600 tracking-tight">
            tactile
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link to="/search" className="text-gray-600 hover:text-gray-900">Find Teachers</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
                <Link to="/messages" className="text-gray-600 hover:text-gray-900">Messages</Link>
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
