import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchFriendRequests } from '../api/friends';
import { fetchNotifications } from '../api/notifications';
import { useAuth } from './AuthContext';

export interface BadgeContextType {
  pendingRequestsCount: number;
  unreadNotificationsCount: number;
  refreshBadges: () => Promise<void>;
  decrementFriendRequests: () => void;
  incrementFriendRequests: () => void;
  setPendingRequestsCount: React.Dispatch<React.SetStateAction<number>>;
  decrementNotifications: (amount?: number) => void;
  setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  clearNotifications: () => void;
}

const defaultBadgeContext: BadgeContextType = {
  pendingRequestsCount: 0,
  unreadNotificationsCount: 0,
  refreshBadges: async () => {},
  decrementFriendRequests: () => {},
  incrementFriendRequests: () => {},
  setPendingRequestsCount: () => {},
  decrementNotifications: () => {},
  setUnreadNotificationsCount: () => {},
  clearNotifications: () => {},
};

declare global {
  interface Window {
    __STREAKUP_BADGE_CONTEXT__?: React.Context<BadgeContextType>;
  }
}

// Preserve a single context instance across lazy-loaded chunks and Vite HMR
const BadgeContext: React.Context<BadgeContextType> =
  (typeof window !== 'undefined' && window.__STREAKUP_BADGE_CONTEXT__) ||
  createContext<BadgeContextType>(defaultBadgeContext);

if (typeof window !== 'undefined') {
  window.__STREAKUP_BADGE_CONTEXT__ = BadgeContext;
}

const BADGE_STORAGE_KEY = 'streakup_badges_state';

export const BadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCountState] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCountState] = useState<number>(0);
  const isFetchingRef = useRef(false);

  // Sync state to localStorage for cross-tab synchronization
  const broadcastBadgeChange = useCallback((pending: number, unread: number) => {
    try {
      localStorage.setItem(
        BADGE_STORAGE_KEY,
        JSON.stringify({ pending, unread, timestamp: Date.now() })
      );
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const setPendingRequestsCount: React.Dispatch<React.SetStateAction<number>> = useCallback(
    (action) => {
      setPendingRequestsCountState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        const normalized = Math.max(0, next);
        setUnreadNotificationsCountState((currentUnread) => {
          broadcastBadgeChange(normalized, currentUnread);
          return currentUnread;
        });
        return normalized;
      });
    },
    [broadcastBadgeChange]
  );

  const setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>> = useCallback(
    (action) => {
      setUnreadNotificationsCountState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        const normalized = Math.max(0, next);
        setPendingRequestsCountState((currentPending) => {
          broadcastBadgeChange(currentPending, normalized);
          return currentPending;
        });
        return normalized;
      });
    },
    [broadcastBadgeChange]
  );

  const decrementFriendRequests = useCallback(() => {
    setPendingRequestsCount((prev) => Math.max(0, prev - 1));
  }, [setPendingRequestsCount]);

  const incrementFriendRequests = useCallback(() => {
    setPendingRequestsCount((prev) => prev + 1);
  }, [setPendingRequestsCount]);

  const decrementNotifications = useCallback(
    (amount = 1) => {
      setUnreadNotificationsCount((prev) => Math.max(0, prev - amount));
    },
    [setUnreadNotificationsCount]
  );

  const clearNotifications = useCallback(() => {
    setUnreadNotificationsCount(0);
  }, [setUnreadNotificationsCount]);

  // Load live counts from backend
  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [friendsRes, notifsRes] = await Promise.all([
        fetchFriendRequests().catch(() => null),
        fetchNotifications({ status: 'unread', limit: 1 }).catch(() => null),
      ]);

      let nextPending: number | null = null;
      let nextUnread: number | null = null;

      if (friendsRes && friendsRes.success) {
        nextPending = typeof friendsRes.pendingCount === 'number' ? friendsRes.pendingCount : 0;
        setPendingRequestsCountState(nextPending);
      }
      if (notifsRes && notifsRes.success) {
        nextUnread = typeof notifsRes.unreadCount === 'number' ? notifsRes.unreadCount : 0;
        setUnreadNotificationsCountState(nextUnread);
      }

      setPendingRequestsCountState((currPending) => {
        setUnreadNotificationsCountState((currUnread) => {
          broadcastBadgeChange(
            nextPending !== null ? nextPending : currPending,
            nextUnread !== null ? nextUnread : currUnread
          );
          return currUnread;
        });
        return currPending;
      });
    } catch {
      // Silent fail for background badge poll
    } finally {
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, broadcastBadgeChange]);

  // Initial load and periodic refresh
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingRequestsCountState(0);
      setUnreadNotificationsCountState(0);
      return;
    }

    refreshBadges();

    // 45s periodic background refresh
    const interval = setInterval(refreshBadges, 45000);

    // Cross-tab synchronization via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BADGE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (typeof parsed.pending === 'number') setPendingRequestsCountState(parsed.pending);
          if (typeof parsed.unread === 'number') setUnreadNotificationsCountState(parsed.unread);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Refresh when tab gains focus or becomes visible
    const handleVisibility = () => {
      if (!document.hidden && isAuthenticated) {
        refreshBadges();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isAuthenticated, refreshBadges]);

  return (
    <BadgeContext.Provider
      value={{
        pendingRequestsCount,
        unreadNotificationsCount,
        refreshBadges,
        decrementFriendRequests,
        incrementFriendRequests,
        setPendingRequestsCount,
        decrementNotifications,
        setUnreadNotificationsCount,
        clearNotifications,
      }}
    >
      {children}
    </BadgeContext.Provider>
  );
};

export function useBadges(): BadgeContextType {
  const context = useContext(BadgeContext);
  return context || defaultBadgeContext;
}
