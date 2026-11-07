import apiClient from './client';
import { getPersistentData, setPersistentData } from '../utils/persistentCache';

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

export function getCachedGlobalLeaderboard(type: 'streak' | 'points' = 'streak'): GlobalLeaderboardResponse | null {
  return getPersistentData<GlobalLeaderboardResponse>(`global_lb_${type}`);
}

export function getCachedFriendsLeaderboard(type: 'streak' | 'points' = 'streak'): FriendsLeaderboardResponse | null {
  return getPersistentData<FriendsLeaderboardResponse>(`friends_lb_${type}`);
}

export async function fetchGlobalLeaderboard(params?: {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'streak' | 'points';
}) {
  const res = await apiClient.get<GlobalLeaderboardResponse>('/leaderboard/global', { params });
  if (res.data?.success) {
    if (!params?.page || params.page === 1) {
      setPersistentData(`global_lb_${params?.type || 'streak'}`, res.data);
    }
  }
  return res.data;
}

export async function fetchFriendsLeaderboard(params?: { type?: 'streak' | 'points' }) {
  const typeKey = params?.type || 'streak';
  const res = await apiClient.get<FriendsLeaderboardResponse>('/leaderboard/friends', { params });
  if (res.data?.success) {
    setPersistentData(`friends_lb_${typeKey}`, res.data);
  }
  return res.data;
}
