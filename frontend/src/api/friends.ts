import apiClient from './client';

export interface FriendUser {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  tasksCompletedToday?: number;
  status?: 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'SELF';
  requestId?: string;
}

export interface FriendRequestItem {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  sender?: FriendUser;
  receiver?: FriendUser;
}

export async function searchUsers(query: string) {
  const res = await apiClient.get<{ success: boolean; users: FriendUser[] }>('/friends/search', {
    params: { q: query },
  });
  return res.data;
}

export async function sendFriendRequest(targetUserId: string) {
  const res = await apiClient.post<{ success: boolean; message: string; request?: FriendRequestItem; status?: string }>(
    '/friends/request',
    { targetUserId }
  );
  return res.data;
}

export async function fetchFriendRequests() {
  const res = await apiClient.get<{
    success: boolean;
    received: FriendRequestItem[];
    sent: FriendRequestItem[];
    pendingCount: number;
  }>('/friends/requests');
  return res.data;
}

export async function acceptFriendRequest(requestId: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/friends/requests/${requestId}/accept`
  );
  return res.data;
}

export async function rejectFriendRequest(requestId: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/friends/requests/${requestId}/reject`
  );
  return res.data;
}

export async function cancelFriendRequest(requestId: string) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(
    `/friends/requests/${requestId}/cancel`
  );
  return res.data;
}

export async function fetchFriendsList() {
  const res = await apiClient.get<{ success: boolean; friends: FriendUser[]; count: number }>(
    '/friends/list'
  );
  return res.data;
}

export async function removeFriend(friendUserId: string) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(
    `/friends/${friendUserId}`
  );
  return res.data;
}

export interface FriendTaskGroup {
  friend: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
    currentStreak: number;
    longestStreak: number;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    recurrence: string;
    dueTime: string | null;
    currentStreak: number;
    longestStreak: number;
    freezeBalance: number;
    freezeRechargeDays: number;
    completedToday: boolean;
    todayStudyNote: string | null;
    recentCompletions: Array<{
      id: string;
      completionDate: string;
      completedAt: string;
      studyNote: string | null;
    }>;
  }>;
}

export async function fetchFriendsTasks() {
  const res = await apiClient.get<{
    success: boolean;
    friendsTasks: FriendTaskGroup[];
  }>('/friends/tasks');
  return res.data;
}

export interface StudyActivityItem {
  id: string;
  studyNote: string;
  completionDate: string;
  completedAt: string;
  isCurrentUser: boolean;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
  };
  task: {
    id: string;
    title: string;
    category: string;
    currentStreak: number;
    recurrence: string;
  };
}

export async function fetchFriendsStudyActivity(page: number = 1, limit: number = 20) {
  const res = await apiClient.get<{
    success: boolean;
    activity: StudyActivityItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>('/friends/study-activity', { params: { page, limit } });
  return res.data;
}

