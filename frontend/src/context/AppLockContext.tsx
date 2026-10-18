import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { generateSalt, hashPin, verifyPinHash } from '../utils/pinSecurity';

interface StoredAppLockData {
  enabled: boolean;
  salt: string;
  pinHash: string;
}

interface AppLockContextType {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  hasPinSet: boolean;
  failedAttempts: number;
  lockoutRemainingSeconds: number;
  setupPin: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  disableAppLock: (currentPin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; error?: string }>;
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
  const sessionUnlockedKey = `streakup_applock_unlocked_${userId}`;

  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

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

  // Load stored App Lock configuration for the current authenticated user
  const loadStoredConfig = useCallback(() => {
    if (!isAuthenticated || !user) {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      return;
    }

    try {
      const raw = localStorage.getItem(configStorageKey);
      if (raw) {
        const parsed: StoredAppLockData = JSON.parse(raw);
        if (parsed.enabled && parsed.pinHash && parsed.salt) {
          setIsAppLockEnabled(true);
          setHasPinSet(true);

          // Check if user is locked out due to wrong PIN attempts
          const storedLockout = localStorage.getItem(lockoutStorageKey);
          const parsedLockout = storedLockout ? parseInt(storedLockout, 10) : null;
          const isCurrentlyLockedOut = parsedLockout ? parsedLockout > Date.now() : false;

          // Check background duration and session unlock state
          const isSessionUnlocked = sessionStorage.getItem(sessionUnlockedKey) === 'true';
          const storedBg = localStorage.getItem(bgStorageKey);
          const lastBgTime = storedBg ? parseInt(storedBg, 10) : 0;
          const elapsedSinceBg = lastBgTime > 0 ? Date.now() - lastBgTime : 0;

          if (isCurrentlyLockedOut) {
            // Must stay locked if lockout penalty is active
            setIsLocked(true);
            setLockoutUntil(parsedLockout);
            setFailedAttempts(5);
            setLockoutRemainingSeconds(Math.max(0, Math.ceil(((parsedLockout || 0) - Date.now()) / 1000)));
          } else if (!isSessionUnlocked || elapsedSinceBg >= BACKGROUND_LOCK_THRESHOLD_MS) {
            // Cold start or away for >= 10 seconds
            setIsLocked(true);
            sessionStorage.removeItem(sessionUnlockedKey);
          } else {
            setIsLocked(false);
          }
        } else {
          setIsAppLockEnabled(false);
          setHasPinSet(false);
          setIsLocked(false);
        }
      } else {
        setIsAppLockEnabled(false);
        setHasPinSet(false);
        setIsLocked(false);
      }
    } catch {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
    }
  }, [isAuthenticated, user, configStorageKey, lockoutStorageKey, bgStorageKey, sessionUnlockedKey]);

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
    if (!isAppLockEnabled || !isAuthenticated) return;

    const handleExitApp = () => {
      const now = Date.now();
      lastBackgroundedRef.current = now;
      try {
        localStorage.setItem(bgStorageKey, String(now));
      } catch {}
    };

    const handleReturnToApp = () => {
      const now = Date.now();
      let bgTime = lastBackgroundedRef.current;
      if (!bgTime) {
        try {
          const stored = localStorage.getItem(bgStorageKey);
          if (stored) bgTime = parseInt(stored, 10);
        } catch {}
      }

      if (bgTime) {
        const elapsed = now - bgTime;
        if (elapsed >= BACKGROUND_LOCK_THRESHOLD_MS) {
          setIsLocked(true);
          try {
            sessionStorage.removeItem(sessionUnlockedKey);
          } catch {}
        }
      }

      lastBackgroundedRef.current = null;
      try {
        localStorage.removeItem(bgStorageKey);
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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isAppLockEnabled, isAuthenticated, bgStorageKey, sessionUnlockedKey]);

  // Setup / Enable PIN
  const setupPin = async (pin: string): Promise<boolean> => {
    if (!user || pin.length < 4) return false;

    try {
      const salt = generateSalt();
      const pinHash = await hashPin(pin, salt, userId);

      const config: StoredAppLockData = {
        enabled: true,
        salt,
        pinHash,
      };

      localStorage.setItem(configStorageKey, JSON.stringify(config));
      setIsAppLockEnabled(true);
      setHasPinSet(true);
      setIsLocked(false);
      setFailedAttempts(0);
      setLockoutUntil(null);
      localStorage.removeItem(lockoutStorageKey);
      localStorage.removeItem(attemptsStorageKey);
      sessionStorage.setItem(sessionUnlockedKey, 'true');

      return true;
    } catch (err) {
      console.error('[AppLock] Failed to setup PIN:', err);
      return false;
    }
  };

  // Change PIN (requires validating current PIN first)
  const changePin = async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
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

      const updated: StoredAppLockData = {
        ...parsed,
        salt: newSalt,
        pinHash: newHash,
      };

      localStorage.setItem(configStorageKey, JSON.stringify(updated));
      setFailedAttempts(0);
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
      sessionStorage.removeItem(sessionUnlockedKey);

      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setFailedAttempts(0);
      setLockoutUntil(null);

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
        sessionStorage.setItem(sessionUnlockedKey, 'true');
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

  const lockApp = () => {
    if (isAppLockEnabled) {
      setIsLocked(true);
      sessionStorage.removeItem(sessionUnlockedKey);
    }
  };

  const unlockApp = () => {
    setIsLocked(false);
    sessionStorage.setItem(sessionUnlockedKey, 'true');
  };

  return (
    <AppLockContext.Provider
      value={{
        isAppLockEnabled,
        isLocked,
        hasPinSet,
        failedAttempts,
        lockoutRemainingSeconds,
        setupPin,
        changePin,
        disableAppLock,
        verifyAndUnlock,
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
