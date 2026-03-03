import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose, onSuccess, message }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', postcode: '' });
  const updateReg = (field) => (e) => setRegForm({ ...regForm, [field]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(regForm);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6">
        {message && (
          <p className="text-sm text-stone text-center mb-4">{message}</p>
        )}

        {/* Tabs */}
        <div className="flex border-b border-sand mb-5">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === 'login' ? 'text-bark border-b-2 border-terracotta' : 'text-clay'
            }`}
          >
            Log in
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === 'register' ? 'text-bark border-b-2 border-terracotta' : 'text-clay'
            }`}
          >
            Sign up
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors">
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Name</label>
              <input type="text" value={regForm.name} onChange={updateReg('name')} required
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Email</label>
              <input type="email" value={regForm.email} onChange={updateReg('email')} required
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Password</label>
              <input type="password" value={regForm.password} onChange={updateReg('password')} required minLength={6}
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-sm font-mono text-stone mb-1">Postcode</label>
              <input type="text" value={regForm.postcode} onChange={updateReg('postcode')} placeholder="e.g. SW1A 1AA"
                className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
