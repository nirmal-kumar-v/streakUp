import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { registerUser, verifySignupOtp, resendSignupOtp } from '../api/auth';
import { fetchTimezones, TimezoneOption } from '../api/user';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, Lock, User as UserIcon, Mail, Globe, CheckCircle2, RotateCw, KeyRound, Edit2 } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';
import { PolicyModal } from '../components/PolicyModal';
import { CustomSelect } from '../components/CustomSelect';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);

  // OTP state
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Terms and Privacy acceptance
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalTab, setPolicyModalTab] = useState<'terms' | 'privacy'>('terms');

  useEffect(() => {
    fetchTimezones().then((res) => {
      if (res.success) {
        setTimezones(res.timezones);
        if (res.defaultTimezone) setTimezone(res.defaultTimezone);
      }
    }).catch(() => {});

    // Check if redirected here to verify an existing unverified account
    const urlStep = searchParams.get('step');
    const urlEmail = searchParams.get('email');
    if (urlStep === 'verify' && urlEmail) {
      setEmail(urlEmail);
      setStep('verify');
      setResendCooldown(30);
    }
  }, [searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms & Conditions and acknowledge the Privacy Policy to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerUser({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        timezone,
        termsAccepted: true,
        termsVersion: '1.0',
      });

      // Record client-side acceptance timestamp
      try {
        localStorage.setItem(
          'streakup_terms_accepted_v1',
          JSON.stringify({ version: '1.0', acceptedAt: new Date().toISOString() })
        );
      } catch {}

      if (res.success && res.pendingVerification) {
        setStep('verify');
        setResendCooldown(60);
        setSuccessMessage(res.message || 'Verification code sent to your email.');
      } else if (res.success && res.token && res.user) {
        // Fallback in case immediately verified
        login(res.token, res.user);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'An error occurred during registration.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await verifySignupOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Verification failed. Please check the code.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to verify code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const res = await resendSignupOtp(email.trim().toLowerCase());
      if (res.success) {
        setSuccessMessage('A new 6-digit verification code has been sent to your email.');
        setResendCooldown(60);
      } else {
        setError(res.error || 'Failed to resend code.');
        if (res.retryAfterSeconds) {
          setResendCooldown(res.retryAfterSeconds);
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to resend verification code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 mb-3 shadow-sm">
            {step === 'register' ? (
              <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
            ) : (
              <KeyRound className="w-6 h-6 text-flame-500" />
            )}
          </div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">
            {step === 'register' ? 'Create your account' : 'Verify your email'}
          </h1>
          <p className="text-xs text-dark-muted mt-1">
            {step === 'register'
              ? 'Build consecutive streaks and compete with friends'
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {step === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Nirmal Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Username</label>
              <div className="relative">
                <span className="text-sm font-semibold text-dark-muted absolute left-3.5 top-1/2 -translate-y-1/2 select-none">
                  @
                </span>
                <input
                  type="text"
                  required
                  placeholder="nirmal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="email"
                  required
                  placeholder="nirmal@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Timezone (Streak Calendar)
              </label>
              <CustomSelect
                value={timezone}
                onChange={(val) => setTimezone(val)}
                options={timezones.map((tz) => ({
                  value: tz.value,
                  label: tz.label,
                  icon: <Globe className="w-4 h-4 text-dark-muted shrink-0" />,
                }))}
                searchable={true}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Confirm Password</label>
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

            {/* Terms & Privacy Acceptance Checkbox */}
            <div className="flex items-start gap-2.5 pt-2 text-xs">
              <input
                type="checkbox"
                id="agreeToTerms"
                checked={agreeToTerms}
                onChange={(e) => {
                  setAgreeToTerms(e.target.checked);
                  if (error.includes('Terms')) setError('');
                }}
                className="mt-0.5 w-4 h-4 rounded bg-dark-surface border-dark-border text-flame-500 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0"
              />
              <label htmlFor="agreeToTerms" className="text-zinc-400 leading-relaxed cursor-pointer select-none">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPolicyModalTab('terms');
                    setPolicyModalOpen(true);
                  }}
                  className="text-flame-400 hover:text-flame-300 font-semibold underline underline-offset-2"
                >
                  Terms & Conditions
                </button>{' '}
                and acknowledge the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPolicyModalTab('privacy');
                    setPolicyModalOpen(true);
                  }}
                  className="text-flame-400 hover:text-flame-300 font-semibold underline underline-offset-2"
                >
                  Privacy Policy
                </button>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Send Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="p-3.5 bg-dark-surface/60 border border-dark-border rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-300 truncate">
                <Mail className="w-4 h-4 text-flame-400 flex-shrink-0" />
                <span className="truncate font-mono">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('register')}
                className="text-xs text-flame-400 hover:text-flame-300 flex items-center gap-1 flex-shrink-0 font-medium"
              >
                <Edit2 className="w-3 h-3" />
                <span>Change</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 text-center">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full py-3 text-center text-2xl font-mono tracking-[0.5em] bg-dark-surface border border-dark-border rounded-2xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-flame-500 transition-all font-bold"
              />
              <p className="text-[11px] text-dark-muted text-center mt-2">
                Code expires in 5 minutes. Never share this code.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl shadow-lg shadow-flame-500/20 transition-all text-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify & Activate Account</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                disabled={resendCooldown > 0 || isSubmitting}
                onClick={handleResendOtp}
                className="text-xs text-zinc-400 hover:text-flame-400 disabled:opacity-40 disabled:hover:text-zinc-400 inline-flex items-center gap-1.5 transition-colors font-medium"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                {resendCooldown > 0 ? (
                  <span>Resend code in {resendCooldown}s</span>
                ) : (
                  <span>Resend verification code</span>
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-dark-border text-center">
          <p className="text-xs text-dark-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-flame-400 hover:text-flame-300 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Policy Modal for reading without losing registration form inputs */}
      <PolicyModal
        isOpen={policyModalOpen}
        initialTab={policyModalTab}
        onClose={() => setPolicyModalOpen(false)}
      />
    </div>
  );
};
