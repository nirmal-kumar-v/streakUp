import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { Flame, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to process password reset.'));
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
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Password Recovery</h1>
          <p className="text-xs text-dark-muted mt-1">
            We will send a secure link to reset your password
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-6">
            <div className="p-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Check your email</span>
              </div>
              <p className="leading-relaxed text-zinc-300">
                If an account exists with <strong className="text-zinc-100 font-mono">{email}</strong>, you will receive an email with a link to reset your password.
              </p>
              <p className="text-zinc-400 text-[11px]">
                The link is valid for 1 hour. Be sure to check your spam or promotions folder if you don't see it within a couple of minutes.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="w-full text-xs text-zinc-400 hover:text-zinc-200 py-1 font-medium transition-colors"
              >
                Try a different email address
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
              </div>
              <p className="text-[11px] text-dark-muted mt-1.5">
                Enter the email address associated with your StreakUp account.
              </p>
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
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
