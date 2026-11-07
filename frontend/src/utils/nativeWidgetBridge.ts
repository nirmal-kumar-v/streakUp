import { registerPlugin, Capacitor } from '@capacitor/core';

interface StreakUpBridgePlugin {
  syncAuthToken(options: { token: string }): Promise<void>;
  clearAuthToken(): Promise<void>;
  syncWidgetData(options: {
    streak: number;
    completedToday: number;
    totalTasks: number;
    percentage: number;
    userName?: string;
    statusMessage?: string;
  }): Promise<void>;
  triggerWidgetUpdate(): Promise<void>;
  downloadImage(options: { base64Data: string; fileName: string }): Promise<{ success: boolean; uri?: string; path?: string }>;
  shareImage(options: { base64Data: string; title: string; text: string }): Promise<{ success: boolean }>;
}

const StreakUpBridge = registerPlugin<StreakUpBridgePlugin>('StreakUpBridge');

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Syncs the authenticated JWT token to native Android encrypted storage
 * so the home screen widget can fetch real user data in the background.
 */
export async function syncTokenToWidget(token: string | null) {
  if (!isNativeApp()) return;
  try {
    if (token && token.trim().length > 0) {
      await StreakUpBridge.syncAuthToken({ token: token.trim() });
    } else {
      await StreakUpBridge.clearAuthToken();
    }
  } catch (err) {
    console.warn('[NativeBridge] Failed to sync token to widget:', err);
  }
}

/**
 * Clears the stored token from native Android storage on user logout.
 */
export async function clearTokenFromWidget() {
  if (!isNativeApp()) return;
  try {
    await StreakUpBridge.clearAuthToken();
  } catch (err) {
    console.warn('[NativeBridge] Failed to clear token from widget:', err);
  }
}

/**
 * Instantly updates the home screen widget with the latest dashboard summary
 * without requiring any network calls.
 */
export async function syncStatsToWidget(stats: {
  streak: number;
  completedToday: number;
  totalTasks: number;
  percentage: number;
  userName?: string;
  statusMessage?: string;
}) {
  if (!isNativeApp()) return;
  try {
    await StreakUpBridge.syncWidgetData(stats);
  } catch (err) {
    console.warn('[NativeBridge] Failed to sync stats to widget:', err);
  }
}

/**
 * Downloads a canvas image directly into the Android device's Gallery / Pictures.
 */
export async function nativeDownloadImage(base64Data: string, fileName: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const res = await StreakUpBridge.downloadImage({ base64Data, fileName });
    return Boolean(res?.success);
  } catch (err) {
    console.error('[NativeBridge] nativeDownloadImage error:', err);
    throw err;
  }
}

/**
 * Opens native Android Share sheet with the generated card image file.
 */
export async function nativeShareImage(base64Data: string, title: string, text: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const res = await StreakUpBridge.shareImage({ base64Data, title, text });
    return Boolean(res?.success);
  } catch (err) {
    console.error('[NativeBridge] nativeShareImage error:', err);
    throw err;
  }
}
