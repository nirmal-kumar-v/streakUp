import apiClient from './client';

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  points: number;
  overallFreezeBalance: number;
  overallFreezeRechargeDays: number;
  lastUsernameChangeAt: string | null;
  emailLastChangedAt?: string | null;
  isEmailVerified?: boolean;
  maxStarredNotifications: number | null;
  createdAt: string;
  _count?: {
    tasks: number;
    taskCompletions: number;
    groupMemberships: number;
  };
}

export interface AdminAuditLogItem {
  id: string;
  adminUsername: string;
  action: string;
  targetUserId: string | null;
  targetUser: string | null;
  reason: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
}

export async function adminLogin(username: string, password: string) {
  const res = await apiClient.post<{
    success: boolean;
    token: string;
    admin: {
      id: string;
      username: string;
      role: string;
      hasSensitivePin: boolean;
      lastLoginAt: string | null;
    };
  }>('/admin/login', { username, password });
  return res.data;
}

export async function fetchAdminProfile() {
  const res = await apiClient.get<{
    success: boolean;
    admin: {
      id: string;
      username: string;
      role: string;
      hasSensitivePin: boolean;
      lastLoginAt: string | null;
      createdAt: string;
    };
  }>('/admin/me');
  return res.data;
}

export async function changeAdminCredentials(data: {
  currentPassword: string;
  newPassword?: string;
  newSensitivePin?: string;
  reason?: string;
}) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    '/admin/change-credentials',
    data
  );
  return res.data;
}

export async function fetchAdminAuditLogs(params?: {
  targetUserId?: string;
  action?: string;
  page?: number;
  limit?: number;
}) {
  const res = await apiClient.get<{
    success: boolean;
    logs: AdminAuditLogItem[];
    total: number;
    page: number;
    totalPages: number;
  }>('/admin/audit-logs', { params });
  return res.data;
}

export async function searchAdminUsers(q: string = '') {
  const res = await apiClient.get<{
    success: boolean;
    users: AdminUser[];
  }>('/admin/users', { params: { q } });
  return res.data;
}

export async function fetchAdminUserDetails(userId: string) {
  const res = await apiClient.get<{
    success: boolean;
    user: any;
  }>(`/admin/users/${userId}`);
  return res.data;
}

export async function overrideUsernameCooldown(
  userId: string,
  data: { newUsername?: string; resetCooldownOnly?: boolean; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-username-cooldown`,
    data
  );
  return res.data;
}

export async function correctUserStreak(
  userId: string,
  data: {
    type: 'OVERALL' | 'TASK';
    taskId?: string;
    currentStreak: number;
    longestStreak?: number;
    reason: string;
  }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user?: any; task?: any }>(
    `/admin/users/${userId}/correct-streak`,
    data
  );
  return res.data;
}

export async function adjustUserFreezes(
  userId: string,
  data: {
    overallFreezeBalance?: number;
    overallFreezeRechargeDays?: number;
    historicalFreezeDate?: string;
    taskId?: string;
    reason: string;
  }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any; historicalFreezeApplied: boolean }>(
    `/admin/users/${userId}/adjust-freezes`,
    data
  );
  return res.data;
}

export async function adjustUserPoints(
  userId: string,
  data: { pointsDelta: number; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; points: number }>(
    `/admin/users/${userId}/adjust-points`,
    data
  );
  return res.data;
}

export async function overrideUserLimit15(
  userId: string,
  data: { maxStarredNotifications: number; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-starred-limit`,
    data
  );
  return res.data;
}

export async function deleteUserAccountByAdmin(
  userId: string,
  data: { reason: string; sensitivePin: string }
) {
  const res = await apiClient.delete<{ success: boolean; message: string }>(
    `/admin/users/${userId}`,
    {
      data: { reason: data.reason },
      headers: { 'x-admin-pin': data.sensitivePin },
    }
  );
  return res.data;
}

export async function overrideEmailCooldown(
  userId: string,
  data: { newEmail?: string; resetCooldownOnly?: boolean; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-email-cooldown`,
    data
  );
  return res.data;
}

export async function toggleUserEmailVerification(
  userId: string,
  data: { isEmailVerified?: boolean; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/toggle-email-verification`,
    data
  );
  return res.data;
}

export async function updateUserTimezone(
  userId: string,
  data: { timezone: string; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/update-timezone`,
    data
  );
  return res.data;
}

export async function resetNudgeCooldown(
  userId: string,
  data: { reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/admin/users/${userId}/reset-nudge-cooldown`,
    data
  );
  return res.data;
}

export async function updateTaskVisibility(
  taskId: string,
  data: { hiddenFrom: string[]; visibleOnlyTo: string[]; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/tasks/${taskId}/visibility`,
    data
  );
  return res.data;
}

export async function adminManageGroupMember(
  groupId: string,
  data: { targetUserId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/admin/groups/${groupId}/manage-member`,
    data
  );
  return res.data;
}

export async function adminRecoverGroupTask(
  taskId: string,
  data: { reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/tasks/${taskId}/recover`,
    data
  );
  return res.data;
}

export async function adminModerateStudyNote(
  completionId: string,
  data: { studyNote?: string | null; clearReactions?: boolean; reason: string }
) {
  const res = await apiClient.post<{ success: boolean; message: string; completion: any }>(
    `/admin/completions/${completionId}/moderate`,
    data
  );
  return res.data;
}

