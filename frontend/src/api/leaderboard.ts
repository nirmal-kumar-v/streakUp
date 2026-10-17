import apiClient from './client';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  totalCompletedTasks: number;
  tasksCompletedToday: number;
  isCurrentUser: boolean;
  memberSince?: string;
}

export interface GlobalLeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalUsers: number;
    totalPages: number;
  };
  currentUserRankInfo: LeaderboardEntry | null;
}

export interface FriendsLeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
  currentUserEntry: LeaderboardEntry | null;
}

export async function fetchGlobalLeaderboard(params?: { page?: number; limit?: number; search?: string }) {
  const res = await apiClient.get<GlobalLeaderboardResponse>('/leaderboard/global', { params });
  return res.data;
}

export async function fetchFriendsLeaderboard() {
  const res = await apiClient.get<FriendsLeaderboardResponse>('/leaderboard/friends');
  return res.data;
}
