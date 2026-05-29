import { useState, FormEvent } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiJSON } from '../../services/api';
import type { AdminUser } from '../../types';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiJSON<{ token: string; user: AdminUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.token, data.user);
      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center relative overflow-hidden">
      {/* Animated conic background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, #e72526 0deg, transparent 60deg, transparent 120deg, #e72526 180deg, transparent 240deg, transparent 300deg, #e72526 360deg)',
          animation: 'spin 20s linear infinite',
        }}
      />
      <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl" />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4">
              <p className="font-display text-3xl font-extrabold text-brand-text">
                Omda<span className="text-brand-red">.</span>
              </p>
            </Link>
            <h1 className="text-xl font-bold text-brand-text">Admin Access</h1>
            <p className="text-sm text-brand-muted mt-1">Sign in to manage your fleet</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-brand-muted mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full bg-brand-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs text-brand-muted mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-brand-surface border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-brand-text placeholder-brand-muted/50 focus:outline-none focus:border-brand-red/50 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text transition-colors text-sm"
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-brand-muted hover:text-brand-red transition-colors">
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
