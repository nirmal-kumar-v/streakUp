import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, Lock, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read any message passed via location state (e.g. after logout or reset password)
  const infoMessage = (location.state as any)?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both identifier and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setUnverifiedEmail(null);

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
      const errorData = err?.response?.data;
      if (errorData?.requiresVerification && errorData?.email) {
        setUnverifiedEmail(errorData.email);
        setError(errorData.error || 'Please verify your email address to log in.');
      } else {
        setError(extractErrorMessage(err, 'Login failed. Please check your credentials.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 mb-3 shadow-sm">
            <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Welcome back</h1>
          <p className="text-xs text-dark-muted mt-1">
            Sign in with your username or email
          </p>
        </div>

        {infoMessage && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 flex flex-col gap-2 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <div className="mt-1 pl-6">
                <Link
                  to={`/register?step=verify&email=${encodeURIComponent(unverifiedEmail)}`}
                  className="inline-flex items-center gap-1 font-semibold text-flame-400 hover:text-flame-300 hover:underline"
                >
                  <span>Enter verification code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
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
              <Link
                to="/forgot-password"
                className="text-xs text-flame-400 hover:text-flame-300 hover:underline font-medium"
              >
                Forgot password?
              </Link>
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
            className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-dark-border text-center">
          <p className="text-xs text-dark-muted">
            Don't have an account?{' '}
            <Link to="/register" className="text-flame-400 hover:text-flame-300 font-semibold hover:underline">
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
