import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { Flame, AlertCircle, ArrowRight, Lock, User as UserIcon } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setInfoMessage('Your session has expired. Please log in again.');
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await loginUser({
        identifier: identifier.trim(),
        password,
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-flame-500/15 border border-flame-500/30 text-flame-500 mb-3 shadow-sm shadow-flame-500/20">
            <Flame className="w-6 h-6 fill-flame-500" />
          </div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Welcome back</h1>
          <p className="text-xs text-dark-muted mt-1">
            Sign in with your username or email
          </p>
        </div>

        {infoMessage && (
          <div className="mb-6 p-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            {infoMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="text"
                required
                placeholder="username or user@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">Password</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 py-3 bg-flame-500 hover:bg-flame-400 active:scale-98 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-flame-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In to StreakUp</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-dark-muted">
          Don't have an account yet?{' '}
          <Link to="/register" className="text-flame-400 hover:text-flame-300 font-bold">
            Sign Up Free
          </Link>
        </div>
      </div>
    </div>
  );
};
