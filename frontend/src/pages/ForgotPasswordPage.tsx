import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resendPasswordResetOtp, resetPassword } from '../api/auth';
import {
  Mail,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  // Step state: 'email' | 'reset' | 'success'
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Timer for resend OTP cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP to email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await forgotPassword(cleanEmail);
      if (res.success) {
        setStep('reset');
        setResendCooldown(60);
        setInfoMessage('A 6-digit verification code has been sent to your email.');
      } else {
        setError(res.error || 'Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to process request. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await resendPasswordResetOtp(email.trim().toLowerCase());
      if (res.success) {
        setResendCooldown(60);
        setInfoMessage('A new 6-digit code has been sent to your email.');
      } else {
        setError(res.error || 'Failed to resend code. Please try again.');
        if (res.retryAfterSeconds) {
          setResendCooldown(res.retryAfterSeconds);
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to resend verification code.'));
    } finally {
      setIsResending(false);
    }
  };

  // Step 2: Submit OTP and new password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPassword({
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || 'Failed to reset password. Please check your verification code.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to reset password. The code may be invalid or expired.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel relative">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 mb-3 shadow-sm">
            <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">
            {step === 'email' && 'Password Recovery'}
            {step === 'reset' && 'Reset Your Password'}
            {step === 'success' && 'Password Reset Complete'}
          </h1>
          <p className="text-xs text-dark-muted mt-1">
            {step === 'email' && 'Enter your email to receive a 6-digit reset code'}
            {step === 'reset' && 'Enter the code from your email and set your new password'}
            {step === 'success' && 'Your password has been changed successfully'}
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Global Info/Success Banner */}
        {infoMessage && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-4">
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
                We'll send a 6-digit verification code to this address.
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
                  <span>Send Reset Code</span>
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

        {/* STEP 2: Enter OTP + New Password + Confirm Password */}
        {step === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            {/* Target Email Info & Change Option */}
            <div className="flex items-center justify-between p-3 bg-dark-surface/60 border border-dark-border rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate text-zinc-300">
                <Mail className="w-3.5 h-3.5 text-flame-400 flex-shrink-0" />
                <span className="truncate font-mono">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError('');
                  setInfoMessage('');
                }}
                className="text-[11px] text-flame-400 hover:text-flame-300 font-semibold transition-colors flex-shrink-0 ml-2"
              >
                Change
              </button>
            </div>

            {/* OTP Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  6-Digit Verification Code
                </label>
                <span className="text-[11px] text-dark-muted">Expires in 5 min</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm font-mono tracking-widest text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all text-left"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-zinc-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
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

            {/* Resend OTP & Help */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              {resendCooldown > 0 ? (
                <span className="text-dark-muted text-[11px]">
                  Resend code in <strong className="text-zinc-300 font-mono">{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="inline-flex items-center gap-1.5 text-flame-400 hover:text-flame-300 font-semibold transition-colors disabled:opacity-50"
                >
                  {isResending ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5" />
                  )}
                  <span>Resend verification code</span>
                </button>
              )}

              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 transition-colors font-medium mt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel and return to Sign In</span>
              </Link>
            </div>
          </form>
        )}

        {/* STEP 3: Success State */}
        {step === 'success' && (
          <div className="space-y-6">
            <div className="p-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Password Changed Successfully</span>
              </div>
              <p className="leading-relaxed text-zinc-300">
                Your StreakUp password has been reset. You can now use your new password to sign in.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/login', {
                  state: { message: 'Password reset successfully! Please sign in with your new password.' },
                })
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
