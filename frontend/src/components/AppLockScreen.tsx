import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppLock } from '../context/AppLockContext';
import { useAuth } from '../context/AuthContext';
import { Delete, LogOut, HelpCircle, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';
import { useBodyScrollLock } from '../utils/scrollLock';

export const AppLockScreen: React.FC = () => {
  const {
    isAppLockEnabled,
    isLocked,
    lockoutRemainingSeconds,
    securityQuestion,
    verifyAndUnlock,
    verifySecurityAnswerAndResetPin,
  } = useAppLock();

  useBodyScrollLock(isLocked);

  const { user, logout } = useAuth();
  const [pin, setPin] = useState('');
  const pinRef = useRef('');
  pinRef.current = pin;

  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Forgot PIN / Security Question state
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const resetPinWithShake = useCallback((msg: string) => {
    setIsShaking(true);
    setErrorMessage(msg);
    pinRef.current = '';
    setPin('');
    const timer = setTimeout(() => {
      setIsShaking(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Handle PIN submission
  const handleSubmitPin = useCallback(
    async (enteredPin: string) => {
      if (enteredPin.length !== 4 || isVerifying) return;
      setIsVerifying(true);
      setErrorMessage('');

      try {
        const res = await verifyAndUnlock(enteredPin);
        if (!res.success) {
          resetPinWithShake(res.error || 'Incorrect PIN');
        } else {
          pinRef.current = '';
          setPin('');
          setErrorMessage('');
        }
      } catch {
        resetPinWithShake('Verification error. Try again.');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, verifyAndUnlock, resetPinWithShake]
  );

  // Keypad click handlers (Synchronous ref updates prevent lag & dropped digits)
  const handleDigitPress = (digit: string) => {
    if (lockoutRemainingSeconds > 0 || isVerifying) return;
    if (pinRef.current.length < 4) {
      const nextPin = pinRef.current + digit;
      pinRef.current = nextPin;
      setPin(nextPin);
      setErrorMessage('');
      if (nextPin.length === 4) {
        handleSubmitPin(nextPin);
      }
    }
  };

  const handleDeletePress = () => {
    if (lockoutRemainingSeconds > 0 || isVerifying) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setErrorMessage('');
  };

  // Keyboard support for desktop / physical keyboards with stabilized handler
  const lockoutRef = useRef(lockoutRemainingSeconds);
  lockoutRef.current = lockoutRemainingSeconds;
  const isVerifyingRef = useRef(isVerifying);
  isVerifyingRef.current = isVerifying;
  const handleSubmitPinRef = useRef(handleSubmitPin);
  handleSubmitPinRef.current = handleSubmitPin;

  useEffect(() => {
    if (!isLocked || isForgotMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRef.current > 0 || isVerifyingRef.current) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (pinRef.current.length < 4) {
          const nextPin = pinRef.current + e.key;
          pinRef.current = nextPin;
          setPin(nextPin);
          setErrorMessage('');
          if (nextPin.length === 4) {
            handleSubmitPinRef.current(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        const nextPin = pinRef.current.slice(0, -1);
        pinRef.current = nextPin;
        setPin(nextPin);
        setErrorMessage('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isForgotMode]);

  // Clean state when unlocked
  useEffect(() => {
    if (!isLocked) {
      pinRef.current = '';
      setPin('');
      setErrorMessage('');
      setIsForgotMode(false);
      setAnswerInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setForgotError('');
    }
  }, [isLocked]);

  // Handle Security Question PIN Reset
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!answerInput.trim()) {
      setForgotError('Please enter the answer to your security question.');
      return;
    }

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setForgotError('New PIN must be exactly 4 digits.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setForgotError('New PINs do not match. Please verify.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await verifySecurityAnswerAndResetPin(answerInput.trim(), newPinInput);
      if (res.success) {
        setIsForgotMode(false);
        setAnswerInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setForgotError('');
      } else {
        setForgotError(res.error || 'Failed to verify answer.');
      }
    } catch {
      setForgotError('An unexpected error occurred. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isAppLockEnabled || !isLocked) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="StreakUp App Lock"
      className="fixed inset-0 z-[999999] bg-[#09090b] flex flex-col justify-between items-center px-4 py-8 sm:py-12 select-none overflow-y-auto"
      style={{ backgroundColor: '#09090b' }}
    >
      {isForgotMode ? (
        /* FORGOT PIN / SECURITY QUESTION RECOVERY VIEW */
        <div className="w-full max-w-sm flex-1 flex flex-col justify-between my-auto py-4 animate-fadeIn">
          <div>
            <button
              type="button"
              onClick={() => {
                setIsForgotMode(false);
                setForgotError('');
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1.5 mb-6 py-1 px-2.5 rounded-lg hover:bg-dark-surface transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to PIN Entry</span>
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl flex items-center justify-center mx-auto mb-3 ring-1 ring-zinc-700/50">
                <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Reset App Lock PIN</h2>
              <p className="text-xs text-dark-muted mt-1">
                Answer your security question to set a new 4-digit PIN
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 text-xs bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {/* Question display card */}
              <div className="p-3.5 bg-dark-card border border-dark-border rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-flame-400">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Security Question</span>
                </div>
                <p className="text-xs text-zinc-200 font-medium">
                  {securityQuestion || 'What was the name of your first school?'}
                </p>
              </div>

              {/* Answer input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Your Answer
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="Enter your security answer"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80 transition-all font-medium"
                />
              </div>

              {/* New 4-digit PIN */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.4em] font-mono text-lg py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.4em] font-mono text-lg py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting || !answerInput.trim() || newPinInput.length !== 4 || confirmPinInput.length !== 4}
                className="w-full py-2.5 px-4 mt-2 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-flame-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {isResetting ? (
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset PIN & Unlock</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 text-center">
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs text-zinc-400 hover:text-rose-400 transition-colors inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-rose-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Can't remember? Sign out</span>
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD PIN ENTRY KEYPAD VIEW */
        <>
          {/* Top Header: Logo & Greeting */}
          <div className="flex flex-col items-center text-center mt-4 sm:mt-8 max-w-sm">
            {/* Official StreakUp Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl flex items-center justify-center mb-5 ring-1 ring-zinc-700/50">
              <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">Welcome back</h1>
            <p className="text-xs sm:text-sm text-dark-muted mt-1.5 font-medium">
              {user?.name ? `${user.name.split(' ')[0]}, enter your PIN to continue` : 'Enter your 4-digit PIN to continue'}
            </p>

            {/* 4-Dot PIN Indicator */}
            <div
              className={`flex items-center gap-4 my-8 transition-transform ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-75 ${
                      isFilled
                        ? errorMessage
                          ? 'bg-rose-500 ring-4 ring-rose-500/25 scale-110'
                          : 'bg-flame-500 ring-4 ring-flame-500/25 shadow-lg shadow-flame-500/40 scale-110'
                        : 'bg-zinc-800 border border-zinc-700/80'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error / Lockout Messages */}
            <div className="h-6">
              {lockoutRemainingSeconds > 0 ? (
                <p className="text-xs font-semibold text-amber-400">
                  Locked due to failed attempts. Try again in {lockoutRemainingSeconds}s
                </p>
              ) : errorMessage ? (
                <p className="text-xs font-semibold text-rose-400 animate-fadeIn">{errorMessage}</p>
              ) : null}
            </div>
          </div>

          {/* Center Numeric Keypad */}
          <div className="w-full max-w-xs my-4">
            <div className="grid grid-cols-3 gap-y-4 gap-x-6 place-items-center">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  disabled={lockoutRemainingSeconds > 0 || isVerifying}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 text-xl font-bold text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-30 disabled:pointer-events-none touch-manipulation select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Row 4: Empty space placeholder for symmetry, 0, Backspace */}
              <div className="w-16 h-16 sm:w-18 sm:h-18" aria-hidden="true" />

              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                disabled={lockoutRemainingSeconds > 0 || isVerifying}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 text-xl font-bold text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-30 disabled:pointer-events-none touch-manipulation select-none"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDeletePress}
                disabled={lockoutRemainingSeconds > 0 || isVerifying || pin.length === 0}
                title="Delete last digit"
                aria-label="Delete last digit"
                className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center text-zinc-400 hover:text-zinc-200 active:scale-90 transition-all disabled:opacity-20 disabled:pointer-events-none touch-manipulation select-none"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Bottom Footer: Forgot PIN with Security Question & Sign Out */}
          <div className="pt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsForgotMode(true);
                setForgotError('');
              }}
              className="text-xs font-semibold text-flame-400 hover:text-flame-300 py-1.5 px-3 rounded-lg hover:bg-flame-500/10 transition-colors inline-flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Forgot PIN?</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors inline-flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-rose-500/10"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
