import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blush rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl text-bark mb-2">Check your email</h1>
        <p className="text-stone mb-6">If an account exists for {email}, we've sent a password reset link.</p>
        <Link to="/login" className="text-terracotta hover:underline text-sm">Back to login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-serif text-3xl text-bark mb-2 text-center">Forgot your password?</h1>
      <p className="text-stone text-sm text-center mb-6">Enter your email and we'll send you a reset link.</p>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-mono text-stone mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full border border-sand rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-sm text-stone text-center mt-4">
        <Link to="/login" className="text-terracotta hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
