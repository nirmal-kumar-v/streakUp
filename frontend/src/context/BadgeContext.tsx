import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchFriendRequests } from '../api/friends';
import { fetchNotifications } from '../api/notifications';
import { useAuth } from './AuthContext';

export interface BadgeContextType {
  pendingRequestsCount: number;
  unreadNotificationsCount: number;
  hasNewNotification: boolean;
  refreshBadges: () => Promise<void>;
  decrementFriendRequests: () => void;
  incrementFriendRequests: () => void;
  setPendingRequestsCount: React.Dispatch<React.SetStateAction<number>>;
  decrementNotifications: (amount?: number) => void;
  setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  clearNotifications: () => void;
  markNotificationsAsSeen: () => void;
}

const defaultBadgeContext: BadgeContextType = {
  pendingRequestsCount: 0,
  unreadNotificationsCount: 0,
  hasNewNotification: false,
  refreshBadges: async () => {},
  decrementFriendRequests: () => {},
  incrementFriendRequests: () => {},
  setPendingRequestsCount: () => {},
  decrementNotifications: () => {},
  setUnreadNotificationsCount: () => {},
  clearNotifications: () => {},
  markNotificationsAsSeen: () => {},
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

const getNotifsOpenedKey = (userId?: string) => `streakup_notifs_last_opened_${userId || 'guest'}`;

const getLastOpenedTimestamp = (userId?: string): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(getNotifsOpenedKey(userId));
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const setLastOpenedTimestamp = (userId?: string, ts: number = Date.now()): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getNotifsOpenedKey(userId), ts.toString());
  } catch {}
};

export const BadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCountState] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCountState] = useState<number>(0);
  const [hasNewNotification, setHasNewNotificationState] = useState<boolean>(false);
  const isFetchingRef = useRef(false);

  // Sync state to localStorage for cross-tab synchronization
  const broadcastBadgeChange = useCallback((pending: number, unread: number, hasNew?: boolean) => {
    try {
      localStorage.setItem(
        BADGE_STORAGE_KEY,
        JSON.stringify({ pending, unread, hasNew, timestamp: Date.now() })
      );
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const markNotificationsAsSeen = useCallback(() => {
    setLastOpenedTimestamp(user?.id, Date.now());
    setHasNewNotificationState(false);
    broadcastBadgeChange(pendingRequestsCount, unreadNotificationsCount, false);
  }, [user?.id, pendingRequestsCount, unreadNotificationsCount, broadcastBadgeChange]);

  const setPendingRequestsCount: React.Dispatch<React.SetStateAction<number>> = useCallback(
    (action) => {
      setPendingRequestsCountState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        const normalized = Math.max(0, next);
        setUnreadNotificationsCountState((currentUnread) => {
          setHasNewNotificationState((currentHasNew) => {
            broadcastBadgeChange(normalized, currentUnread, currentHasNew);
            return currentHasNew;
          });
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
        if (normalized === 0) {
          setHasNewNotificationState(false);
        }
        setPendingRequestsCountState((currentPending) => {
          setHasNewNotificationState((currentHasNew) => {
            broadcastBadgeChange(currentPending, normalized, normalized === 0 ? false : currentHasNew);
            return normalized === 0 ? false : currentHasNew;
          });
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
    setHasNewNotificationState(false);
    setLastOpenedTimestamp(user?.id, Date.now());
  }, [setUnreadNotificationsCount, user?.id]);

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
      let nextHasNew: boolean | null = null;

      if (friendsRes && friendsRes.success) {
        nextPending = typeof friendsRes.pendingCount === 'number' ? friendsRes.pendingCount : 0;
        setPendingRequestsCountState(nextPending);
      }
      if (notifsRes && notifsRes.success) {
        nextUnread = typeof notifsRes.unreadCount === 'number' ? notifsRes.unreadCount : 0;
        setUnreadNotificationsCountState(nextUnread);

        if (nextUnread === 0) {
          nextHasNew = false;
        } else {
          const lastOpened = getLastOpenedTimestamp(user?.id);
          const latestItem = notifsRes.notifications && notifsRes.notifications[0];
          if (latestItem && latestItem.createdAt) {
            const latestTime = new Date(latestItem.createdAt).getTime();
            // If user never opened notifications before, show the dot
            // Otherwise, show the dot ONLY if a new notification arrived after user last opened
            nextHasNew = lastOpened === 0 ? true : latestTime > lastOpened;
          } else {
            nextHasNew = lastOpened === 0;
          }
        }
        setHasNewNotificationState(nextHasNew);
      }

      setPendingRequestsCountState((currPending) => {
        setUnreadNotificationsCountState((currUnread) => {
          setHasNewNotificationState((currHasNew) => {
            broadcastBadgeChange(
              nextPending !== null ? nextPending : currPending,
              nextUnread !== null ? nextUnread : currUnread,
              nextHasNew !== null ? nextHasNew : currHasNew
            );
            return currHasNew;
          });
          return currUnread;
        });
        return currPending;
      });
    } catch {
      // Silent fail for background badge poll
    } finally {
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, user?.id, broadcastBadgeChange]);

  // Initial load and periodic refresh
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingRequestsCountState(0);
      setUnreadNotificationsCountState(0);
      setHasNewNotificationState(false);
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
          if (typeof parsed.hasNew === 'boolean') setHasNewNotificationState(parsed.hasNew);
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
        hasNewNotification,
        refreshBadges,
        decrementFriendRequests,
        incrementFriendRequests,
        setPendingRequestsCount,
        decrementNotifications,
        setUnreadNotificationsCount,
        clearNotifications,
        markNotificationsAsSeen,
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
