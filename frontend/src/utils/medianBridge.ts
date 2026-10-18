/**
 * Median.co (formerly GoNative) JavaScript Bridge Integration for Native Biometrics.
 * Officially supported Face ID / Touch ID (iOS) and Android Biometrics plugin API.
 * 
 * Documentation: https://median.co/docs/biometric-authentication
 */

declare global {
  interface Window {
    median?: {
      auth?: {
        status: (params?: any) => Promise<any> | void;
        get: (params?: any) => Promise<any> | void;
        save: (params?: any) => Promise<any> | void;
        delete: (params?: any) => Promise<any> | void;
      };
      isBridgeReady?: boolean;
    };
    gonative?: {
      auth?: {
        status: (params?: any) => Promise<any> | void;
        get: (params?: any) => Promise<any> | void;
        save: (params?: any) => Promise<any> | void;
        delete: (params?: any) => Promise<any> | void;
      };
    };
    _median_auth_callback?: (data: any) => void;
  }
}

export interface BiometricStatus {
  available: boolean;
  hasTouchId: boolean;
  hasSecret: boolean;
  biometryType?: string; // 'face' | 'touch' | 'none'
  isMedianApp: boolean;
}

/**
 * Returns true if running inside a Median.co native webview container
 */
export function isMedianAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    window.median?.auth ||
    window.gonative?.auth ||
    navigator.userAgent.includes('gonative') ||
    navigator.userAgent.includes('median')
  );
}

/**
 * Checks biometric availability using the official median.auth.status() bridge API.
 * Returns availability status with a safe timeout fallback.
 */
export async function checkBiometricAvailability(): Promise<BiometricStatus> {
  const isMedian = isMedianAppEnvironment();
  const authModule = window.median?.auth || window.gonative?.auth;

  if (!authModule || typeof authModule.status !== 'function') {
    return {
      available: false,
      hasTouchId: false,
      hasSecret: false,
      isMedianApp: isMedian,
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          available: false,
          hasTouchId: false,
          hasSecret: false,
          isMedianApp: isMedian,
        });
      }
    }, 1500);

    try {
      const callback = (data: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        const hasTouchId = !!(data && (data.hasTouchId || data.available));
        const hasSecret = !!(data && data.hasSecret);
        const biometryType = data?.biometryType || (hasTouchId ? 'biometrics' : undefined);
        resolve({
          available: hasTouchId,
          hasTouchId,
          hasSecret,
          biometryType,
          isMedianApp: isMedian,
        });
      };

      // Support both callback and Promise-returning variants
      const res = authModule.status({
        minimumAndroidBiometric: 'strong',
        callbackFunction: callback,
      });

      if (res && typeof res.then === 'function') {
        res.then((data: any) => callback(data)).catch(() => callback(null));
      }
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          available: false,
          hasTouchId: false,
          hasSecret: false,
          isMedianApp: isMedian,
        });
      }
    }
  });
}

/**
 * Prompts user for Face ID, Touch ID, or Android Biometric using median.auth.get().
 * Unlocks hardware-backed Keychain / Keystore credential.
 */
export async function requestBiometricUnlock(promptText: string = 'Unlock StreakUp'): Promise<{
  success: boolean;
  secret?: string;
  error?: string;
}> {
  const authModule = window.median?.auth || window.gonative?.auth;

  if (!authModule || typeof authModule.get !== 'function') {
    return {
      success: false,
      error: 'Native biometric module is not available on this browser/device.',
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          error: 'Biometric verification timed out.',
        });
      }
    }, 30000); // 30s timeout for user prompt

    try {
      const callback = (data: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        if (data && data.success) {
          resolve({
            success: true,
            secret: data.secret,
          });
        } else {
          resolve({
            success: false,
            error: data?.error || 'Biometric authentication was cancelled or failed.',
          });
        }
      };

      const res = authModule.get({
        prompt: promptText,
        minimumAndroidBiometric: 'strong',
        callbackFunction: callback,
      });

      if (res && typeof res.then === 'function') {
        res.then((data: any) => callback(data)).catch((err: any) => callback({ success: false, error: err?.message }));
      }
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          error: err?.message || 'Biometric invocation failed.',
        });
      }
    }
  });
}

/**
 * Stores a secure validation token in native Keychain / Keystore via median.auth.save()
 */
export async function saveBiometricSecret(secret: string): Promise<boolean> {
  const authModule = window.median?.auth || window.gonative?.auth;
  if (!authModule || typeof authModule.save !== 'function') {
    return false;
  }

  try {
    const res = authModule.save({
      secret,
      minimumAndroidBiometric: 'strong',
    });
    if (res && typeof res.then === 'function') {
      await res;
    }
    return true;
  } catch (err) {
    console.warn('[MedianBridge] Failed to save biometric secret:', err);
    return false;
  }
}

/**
 * Removes the stored biometric secret from device storage via median.auth.delete()
 */
export async function deleteBiometricSecret(): Promise<boolean> {
  const authModule = window.median?.auth || window.gonative?.auth;
  if (!authModule || typeof authModule.delete !== 'function') {
    return false;
  }

  try {
    const res = authModule.delete({});
    if (res && typeof res.then === 'function') {
      await res;
    }
    return true;
  } catch (err) {
    console.warn('[MedianBridge] Failed to delete biometric secret:', err);
    return false;
  }
}
