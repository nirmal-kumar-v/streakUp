/**
 * StreakUp Persistent Client Cache
 * 
 * Provides zero-buffering instant data loading across app restarts, reboots, and navigation.
 * Uses localStorage with memory cache fallback.
 * Always serves the last recorded state immediately so users never see a loading screen or spinner.
 */

const memoryCache = new Map<string, any>();

export function getPersistentData<T>(key: string): T | null {
  // Check fast in-memory map first
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`streakup_data_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed?.data !== undefined ? parsed.data : parsed;
    memoryCache.set(key, data);
    return data as T;
  } catch (e) {
    return null;
  }
}

export function setPersistentData<T>(key: string, data: T): void {
  memoryCache.set(key, data);
  try {
    localStorage.setItem(
      `streakup_data_${key}`,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (e) {
    // Quota exceeded: clean oldest streakup_data keys if needed
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('streakup_data_') && k !== `streakup_data_${key}`) {
          localStorage.removeItem(k);
          break;
        }
      }
    } catch {}
  }
}

export function removePersistentData(key: string): void {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(`streakup_data_${key}`);
  } catch (e) {}
}

export function clearAllPersistentData(): void {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('streakup_data_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
