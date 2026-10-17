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
