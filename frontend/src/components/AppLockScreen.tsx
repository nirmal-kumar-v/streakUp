import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppLock } from '../context/AppLockContext';
import { useAuth } from '../context/AuthContext';
import { Delete, Fingerprint, ScanFace, LogOut } from 'lucide-react';

export const AppLockScreen: React.FC = () => {
  const {
    isAppLockEnabled,
    isLocked,
    biometricsEnabled,
    biometryType,
    isBiometricsAvailable,
    lockoutRemainingSeconds,
    verifyAndUnlock,
    triggerBiometricUnlock,
  } = useAppLock();

  const { user, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const hasTriggeredBiometricsRef = useRef(false);

  const resetPinWithShake = useCallback((msg: string) => {
    setIsShaking(true);
    setErrorMessage(msg);
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

  // Keypad click handlers
  const handleDigitPress = (digit: string) => {
    if (lockoutRemainingSeconds > 0 || isVerifying) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage('');
      if (nextPin.length === 4) {
        handleSubmitPin(nextPin);
      }
    }
  };

  const handleDeletePress = () => {
    if (lockoutRemainingSeconds > 0 || isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  // Keyboard support for desktop / physical keyboards
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRemainingSeconds > 0 || isVerifying) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (pin.length < 4) {
          const nextPin = pin + e.key;
          setPin(nextPin);
          setErrorMessage('');
          if (nextPin.length === 4) {
            handleSubmitPin(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
        setErrorMessage('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin, lockoutRemainingSeconds, isVerifying, handleSubmitPin]);

  // Auto-trigger biometric prompt once upon presentation if enabled
  useEffect(() => {
    if (
      isLocked &&
      biometricsEnabled &&
      isBiometricsAvailable &&
      !hasTriggeredBiometricsRef.current &&
      lockoutRemainingSeconds <= 0
    ) {
      hasTriggeredBiometricsRef.current = true;
      triggerBiometricUnlock().catch(() => {});
    }

    if (!isLocked) {
      hasTriggeredBiometricsRef.current = false;
      setPin('');
      setErrorMessage('');
    }
  }, [isLocked, biometricsEnabled, isBiometricsAvailable, lockoutRemainingSeconds, triggerBiometricUnlock]);

  if (!isAppLockEnabled || !isLocked) {
    return null;
  }

  const isBiometricUsable = biometricsEnabled && isBiometricsAvailable && lockoutRemainingSeconds <= 0;
  const isFaceId = biometryType === 'face';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="StreakUp App Lock"
      className="fixed inset-0 z-[999999] bg-[#09090b] flex flex-col justify-between items-center px-4 py-8 sm:py-12 select-none overflow-y-auto"
      style={{ backgroundColor: '#09090b' }}
    >
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
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
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
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 text-xl font-bold text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-30 disabled:pointer-events-none"
            >
              {digit}
            </button>
          ))}

          {/* Row 4: Biometric / Empty, 0, Backspace */}
          <div className="w-16 h-16 flex items-center justify-center">
            {isBiometricUsable ? (
              <button
                type="button"
                onClick={() => triggerBiometricUnlock()}
                title="Unlock with Biometrics"
                aria-label="Unlock with Biometrics"
                className="w-14 h-14 rounded-full bg-flame-500/10 border border-flame-500/30 text-flame-400 hover:bg-flame-500/20 active:scale-95 transition-all flex items-center justify-center"
              >
                {isFaceId ? <ScanFace className="w-6 h-6" /> : <Fingerprint className="w-6 h-6" />}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            disabled={lockoutRemainingSeconds > 0 || isVerifying}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 text-xl font-bold text-zinc-100 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-30 disabled:pointer-events-none"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDeletePress}
            disabled={lockoutRemainingSeconds > 0 || isVerifying || pin.length === 0}
            title="Delete last digit"
            aria-label="Delete last digit"
            className="w-16 h-16 flex items-center justify-center text-zinc-400 hover:text-zinc-200 active:scale-90 transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Biometric Text Prompt (Alternative if user prefers tapping button) */}
        {isBiometricUsable && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => triggerBiometricUnlock()}
              className="text-xs font-semibold text-flame-400 hover:text-flame-300 inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-flame-500/10 transition-colors"
            >
              {isFaceId ? <ScanFace className="w-3.5 h-3.5" /> : <Fingerprint className="w-3.5 h-3.5" />}
              <span>{isFaceId ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer: Forgot PIN / Sign Out */}
      <div className="pt-4 text-center">
        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-zinc-400 hover:text-rose-400 transition-colors inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-rose-500/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Forgot PIN? Sign out</span>
        </button>
      </div>
    </div>
  );
};
