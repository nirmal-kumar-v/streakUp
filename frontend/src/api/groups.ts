import apiClient from './client';

export interface GroupMemberItem {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentStreak: number;
  longestStreak: number;
  points: number;
  joinedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  owner: {
    id: string;
    name: string;
    username: string;
  };
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner?: boolean;
  memberCount: number;
  createdAt: string;
  members: GroupMemberItem[];
}

export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  owner: {
    id: string;
    name: string;
    username: string;
  };
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner: boolean;
  memberCount: number;
  createdAt?: string;
  joinedAt: string;
}

export interface GroupDetailResponse {
  success: boolean;
  group: GroupDetail;
}

export interface GroupLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  profileImage: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentStreak: number;
  longestStreak: number;
  points: number;
  isCurrentUser: boolean;
}

export interface GroupLeaderboardResponse {
  success: boolean;
  groupId: string;
  groupName: string;
  type: 'streak' | 'points';
  leaderboard: GroupLeaderboardEntry[];
}

export async function fetchUserGroups() {
  const res = await apiClient.get<{ success: boolean; groups: GroupItem[] }>('/groups');
  return res.data;
}

export async function createGroup(data: { name: string; description?: string }) {
  const res = await apiClient.post<{ success: boolean; message: string; group: GroupItem }>('/groups', data);
  return res.data;
}

export async function joinGroup(joinCode: string) {
  const res = await apiClient.post<{ success: boolean; message: string; group: GroupItem }>('/groups/join', {
    joinCode,
  });
  return res.data;
}

export async function fetchGroupDetails(id: string) {
  const res = await apiClient.get<GroupDetailResponse>(`/groups/${id}`);
  return res.data;
}

export async function leaveGroup(id: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>(`/groups/${id}/leave`);
  return res.data;
}

export async function fetchGroupLeaderboard(id: string, type: 'streak' | 'points' = 'streak') {
  const res = await apiClient.get<GroupLeaderboardResponse>(`/groups/${id}/leaderboard`, {
    params: { type },
  });
  return res.data;
}

export const fetchGroupLeaderboards = fetchGroupLeaderboard;
export type Group = GroupItem;
export type GroupMember = GroupMemberItem;
