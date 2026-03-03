import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignIn from '../components/GoogleSignIn';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-serif text-3xl text-bark mb-6 text-center">Log in</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

      <GoogleSignIn
        onSuccess={(data) => {
          window.location.href = '/dashboard';
        }}
        onError={(msg) => setError(msg)}
        text="signin_with"
      />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-sand" />
        <span className="text-xs font-mono text-clay">or</span>
        <div className="flex-1 h-px bg-sand" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-mono text-stone mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-mono text-stone mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="text-sm text-stone text-center mt-4">
        Don't have an account?{' '}
        <Link to="/register" className="text-terracotta hover:underline">Sign up</Link>
      </p>
      <p className="text-sm text-center mt-2">
        <Link to="/forgot-password" className="text-clay hover:text-stone">Forgot your password?</Link>
      </p>
    </div>
  );
}
