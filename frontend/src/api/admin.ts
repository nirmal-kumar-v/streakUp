import axios from 'axios';

// Normalize base URL (strip trailing slash)
const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin Request Interceptor: strictly attaches streakup_admin_token
adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('streakup_admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Admin Response Interceptor: clear stale admin token on 401/403
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (!error.config?.url?.includes('/admin/login')) {
        localStorage.removeItem('streakup_admin_token');
      }
    }
    return Promise.reject(error);
  }
);

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
  const res = await adminApiClient.post<{
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
  const res = await adminApiClient.get<{
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
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
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
  const res = await adminApiClient.get<{
    success: boolean;
    logs: AdminAuditLogItem[];
    total: number;
    page: number;
    totalPages: number;
  }>('/admin/audit-logs', { params });
  return res.data;
}

export async function deleteAdminAuditLog(logId: string, sensitivePin?: string) {
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
    `/admin/audit-logs/${logId}`,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function clearAdminAuditLogs(params?: { targetUserId?: string; sensitivePin?: string }) {
  const { sensitivePin, ...queryParams } = params || {};
  const res = await adminApiClient.delete<{ success: boolean; message: string; count: number }>(
    '/admin/audit-logs',
    {
      params: queryParams,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function searchAdminUsers(q: string = '') {
  const res = await adminApiClient.get<{
    success: boolean;
    users: AdminUser[];
  }>('/admin/users', { params: { q } });
  return res.data;
}

export async function fetchAdminUserDetails(userId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    user: any;
  }>(`/admin/users/${userId}`);
  return res.data;
}

export interface AdminNotificationPayload {
  sendInApp?: boolean;
  sendEmail?: boolean;
  includeReason?: boolean;
  includeChanges?: boolean;
  sensitivePin?: string;
}

export async function overrideUsernameCooldown(
  userId: string,
  data: {
    newUsername?: string;
    resetCooldownOnly?: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-username-cooldown`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
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
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user?: any; task?: any }>(
    `/admin/users/${userId}/correct-streak`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function grantDayStreak(
  userId: string,
  data: {
    date: string;
    taskId?: string;
    taskIds?: string[];
    studyNote?: string;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{
    success: boolean;
    message: string;
    user: any;
    completions?: any[];
    completion?: any;
    pointsDelta?: number;
  }>(`/admin/users/${userId}/grant-day-streak`, body, {
    headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
  });
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
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any; historicalFreezeApplied: boolean }>(
    `/admin/users/${userId}/adjust-freezes`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adjustUserPoints(
  userId: string,
  data: { pointsDelta: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; points: number }>(
    `/admin/users/${userId}/adjust-points`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function overrideUserLimit15(
  userId: string,
  data: { maxStarredNotifications: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-starred-limit`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function deleteUserAccountByAdmin(
  userId: string,
  data: { reason: string; sensitivePin: string }
) {
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
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
  data: { newEmail?: string; resetCooldownOnly?: boolean; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/override-email-cooldown`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function toggleUserEmailVerification(
  userId: string,
  data: { isEmailVerified?: boolean; reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/toggle-email-verification`,
    data
  );
  return res.data;
}

export async function updateUserTimezone(
  userId: string,
  data: { timezone: string; reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/update-timezone`,
    data
  );
  return res.data;
}

export async function resetNudgeCooldown(
  userId: string,
  data: { reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/users/${userId}/reset-nudge-cooldown`,
    data
  );
  return res.data;
}

export async function updateTaskVisibility(
  taskId: string,
  data: { hiddenFrom: string[]; visibleOnlyTo: string[]; reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/tasks/${taskId}/visibility`,
    data
  );
  return res.data;
}

export async function adminManageGroupMember(
  groupId: string,
  data: { targetUserId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'REMOVE'; reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/groups/${groupId}/manage-member`,
    data
  );
  return res.data;
}

export async function adminRecoverGroupTask(
  taskId: string,
  data: { reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/tasks/${taskId}/recover`,
    data
  );
  return res.data;
}

export async function adminModerateStudyNote(
  completionId: string,
  data: { studyNote?: string | null; clearReactions?: boolean; reason: string }
) {
  const res = await adminApiClient.post<{ success: boolean; message: string; completion: any }>(
    `/admin/completions/${completionId}/moderate`,
    data
  );
  return res.data;
}

export async function adminUpdateTaskFull(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    recurrence?: 'DAILY' | 'ONE_TIME';
    status?: 'ACTIVE' | 'ARCHIVED';
    hiddenFrom?: string[];
    visibleOnlyTo?: string[];
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/tasks/${taskId}/update-full`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminUpdateGroupFull(
  groupId: string,
  data: {
    name?: string;
    description?: string;
    joinCode?: string;
    ownerId?: string;
    hiddenFrom?: string[];
    visibleOnlyTo?: string[];
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; group: any }>(
    `/admin/groups/${groupId}/update-full`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function unfreezeUserDate(
  userId: string,
  date: string,
  data: { reason: string; sensitivePin?: string }
) {
  const res = await adminApiClient.delete<{ success: boolean; message: string; streaks: any }>(
    `/admin/users/${userId}/freeze/${date}`,
    {
      data: { reason: data.reason },
      headers: data.sensitivePin ? { 'x-admin-pin': data.sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminDeleteReminderSchedule(
  reminderId: string,
  reason?: string
) {
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
    `/admin/reminders/${reminderId}`,
    {
      data: { reason: reason || 'Deleted by admin' },
    }
  );
  return res.data;
}

export async function overrideLeaderboardLimit(
  userId: string,
  data: { leaderboardLimit: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; leaderboardLimit: number }>(
    `/admin/users/${userId}/override-leaderboard-limit`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function overrideReminderLimit(
  userId: string,
  data: { reminderLimit: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; reminderLimit: number }>(
    `/admin/users/${userId}/override-reminder-limit`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function overrideDiscoverGroupsLimit(
  userId: string,
  data: { discoverGroupsLimit: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; discoverGroupsLimit: number }>(
    `/admin/users/${userId}/override-discover-groups-limit`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminUpdateUserProfileImage(
  userId: string,
  data: {
    profileImage?: string | null;
    remove?: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/profile-image`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}


