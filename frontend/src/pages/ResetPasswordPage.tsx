import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { Flame, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  if (!token) {
    return <Navigate to="/forgot-password" replace />;
  }

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Password reset token is missing from the link. Please request a new link.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPassword({
        token,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Failed to reset password. The link may have expired.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to reset password. The link may be invalid or expired.'));
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
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Set New Password</h1>
          <p className="text-xs text-dark-muted mt-1">
            Choose a strong password to protect your streak
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!token && (
          <div className="mb-6 p-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Missing Reset Token</span>
            </div>
            <p className="leading-relaxed text-zinc-300">
              No reset token was found in this link. The link may be incomplete or corrupted.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 font-semibold text-flame-400 hover:text-flame-300 hover:underline"
            >
              <span>Request a new password reset link</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="p-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Password Reset Complete</span>
              </div>
              <p className="leading-relaxed text-zinc-300">
                Your password has been changed successfully. You can now log in using your new password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login', { state: { message: 'Password reset successfully! Please sign in.' } })}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm"
            >
              <span>Sign In to StreakUp</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          token && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="•••••••• (at least 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
};
