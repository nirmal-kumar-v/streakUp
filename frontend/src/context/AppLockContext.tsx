import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { generateSalt, hashPin, verifyPinHash } from '../utils/pinSecurity';
import {
  checkBiometricAvailability,
  requestBiometricUnlock,
  saveBiometricSecret,
  deleteBiometricSecret,
  isMedianAppEnvironment,
} from '../utils/medianBridge';

export type LockTimeout = 'immediate' | '1m' | '5m' | '15m';

interface StoredAppLockData {
  enabled: boolean;
  salt: string;
  pinHash: string;
  biometricsEnabled: boolean;
  lockTimeout: LockTimeout;
}

interface AppLockContextType {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  hasPinSet: boolean;
  biometricsEnabled: boolean;
  lockTimeout: LockTimeout;
  isBiometricsAvailable: boolean;
  isMedianApp: boolean;
  biometryType?: string;
  failedAttempts: number;
  lockoutRemainingSeconds: number;
  setupPin: (pin: string, enableBiometrics?: boolean) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  disableAppLock: (currentPin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; error?: string }>;
  triggerBiometricUnlock: () => Promise<{ success: boolean; error?: string }>;
  setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
  setLockTimeout: (timeout: LockTimeout) => void;
  lockApp: () => void;
  unlockApp: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

const TIMEOUT_DURATIONS: Record<LockTimeout, number> = {
  immediate: 0,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || 'guest';

  const storageKey = `streakup_applock_${userId}`;

  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [lockTimeout, setLockTimeoutState] = useState<LockTimeout>('immediate');

  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [isMedianApp, setIsMedianApp] = useState(false);
  const [biometryType, setBiometryType] = useState<string | undefined>(undefined);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState(0);

  const lastBackgroundedRef = useRef<number | null>(null);
  const isInitialMountRef = useRef(true);

  // Load stored App Lock configuration for the current authenticated user
  const loadStoredConfig = useCallback(() => {
    if (!isAuthenticated || !user) {
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: StoredAppLockData = JSON.parse(raw);
        if (parsed.enabled && parsed.pinHash && parsed.salt) {
          setIsAppLockEnabled(true);
          setHasPinSet(true);
          setBiometricsEnabledState(!!parsed.biometricsEnabled);
          setLockTimeoutState(parsed.lockTimeout || 'immediate');

          // Lock on initial session load if enabled
          if (isInitialMountRef.current) {
            setIsLocked(true);
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
  }, [isAuthenticated, user, storageKey]);

  // Initial load and biometric check
  useEffect(() => {
    loadStoredConfig();
    isInitialMountRef.current = false;

    // Check Median biometric capability
    checkBiometricAvailability().then((status) => {
      setIsBiometricsAvailable(status.available);
      setIsMedianApp(status.isMedianApp);
      setBiometryType(status.biometryType);
    });
  }, [loadStoredConfig]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemainingSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemainingSeconds(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Listen to background / foreground transitions via document.visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isAppLockEnabled || !isAuthenticated) return;

      if (document.visibilityState === 'hidden') {
        // App went to background
        lastBackgroundedRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        // App returned to foreground
        if (lastBackgroundedRef.current) {
          const elapsed = Date.now() - lastBackgroundedRef.current;
          const threshold = TIMEOUT_DURATIONS[lockTimeout] ?? 0;

          if (elapsed >= threshold) {
            setIsLocked(true);
          }
        }
        lastBackgroundedRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAppLockEnabled, isAuthenticated, lockTimeout]);

  // Setup / Enable PIN
  const setupPin = async (pin: string, enableBiometrics: boolean = false): Promise<boolean> => {
    if (!user || pin.length < 4) return false;

    try {
      const salt = generateSalt();
      const pinHash = await hashPin(pin, salt, userId);

      const config: StoredAppLockData = {
        enabled: true,
        salt,
        pinHash,
        biometricsEnabled: enableBiometrics,
        lockTimeout,
      };

      localStorage.setItem(storageKey, JSON.stringify(config));
      setIsAppLockEnabled(true);
      setHasPinSet(true);
      setBiometricsEnabledState(enableBiometrics);
      setIsLocked(false);
      setFailedAttempts(0);

      if (enableBiometrics && isMedianAppEnvironment()) {
        await saveBiometricSecret(`streakup_secret_${userId}`);
      }

      return true;
    } catch (err) {
      console.error('[AppLock] Failed to setup PIN:', err);
      return false;
    }
  };

  // Change PIN (requires validating current PIN first)
  const changePin = async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    const raw = localStorage.getItem(storageKey);
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

      localStorage.setItem(storageKey, JSON.stringify(updated));
      setFailedAttempts(0);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to update PIN.' };
    }
  };

  // Disable App Lock (requires validating current PIN first)
  const disableAppLock = async (currentPin: string): Promise<{ success: boolean; error?: string }> => {
    const raw = localStorage.getItem(storageKey);
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

      localStorage.removeItem(storageKey);
      setIsAppLockEnabled(false);
      setHasPinSet(false);
      setIsLocked(false);
      setBiometricsEnabledState(false);
      setFailedAttempts(0);

      // Clean up native secret if present
      await deleteBiometricSecret();

      return { success: true };
    } catch {
      return { success: false, error: 'Failed to disable App Lock.' };
    }
  };

  // Verify PIN entered by user on the lock screen
  const verifyAndUnlock = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Too many failed attempts. Try again in ${secs}s.` };
    }

    const raw = localStorage.getItem(storageKey);
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
        return { success: true };
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);

        if (nextFailed >= 5) {
          const lockTime = Date.now() + 30 * 1000; // 30s lockout
          setLockoutUntil(lockTime);
          return { success: false, error: 'Too many incorrect attempts. Locked for 30 seconds.' };
        }

        return { success: false, error: `Incorrect PIN. (${5 - nextFailed} attempts remaining)` };
      }
    } catch {
      return { success: false, error: 'PIN verification failed.' };
    }
  };

  // Trigger Biometric Unlock via Median Bridge
  const triggerBiometricUnlock = async (): Promise<{ success: boolean; error?: string }> => {
    if (!biometricsEnabled) {
      return { success: false, error: 'Biometrics is not enabled for App Lock.' };
    }

    const res = await requestBiometricUnlock('Unlock StreakUp');
    if (res.success) {
      setIsLocked(false);
      setFailedAttempts(0);
      setLockoutUntil(null);
      return { success: true };
    }

    return { success: false, error: res.error || 'Biometric authentication cancelled or unavailable.' };
  };

  // Toggle Biometrics setting
  const setBiometricsEnabled = async (enabled: boolean): Promise<boolean> => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;

    try {
      const parsed: StoredAppLockData = JSON.parse(raw);
      parsed.biometricsEnabled = enabled;
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      setBiometricsEnabledState(enabled);

      if (enabled && isMedianAppEnvironment()) {
        await saveBiometricSecret(`streakup_secret_${userId}`);
      } else {
        await deleteBiometricSecret();
      }

      return true;
    } catch {
      return false;
    }
  };

  // Update Lock Timeout
  const setLockTimeout = (timeout: LockTimeout) => {
    setLockTimeoutState(timeout);
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed: StoredAppLockData = JSON.parse(raw);
        parsed.lockTimeout = timeout;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      } catch {}
    }
  };

  const lockApp = () => {
    if (isAppLockEnabled) {
      setIsLocked(true);
    }
  };

  const unlockApp = () => {
    setIsLocked(false);
  };

  return (
    <AppLockContext.Provider
      value={{
        isAppLockEnabled,
        isLocked,
        hasPinSet,
        biometricsEnabled,
        lockTimeout,
        isBiometricsAvailable,
        isMedianApp,
        biometryType,
        failedAttempts,
        lockoutRemainingSeconds,
        setupPin,
        changePin,
        disableAppLock,
        verifyAndUnlock,
        triggerBiometricUnlock,
        setBiometricsEnabled,
        setLockTimeout,
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
