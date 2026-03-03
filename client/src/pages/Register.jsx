import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignIn from '../components/GoogleSignIn';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    postcode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-serif text-3xl text-bark mb-2 text-center">Create an account</h1>
      <p className="text-sm text-stone text-center mb-6">Book lessons or share your photography skills — or both.</p>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

      <GoogleSignIn
        onSuccess={(data) => {
          window.location.href = '/dashboard';
        }}
        onError={(msg) => setError(msg)}
        text="signup_with"
      />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-sand" />
        <span className="text-xs font-mono text-clay">or</span>
        <div className="flex-1 h-px bg-sand" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-mono text-stone mb-1">Name</label>
          <input type="text" value={form.name} onChange={update('name')} required
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        <div>
          <label className="block text-sm font-mono text-stone mb-1">Email</label>
          <input type="email" value={form.email} onChange={update('email')} required
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        <div>
          <label className="block text-sm font-mono text-stone mb-1">Password</label>
          <input type="password" value={form.password} onChange={update('password')} required minLength={6}
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        <div>
          <label className="block text-sm font-mono text-stone mb-1">Postcode</label>
          <input type="text" value={form.postcode} onChange={update('postcode')} placeholder="e.g. SW1A 1AA"
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        <div>
          <label className="block text-sm font-mono text-stone mb-1">Phone (optional)</label>
          <input type="tel" value={form.phone} onChange={update('phone')}
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-stone text-center mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-terracotta hover:underline">Log in</Link>
      </p>
    </div>
  );
}
