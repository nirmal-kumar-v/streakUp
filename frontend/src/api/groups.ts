import apiClient from './client';

export interface GroupMemberItem {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentStreak: number;
  longestStreak: number;
  friendshipStatus?: 'SELF' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';
  joinedAt: string;
}

export interface GroupUserTask {
  id: string;
  title: string;
  description: string | null;
  scheduledDays: number[];
  currentStreak: number;
  longestStreak: number;
  freezeBalance: number;
  freezeRechargeDays: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  hiddenFrom?: string[];
  visibleOnlyTo?: string[];
  completedToday: boolean;
  todayStudyNote: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  scheduledDays: number[];
  owner: {
    id: string;
    name: string;
    username: string;
  };
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number;
  pendingRequestsCount?: number;
  hasActiveDashboardTask?: boolean;
  createdAt: string;
  userTask?: GroupUserTask | null;
  members: GroupMemberItem[];
}

export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  scheduledDays: number[];
  owner: {
    id: string;
    name: string;
    username: string;
  };
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  isOwner: boolean;
  isAdmin?: boolean;
  memberCount: number;
  pendingRequestsCount?: number;
  currentStreak?: number;
  createdAt?: string;
  joinedAt: string;
}

export interface GroupSearchResult {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  scheduledDays: number[];
  memberCount: number;
  isMember: boolean;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  myRequestStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | null;
}

export interface GroupJoinRequestItem {
  id: string;
  groupId: string;
  userId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
    currentStreak: number;
  };
}

export interface OwnerJoinRequestItem {
  id: string;
  groupId: string;
  groupName: string;
  joinCode: string;
  scheduledDays: number[];
  userId: string;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
    createdAt: string;
  };
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
}

export interface GroupInvitationItem {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string | null;
  joinCode: string;
  scheduledDays: number[];
  memberCount: number;
  inviter: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
  };
  createdAt: string;
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
  weeklyCompletions: number;
  friendshipStatus: 'SELF' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';
  isCurrentUser: boolean;
}

export interface GroupLeaderboardResponse {
  success: boolean;
  groupId: string;
  groupName: string;
  type: 'streak' | 'weekly';
  weekRange?: {
    startDate: string;
    endDate: string;
  };
  leaderboard: GroupLeaderboardEntry[];
}

export interface GroupNoteItem {
  id: string;
  completionDate: string;
  completedAt: string;
  studyNote: string;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string | null;
  };
  isOwnNote: boolean;
  reactionCounts: Record<string, number>;
  userReactions: string[];
}

export async function fetchUserGroups() {
  const res = await apiClient.get<{ success: boolean; groups: GroupItem[] }>('/groups');
  return res.data;
}

export async function createGroup(data: { name: string; description?: string; scheduledDays?: number[] }) {
  const res = await apiClient.post<{ success: boolean; message: string; group: GroupItem }>('/groups', data);
  return res.data;
}

export async function searchGroups(q: string = '') {
  const res = await apiClient.get<{ success: boolean; groups: GroupSearchResult[] }>('/groups/search', {
    params: { q },
  });
  return res.data;
}

export async function requestToJoinGroup(groupIdOrCode: string) {
  const res = await apiClient.post<{ success: boolean; message: string; request: any }>(
    `/groups/${groupIdOrCode}/join-request`
  );
  return res.data;
}

export async function cancelJoinRequest(groupId: string) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(`/groups/${groupId}/join-request`);
  return res.data;
}

export async function fetchGroupJoinRequests(groupId: string) {
  const res = await apiClient.get<{ success: boolean; requests: GroupJoinRequestItem[] }>(`/groups/${groupId}/requests`);
  return res.data;
}

export async function respondToJoinRequest(groupId: string, requestId: string, action: 'ACCEPT' | 'REJECT') {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/groups/${groupId}/requests/${requestId}/respond`,
    { action }
  );
  return res.data;
}

export async function fetchGroupDetails(id: string) {
  const res = await apiClient.get<{ success: boolean; group: GroupDetail }>(`/groups/${id}`);
  return res.data;
}

export async function leaveGroup(id: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>(`/groups/${id}/leave`);
  return res.data;
}

export async function fetchGroupLeaderboard(id: string, type: 'streak' | 'weekly' = 'streak') {
  const res = await apiClient.get<GroupLeaderboardResponse>(`/groups/${id}/leaderboard`, {
    params: { type },
  });
  return res.data;
}

export async function fetchGroupNotes(id: string) {
  const res = await apiClient.get<{ success: boolean; notes: GroupNoteItem[] }>(`/groups/${id}/notes`);
  return res.data;
}

export async function promoteMemberToAdmin(id: string, targetUserId: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/groups/${id}/members/${targetUserId}/promote`
  );
  return res.data;
}

export async function removeMemberFromGroup(id: string, targetUserId: string) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(`/groups/${id}/members/${targetUserId}`);
  return res.data;
}

export async function updateGroup(id: string, data: { name?: string; description?: string | null; scheduledDays?: number[] }) {
  const res = await apiClient.put<{ success: boolean; message: string; group: GroupDetail }>(`/groups/${id}`, data);
  return res.data;
}

export async function fetchAllOwnerJoinRequests() {
  const res = await apiClient.get<{ success: boolean; requests: OwnerJoinRequestItem[] }>('/groups/all-requests');
  return res.data;
}

export async function inviteToGroup(id: string, data: { inviteeUserId?: string; inviteeUsername?: string }) {
  const res = await apiClient.post<{ success: boolean; message: string; invitation: any }>(`/groups/${id}/invite`, data);
  return res.data;
}

export async function fetchUserGroupInvitations() {
  const res = await apiClient.get<{ success: boolean; invitations: GroupInvitationItem[] }>('/groups/invitations');
  return res.data;
}

export async function respondToGroupInvitation(invitationId: string, action: 'ACCEPT' | 'REJECT') {
  const res = await apiClient.post<{ success: boolean; message: string; groupId?: string }>(
    `/groups/invitations/${invitationId}/respond`,
    { action }
  );
  return res.data;
}

export async function makeGroupTask(id: string) {
  const res = await apiClient.post<{ success: boolean; message: string; task: any }>(`/groups/${id}/make-task`);
  return res.data;
}

export async function removeGroupTask(id: string) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(`/groups/${id}/task`);
  return res.data;
}

export const fetchGroupLeaderboards = fetchGroupLeaderboard;
export type Group = GroupItem;
export type GroupMember = GroupMemberItem;
