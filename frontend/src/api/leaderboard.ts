import apiClient from './client';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  points?: number;
  totalCompletedTasks: number;
  tasksCompletedToday: number;
  isCurrentUser: boolean;
  memberSince?: string;
}

export interface GlobalLeaderboardResponse {
  success: boolean;
  type?: 'streak' | 'points';
  leaderboard: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalUsers: number;
    totalPages: number;
  };
  currentUserRankInfo: LeaderboardEntry | null;
  userLeaderboardLimit?: number;
}

export interface FriendsLeaderboardResponse {
  success: boolean;
  type?: 'streak' | 'points';
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
  currentUserEntry: LeaderboardEntry | null;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem<any>>();

export function getCachedGlobalLeaderboard(type: 'streak' | 'points' = 'streak'): GlobalLeaderboardResponse | null {
  const key = `global_${type}`;
  const item = memoryCache.get(key);
  if (item && Date.now() - item.timestamp < 180000) {
    return item.data;
  }
  try {
    const raw = sessionStorage.getItem(`streakup_global_lb_${type}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < 180000) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch (e) {}
  return null;
}

export function getCachedFriendsLeaderboard(type: 'streak' | 'points' = 'streak'): FriendsLeaderboardResponse | null {
  const key = `friends_${type}`;
  const item = memoryCache.get(key);
  if (item && Date.now() - item.timestamp < 180000) {
    return item.data;
  }
  try {
    const raw = sessionStorage.getItem(`streakup_friends_lb_${type}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < 180000) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch (e) {}
  return null;
}

export async function fetchGlobalLeaderboard(params?: {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'streak' | 'points';
}) {
  const key = `global_${params?.type || 'streak'}_${params?.page || 1}_${params?.search || ''}`;
  const res = await apiClient.get<GlobalLeaderboardResponse>('/leaderboard/global', { params });
  if (res.data?.success) {
    memoryCache.set(key, { data: res.data, timestamp: Date.now() });
    if (!params?.page || params.page === 1) {
      const baseKey = `global_${params?.type || 'streak'}`;
      memoryCache.set(baseKey, { data: res.data, timestamp: Date.now() });
      try {
        sessionStorage.setItem(`streakup_global_lb_${params?.type || 'streak'}`, JSON.stringify({ data: res.data, timestamp: Date.now() }));
      } catch (e) {}
    }
  }
  return res.data;
}

export async function fetchFriendsLeaderboard(params?: { type?: 'streak' | 'points' }) {
  const typeKey = params?.type || 'streak';
  const key = `friends_${typeKey}`;
  const res = await apiClient.get<FriendsLeaderboardResponse>('/leaderboard/friends', { params });
  if (res.data?.success) {
    memoryCache.set(key, { data: res.data, timestamp: Date.now() });
    try {
      sessionStorage.setItem(`streakup_friends_lb_${typeKey}`, JSON.stringify({ data: res.data, timestamp: Date.now() }));
    } catch (e) {}
  }
  return res.data;
}
