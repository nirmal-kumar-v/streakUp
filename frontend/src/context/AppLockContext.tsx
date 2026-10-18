import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  generateSalt,
  hashPin,
  verifyPinHash,
  hashSecurityAnswer,
  verifySecurityAnswerHash,
} from '../utils/pinSecurity';

export interface StoredAppLockData {
  enabled: boolean;
  salt: string;
  pinHash: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

interface AppLockContextType {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  hasPinSet: boolean;
  failedAttempts: number;
  lockoutRemainingSeconds: number;
  securityQuestion?: string;
  setupPin: (pin: string, securityQuestion?: string, securityAnswer?: string) => Promise<boolean>;
  changePin: (
    currentPin: string,
    newPin: string,
    securityQuestion?: string,
    securityAnswer?: string
  ) => Promise<{ success: boolean; error?: string }>;
  disableAppLock: (currentPin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; error?: string }>;
  verifySecurityAnswerAndResetPin: (answer: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  lockApp: () => void;
  unlockApp: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

// App locks when coming out of the app for 10 seconds or more
const BACKGROUND_LOCK_THRESHOLD_MS = 10 * 1000;

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || 'guest';

  const configStorageKey = `streakup_applock_${userId}`;
  const lockoutStorageKey = `streakup_applock_lockout_${userId}`;
  const attemptsStorageKey = `streakup_applock_attempts_${userId}`;
  const bgStorageKey = `streakup_applock_bg_${userId}`;
  const lastActiveStorageKey = `streakup_applock_active_${userId}`;
  const sessionUnlockedKey = `streakup_applock_unlocked_${userId}`;

  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState<string | undefined>(undefined);

  // Initialize failed attempts and lockout state from localStorage to prevent refresh bypass
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(attemptsStorageKey);
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(lockoutStorageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed > Date.now()) {
          return parsed;
        }
        localStorage.removeItem(lockoutStorageKey);
      }
    } catch {}
    return null;
  });

  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(lockoutStorageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed > Date.now()) {
          return Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
        }
      }
    } catch {}
    return 0;
  });

  const lastBackgroundedRef = useRef<number | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const lastStorageWriteRef = useRef<number>(Date.now());

  // Load stored App Lock configuration for the current authenticated user
  const loadStoredConfig = useCallback(() => {
    if (!isAuthenticated || !userId || userId === 'guest') {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setSecurityQuestion(undefined);
      return;
    }

    try {
      const raw = localStorage.getItem(configStorageKey);
      if (raw) {
        const parsed: StoredAppLockData = JSON.parse(raw);
        if (parsed.enabled && parsed.pinHash && parsed.salt) {
          setIsAppLockEnabled(true);
          setHasPinSet(true);
          setSecurityQuestion(parsed.securityQuestion);

          // Check if user is locked out due to wrong PIN attempts
          const storedLockout = localStorage.getItem(lockoutStorageKey);
          const parsedLockout = storedLockout ? parseInt(storedLockout, 10) : null;
          const isCurrentlyLockedOut = parsedLockout ? parsedLockout > Date.now() : false;

          if (isCurrentlyLockedOut) {
            setIsLocked(true);
            setLockoutUntil(parsedLockout);
            setFailedAttempts(5);
            setLockoutRemainingSeconds(Math.max(0, Math.ceil(((parsedLockout || 0) - Date.now()) / 1000)));
            return;
          }

          // Check background duration and persistent unlock state
          const isUnlocked = localStorage.getItem(sessionUnlockedKey) === 'true';
          const storedActive = localStorage.getItem(lastActiveStorageKey);
          const storedBg = localStorage.getItem(bgStorageKey);
          const lastActiveTime = storedActive ? parseInt(storedActive, 10) : 0;
          const lastBgTime = storedBg ? parseInt(storedBg, 10) : 0;
          const mostRecentActivity = Math.max(lastActiveTime, lastBgTime);

          const elapsedSinceActivity = mostRecentActivity > 0 ? Date.now() - mostRecentActivity : Infinity;

          if (isUnlocked && elapsedSinceActivity < BACKGROUND_LOCK_THRESHOLD_MS) {
            // Already unlocked and active within the 10-second threshold (or in-app navigation)
            setIsLocked(false);
            localStorage.setItem(lastActiveStorageKey, String(Date.now()));
            localStorage.removeItem(bgStorageKey);
          } else {
            // Cold start or away for >= 10 seconds
            setIsLocked(true);
            localStorage.removeItem(sessionUnlockedKey);
          }
        } else {
          setIsAppLockEnabled(false);
          setHasPinSet(false);
          setIsLocked(false);
          setSecurityQuestion(undefined);
        }
      } else {
        setIsAppLockEnabled(false);
        setHasPinSet(false);
        setIsLocked(false);
        setSecurityQuestion(undefined);
      }
    } catch {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setSecurityQuestion(undefined);
    }
  }, [isAuthenticated, userId, configStorageKey, lockoutStorageKey, bgStorageKey, lastActiveStorageKey, sessionUnlockedKey]);

  useEffect(() => {
    loadStoredConfig();
  }, [loadStoredConfig]);

  // Lockout countdown timer with persistent sync
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemainingSeconds(0);
      return;
    }

    const checkLockout = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemainingSeconds(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        try {
          localStorage.removeItem(lockoutStorageKey);
          localStorage.removeItem(attemptsStorageKey);
        } catch {}
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 500);
    return () => clearInterval(interval);
  }, [lockoutUntil, lockoutStorageKey, attemptsStorageKey]);

  // Handle background / foreground transitions:
  // App locks ONLY after 10 seconds of coming out of the app
  useEffect(() => {
    if (!isAppLockEnabled || !isAuthenticated || userId === 'guest') return;

    const handleExitApp = () => {
      const now = Date.now();
      lastBackgroundedRef.current = now;
      try {
        localStorage.setItem(bgStorageKey, String(now));
        localStorage.setItem(lastActiveStorageKey, String(now));
      } catch {}
    };

    const handleReturnToApp = () => {
      const now = Date.now();
      let exitTime = lastBackgroundedRef.current;
      if (!exitTime) {
        try {
          const stored = localStorage.getItem(bgStorageKey);
          if (stored) exitTime = parseInt(stored, 10);
        } catch {}
      }

      if (!exitTime) {
        try {
          const storedActive = localStorage.getItem(lastActiveStorageKey);
          if (storedActive) exitTime = parseInt(storedActive, 10);
        } catch {}
      }

      if (exitTime && exitTime > 0) {
        const elapsed = now - exitTime;
        // Lock ONLY if away for >= 10 seconds
        if (elapsed >= BACKGROUND_LOCK_THRESHOLD_MS) {
          setIsLocked(true);
          try {
            localStorage.removeItem(sessionUnlockedKey);
          } catch {}
        }
      }

      lastBackgroundedRef.current = null;
      lastActiveRef.current = now;
      try {
        localStorage.removeItem(bgStorageKey);
        localStorage.setItem(lastActiveStorageKey, String(now));
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleExitApp();
      } else if (document.visibilityState === 'visible') {
        handleReturnToApp();
      }
    };

    const handlePageHide = () => {
      handleExitApp();
    };

    const handlePageShow = () => {
      handleReturnToApp();
    };

    // User interaction heartbeat to ensure in-app usage never triggers a lock
    const recordUserActivity = () => {
      const now = Date.now();
      lastActiveRef.current = now;
      if (now - lastStorageWriteRef.current > 2000) {
        lastStorageWriteRef.current = now;
        try {
          localStorage.setItem(lastActiveStorageKey, String(now));
        } catch {}
      }
    };

    const activityEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'scroll'];
    activityEvents.forEach((ev) => window.addEventListener(ev, recordUserActivity, { passive: true }));

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, recordUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isAppLockEnabled, isAuthenticated, userId, bgStorageKey, lastActiveStorageKey, sessionUnlockedKey]);

  // Setup / Enable PIN with optional Security Question & Answer
  const setupPin = async (
    pin: string,
    secQuestion?: string,
    secAnswer?: string
  ): Promise<boolean> => {
    if (!user || pin.length < 4) return false;

    try {
      const salt = generateSalt();
      const pinHash = await hashPin(pin, salt, userId);

      let answerHash: string | undefined = undefined;
      if (secQuestion && secAnswer && secAnswer.trim()) {
        answerHash = await hashSecurityAnswer(secAnswer, salt, userId);
      }

      const config: StoredAppLockData = {
        enabled: true,
        salt,
        pinHash,
        securityQuestion: secQuestion?.trim() || undefined,
        securityAnswerHash: answerHash,
      };

      localStorage.setItem(configStorageKey, JSON.stringify(config));
      setIsAppLockEnabled(true);
      setHasPinSet(true);
      setSecurityQuestion(config.securityQuestion);
      setIsLocked(false);
      setFailedAttempts(0);
      setLockoutUntil(null);
      localStorage.removeItem(lockoutStorageKey);
      localStorage.removeItem(attemptsStorageKey);
      localStorage.removeItem(bgStorageKey);
      localStorage.setItem(sessionUnlockedKey, 'true');
      localStorage.setItem(lastActiveStorageKey, String(Date.now()));
      lastBackgroundedRef.current = null;
      lastActiveRef.current = Date.now();

      return true;
    } catch (err) {
      console.error('[AppLock] Failed to setup PIN:', err);
      return false;
    }
  };

  // Change PIN (requires validating current PIN first)
  const changePin = async (
    currentPin: string,
    newPin: string,
    secQuestion?: string,
    secAnswer?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const raw = localStorage.getItem(configStorageKey);
    if (!raw) return { success: false, error: 'App lock configuration not found.' };

    try {
      const parsed: StoredAppLockData = JSON.parse(raw);
      const isCurrentValid = await verifyPinHash(currentPin, parsed.salt, parsed.pinHash, userId);
      if (!isCurrentValid) {
        return { success: false, error: 'Current PIN is incorrect.' };
      }

      if (newPin.length < 4) {
        return { success: false, error: 'New PIN must be at least 4 digits.' };
      }

      const newSalt = generateSalt();
      const newHash = await hashPin(newPin, newSalt, userId);

      let newAnswerHash: string | undefined = undefined;
      let finalQuestion = parsed.securityQuestion;

      if (secQuestion && secAnswer && secAnswer.trim()) {
        finalQuestion = secQuestion.trim();
        newAnswerHash = await hashSecurityAnswer(secAnswer, newSalt, userId);
      } else if (parsed.securityAnswerHash) {
        // If question not changed but was present, keep existing answer hash
        newAnswerHash = parsed.securityAnswerHash;
      }

      const updated: StoredAppLockData = {
        ...parsed,
        salt: newSalt,
        pinHash: newHash,
        securityQuestion: finalQuestion,
        securityAnswerHash: newAnswerHash,
      };

      localStorage.setItem(configStorageKey, JSON.stringify(updated));
      setFailedAttempts(0);
      setSecurityQuestion(finalQuestion);
      localStorage.removeItem(attemptsStorageKey);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to update PIN.' };
    }
  };

  // Disable App Lock (requires validating current PIN first)
  const disableAppLock = async (currentPin: string): Promise<{ success: boolean; error?: string }> => {
    const raw = localStorage.getItem(configStorageKey);
    if (!raw) {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setSecurityQuestion(undefined);
      return { success: true };
    }

    try {
      const parsed: StoredAppLockData = JSON.parse(raw);
      const isCurrentValid = await verifyPinHash(currentPin, parsed.salt, parsed.pinHash, userId);
      if (!isCurrentValid) {
        return { success: false, error: 'Incorrect PIN. Unable to disable App Lock.' };
      }

      localStorage.removeItem(configStorageKey);
      localStorage.removeItem(lockoutStorageKey);
      localStorage.removeItem(attemptsStorageKey);
      localStorage.removeItem(bgStorageKey);
      localStorage.removeItem(lastActiveStorageKey);
      localStorage.removeItem(sessionUnlockedKey);

      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setSecurityQuestion(undefined);
      setFailedAttempts(0);
      setLockoutUntil(null);
      lastBackgroundedRef.current = null;
      lastActiveRef.current = Date.now();

      return { success: true };
    } catch {
      return { success: false, error: 'Failed to disable App Lock.' };
    }
  };

  // Verify PIN entered by user on the lock screen
  const verifyAndUnlock = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    // Check persistent lockout state to prevent refresh bypass
    const rawLockout = localStorage.getItem(lockoutStorageKey);
    const parsedLockout = rawLockout ? parseInt(rawLockout, 10) : null;
    const effectiveLockout = lockoutUntil || (parsedLockout && parsedLockout > Date.now() ? parsedLockout : null);

    if (effectiveLockout && Date.now() < effectiveLockout) {
      const secs = Math.ceil((effectiveLockout - Date.now()) / 1000);
      return { success: false, error: `Too many failed attempts. Try again in ${secs}s.` };
    }

    const raw = localStorage.getItem(configStorageKey);
    if (!raw) {
      setIsLocked(false);
      return { success: true };
    }

    try {
      const parsed: StoredAppLockData = JSON.parse(raw);
      const isValid = await verifyPinHash(pin, parsed.salt, parsed.pinHash, userId);

      if (isValid) {
        setIsLocked(false);
        setFailedAttempts(0);
        setLockoutUntil(null);
        localStorage.removeItem(lockoutStorageKey);
        localStorage.removeItem(attemptsStorageKey);
        localStorage.removeItem(bgStorageKey);
        localStorage.setItem(sessionUnlockedKey, 'true');
        localStorage.setItem(lastActiveStorageKey, String(Date.now()));
        lastBackgroundedRef.current = null;
        lastActiveRef.current = Date.now();
        return { success: true };
      } else {
        const storedAttempts = parseInt(localStorage.getItem(attemptsStorageKey) || '0', 10);
        const nextFailed = Math.max(failedAttempts, storedAttempts) + 1;

        setFailedAttempts(nextFailed);
        localStorage.setItem(attemptsStorageKey, String(nextFailed));

        if (nextFailed >= 5) {
          const lockTime = Date.now() + 30 * 1000; // 30s lockout
          setLockoutUntil(lockTime);
          setLockoutRemainingSeconds(30);
          localStorage.setItem(lockoutStorageKey, String(lockTime));
          return { success: false, error: 'Too many incorrect attempts. Locked for 30 seconds.' };
        }

        return { success: false, error: `Incorrect PIN. (${5 - nextFailed} attempts remaining)` };
      }
    } catch {
      return { success: false, error: 'PIN verification failed.' };
    }
  };

  // Verify Security Question Answer and Reset PIN (No OTP required)
  const verifySecurityAnswerAndResetPin = async (
    answer: string,
    newPin: string
  ): Promise<{ success: boolean; error?: string }> => {
    const raw = localStorage.getItem(configStorageKey);
    if (!raw) return { success: false, error: 'App lock configuration not found.' };

    try {
      const parsed: StoredAppLockData = JSON.parse(raw);
      if (!parsed.securityAnswerHash || !parsed.salt) {
        return {
          success: false,
          error: 'No security question is configured. Please sign out to regain access.',
        };
      }

      if (!answer.trim()) {
        return { success: false, error: 'Please enter your security answer.' };
      }

      const isAnswerValid = await verifySecurityAnswerHash(answer, parsed.salt, parsed.securityAnswerHash, userId);
      if (!isAnswerValid) {
        return { success: false, error: 'Incorrect answer. Please check your answer and try again.' };
      }

      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return { success: false, error: 'New PIN must be exactly 4 numeric digits.' };
      }

      const newSalt = generateSalt();
      const newPinHash = await hashPin(newPin, newSalt, userId);
      const newAnswerHash = await hashSecurityAnswer(answer, newSalt, userId);

      const updated: StoredAppLockData = {
        ...parsed,
        salt: newSalt,
        pinHash: newPinHash,
        securityAnswerHash: newAnswerHash,
      };

      localStorage.setItem(configStorageKey, JSON.stringify(updated));
      localStorage.removeItem(lockoutStorageKey);
      localStorage.removeItem(attemptsStorageKey);
      localStorage.removeItem(bgStorageKey);
      localStorage.setItem(sessionUnlockedKey, 'true');
      localStorage.setItem(lastActiveStorageKey, String(Date.now()));

      setFailedAttempts(0);
      setLockoutUntil(null);
      setLockoutRemainingSeconds(0);
      setIsLocked(false);
      lastBackgroundedRef.current = null;
      lastActiveRef.current = Date.now();

      return { success: true };
    } catch {
      return { success: false, error: 'Failed to reset PIN. Please try again.' };
    }
  };

  const lockApp = () => {
    if (isAppLockEnabled) {
      setIsLocked(true);
      localStorage.removeItem(sessionUnlockedKey);
    }
  };

  const unlockApp = () => {
    setIsLocked(false);
    localStorage.setItem(sessionUnlockedKey, 'true');
    localStorage.setItem(lastActiveStorageKey, String(Date.now()));
    localStorage.removeItem(bgStorageKey);
    lastBackgroundedRef.current = null;
    lastActiveRef.current = Date.now();
  };

  return (
    <AppLockContext.Provider
      value={{
        isAppLockEnabled,
        isLocked,
        hasPinSet,
        failedAttempts,
        lockoutRemainingSeconds,
        securityQuestion,
        setupPin,
        changePin,
        disableAppLock,
        verifyAndUnlock,
        verifySecurityAnswerAndResetPin,
        lockApp,
        unlockApp,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = (): AppLockContextType => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
