import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-600 tracking-tight">
            tactile
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <Link to="/search" className="text-gray-600 hover:text-gray-900">
              Find Teachers
            </Link>

            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Log out
                </button>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full font-medium">
                  {user.name}
                </span>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
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
