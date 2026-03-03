import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-bark mb-2">Invalid Link</h1>
        <p className="text-stone mb-4">This reset link is invalid or has expired.</p>
        <Link to="/forgot-password" className="text-terracotta hover:underline text-sm">Request a new one</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blush rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl text-bark mb-2">Password Updated</h1>
        <p className="text-stone mb-6">You can now log in with your new password.</p>
        <Link to="/login" className="inline-block bg-bark text-white px-6 py-2.5 rounded-full font-medium hover:bg-charcoal transition-colors">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-serif text-3xl text-bark mb-6 text-center">Set New Password</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-mono text-stone mb-1">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>
        <div>
          <label className="block text-sm font-mono text-stone mb-1">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6}
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
