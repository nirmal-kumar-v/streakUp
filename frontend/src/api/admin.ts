import axios from 'axios';
import { NotificationPreference } from './notifications';
import { compressProfileImage } from '../utils/imageCompressor';

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

// Admin Response Interceptor: clear stale admin token only on 401 unauthorized session
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
  overallFreezeCapacity?: number;
  lastUsernameChangeAt: string | null;
  emailLastChangedAt?: string | null;
  isEmailVerified?: boolean;
  maxStarredNotifications: number | null;
  profileImageLimitMb?: number;
  reminderLimit?: number;
  taskReminderLimit?: number;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedExpiresAt?: string | null;
  deletionDaysRemaining?: number | null;
  canRecover?: boolean;
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

export async function searchAdminUsers(q: string = '', filter?: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    users: AdminUser[];
  }>('/admin/users', { params: { q, filter } });
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
    applyToOverall?: boolean;
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
    overallFreezeCapacity?: number;
    freezeBalance?: number;
    freezeRechargeDays?: number;
    freezeCapacity?: number;
    historicalFreezeDate?: string;
    taskId?: string;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any; task?: any; historicalFreezeApplied: boolean }>(
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

export async function recoverUserAccountByAdmin(
  userId: string,
  data: { reason?: string; sensitivePin?: string }
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/recover`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
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
  data: { targetUserId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'REMOVE'; reason: string; sensitivePin?: string }
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

export async function overrideTaskReminderLimit(
  userId: string,
  data: { taskReminderLimit: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; taskReminderLimit: number }>(
    `/admin/users/${userId}/override-task-reminder-limit`,
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

export async function overrideProfileImageLimit(
  userId: string,
  data: { profileImageLimitMb: number; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; profileImageLimitMb: number }>(
    `/admin/users/${userId}/override-profile-image-limit`,
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
  if (body.profileImage && body.profileImage.startsWith('data:image/')) {
    body.profileImage = await compressProfileImage(body.profileImage);
  }
  const res = await adminApiClient.post<{ success: boolean; message: string; user: any }>(
    `/admin/users/${userId}/profile-image`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export interface AdminGroupItem {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  isDiscoverable: boolean;
  scheduledDays: number[];
  memberCount: number;
  taskCount?: number;
  ownerId: string;
  owner?: { id: string; name: string; username: string; email: string };
  hiddenFrom?: string[];
  visibleOnlyTo?: string[];
  isSpecialGroup?: boolean;
  specialPlatform?: string | null;
  detectedPlatform?: string | null;
  createdAt: string;
}

export interface AdminReminderNextOccurrence {
  nextIso: string | null;
  nextDisplay: string;
  relativeDisplay: string;
  isToday: boolean;
}

export interface AdminUserReminderSettings {
  success: boolean;
  timezone: string;
  quotaLimit: number;
  taskQuotaLimit?: number;
  preferences?: NotificationPreference;
  overall: {
    isEnabled: boolean;
    schedules: Array<{
      id: string;
      time: string;
      isEnabled: boolean;
      nextOccurrence: AdminReminderNextOccurrence;
    }>;
    emailNotificationsEnabled: boolean;
    customNotificationEmail: string | null;
  };
  tasks: Array<{
    taskId: string;
    title: string;
    recurrence: string;
    scheduledDays: number[];
    isGroupTask: boolean;
    groupName: string | null;
    taskRemindersEnabled: boolean;
    schedules: Array<{
      id: string;
      time: string;
      isEnabled: boolean;
      nextOccurrence: AdminReminderNextOccurrence;
    }>;
    maxAllowed: number;
  }>;
}

export async function searchGroupsForAdmin(query?: string) {
  const res = await adminApiClient.get<{ success: boolean; groups: AdminGroupItem[] }>('/admin/groups', {
    params: { q: query || '' },
  });
  return res.data;
}

export async function adminToggleGroupDiscoverability(
  groupId: string,
  data: { isDiscoverable: boolean; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; group: AdminGroupItem }>(
    `/admin/groups/${groupId}/discoverability`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function getUserReminderSettings(userId: string) {
  const res = await adminApiClient.get<AdminUserReminderSettings>(`/admin/users/${userId}/reminders`);
  return res.data;
}

export async function adminUpdateOverallReminders(
  userId: string,
  data: { isEnabled: boolean; times: string[]; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; isEnabled: boolean; times: string[] }>(
    `/admin/users/${userId}/reminders/overall`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminUpdateTaskReminders(
  userId: string,
  taskId: string,
  data: { isEnabled: boolean; times: string[]; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; taskId: string; isEnabled: boolean; times: string[] }>(
    `/admin/users/${userId}/reminders/tasks/${taskId}`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminTriggerManualReminderCheck(sensitivePin?: string) {
  const res = await adminApiClient.post<{
    success: boolean;
    message: string;
    timestamp: string;
    processed: number;
    sent: number;
    skipped: number;
  }>(
    '/admin/reminders/run-check',
    {},
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminSendTestReminder(
  userId: string,
  data: { scope: 'OVERALL' | 'TASK'; taskId?: string; reason?: string; sensitivePin?: string }
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/users/${userId}/reminders/send-test`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminUpdateUserPreferences(
  userId: string,
  data: { preferences: Partial<NotificationPreference>; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.put<{ success: boolean; message: string; preferences: NotificationPreference }>(
    `/admin/users/${userId}/preferences`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

// LinkedIn Games Dedicated Super Admin API Methods
export async function getMemberLinkedInGamesAdmin(userId: string, groupId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    user: any;
    group: any;
    games: any[];
  }>(`/admin/users/${userId}/linkedin-games/${groupId}`);
  return res.data;
}

export async function adminCorrectLinkedInGameStreak(
  userId: string,
  groupId: string,
  data: {
    gameId: string;
    currentStreak: number;
    longestStreak?: number;
    reason: string;
    applyToOverall?: boolean;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; game: any }>(
    `/admin/users/${userId}/linkedin-games/${groupId}/correct`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminGrantLinkedInGameDate(
  userId: string,
  groupId: string,
  data: {
    gameId: string;
    date: string;
    studyNote?: string;
    reason: string;
    applyToOverall?: boolean;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; game: any }>(
    `/admin/users/${userId}/linkedin-games/${groupId}/grant-date`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminFreezeLinkedInGameDate(
  userId: string,
  groupId: string,
  data: {
    gameId: string;
    date: string;
    isFrozen?: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; game: any }>(
    `/admin/users/${userId}/linkedin-games/${groupId}/freeze-date`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminSetLinkedInGameCommitment(
  userId: string,
  groupId: string,
  data: {
    gameId: string;
    isCommitted: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; game: any }>(
    `/admin/users/${userId}/linkedin-games/${groupId}/commitment`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

// ==================== User Requests & Feedback ====================

export interface AdminUserRequest {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  category: 'FEATURE_REQUEST' | 'BUG_REPORT' | 'ACCOUNT_RECOVERY' | 'ACCOUNT_SUPPORT' | 'GENERAL_FEEDBACK' | 'OTHER';
  message: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED';
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminUserRequests(params?: {
  status?: string;
  category?: string;
  search?: string;
}) {
  const res = await adminApiClient.get<{
    success: boolean;
    requests: AdminUserRequest[];
    count: number;
  }>('/admin/requests', { params });
  return res.data;
}

export async function updateAdminUserRequestStatus(
  requestId: string,
  data: { status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED'; adminNotes?: string }
) {
  const res = await adminApiClient.patch<{
    success: boolean;
    message: string;
    request: AdminUserRequest;
  }>(`/admin/requests/${requestId}/status`, data);
  return res.data;
}

// ==================== Manager Access ====================

export interface AdminManager {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  emailNotificationsEnabled: boolean;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminManagers() {
  const res = await adminApiClient.get<{
    success: boolean;
    managers: AdminManager[];
  }>('/admin/managers');
  return res.data;
}

export async function grantAdminManager(data: {
  userId: string;
  emailNotificationsEnabled?: boolean;
}) {
  const res = await adminApiClient.post<{
    success: boolean;
    message: string;
    manager: AdminManager;
  }>('/admin/managers', data);
  return res.data;
}

export async function revokeAdminManager(userId: string) {
  const res = await adminApiClient.delete<{
    success: boolean;
    message: string;
  }>(`/admin/managers/${userId}`);
  return res.data;
}

export async function updateAdminManagerEmail(
  userId: string,
  emailNotificationsEnabled: boolean
) {
  const res = await adminApiClient.patch<{
    success: boolean;
    message: string;
    manager: AdminManager;
  }>(`/admin/managers/${userId}/email`, { emailNotificationsEnabled });
  return res.data;
}

// ==================== Admin Direct Messaging ====================

export interface AdminMessageLog {
  id: string;
  adminUsername: string;
  recipientUserId: string;
  recipientUsername: string;
  recipientEmail: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'EMAIL' | 'BOTH';
  inAppStatus: 'SENT' | 'SKIPPED' | 'FAILED';
  emailStatus: 'SENT' | 'SKIPPED' | 'FAILED';
  deliveryNote?: string;
  createdAt: string;
}

export async function sendAdminMessage(data: {
  recipientUserId: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'EMAIL' | 'BOTH';
}) {
  const res = await adminApiClient.post<{
    success: boolean;
    message: string;
    delivery: AdminMessageLog;
  }>('/admin/send-message', data);
  return res.data;
}

export async function fetchAdminMessageLogs() {
  const res = await adminApiClient.get<{
    success: boolean;
    logs: AdminMessageLog[];
  }>('/admin/messages');
  return res.data;
}

// ========================================================
// SPECIAL GROUPS SUPER ADMIN APIs (LeetCode, GFG, etc.)
// ========================================================

export async function adminToggleGroupSpecialMode(
  groupId: string,
  data: { isSpecialGroup: boolean; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; group: any }>(
    `/admin/groups/${groupId}/special-mode`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function getMemberSpecialActivitiesAdmin(userId: string, groupId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    user: any;
    group: any;
    specialGroup: any;
  }>(`/admin/users/${userId}/special-groups/${groupId}`);
  return res.data;
}

export async function adminCorrectSpecialActivityStreak(
  userId: string,
  groupId: string,
  data: {
    activityType: 'daily' | 'potd';
    currentStreak: number;
    longestStreak?: number;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/users/${userId}/special-groups/${groupId}/correct`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminGrantSpecialActivityDate(
  userId: string,
  groupId: string,
  data: {
    activityType: 'daily' | 'potd';
    date: string;
    studyNote?: string;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/users/${userId}/special-groups/${groupId}/grant-date`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminSetSpecialActivityCommitment(
  userId: string,
  groupId: string,
  data: {
    isPotdCommitted: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; isPotdCommitted: boolean }>(
    `/admin/users/${userId}/special-groups/${groupId}/commitment`,
    body,
    {
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

// -------------------------------------------------------
// PLATFORM TELEMETRY & STATS
// -------------------------------------------------------
export async function adminGetPlatformStats() {
  const res = await adminApiClient.get<{
    success: boolean;
    stats: {
      totalUsers: number;
      activeUsers: number;
      totalGroups: number;
      totalTasks: number;
      completionsToday: number;
      pendingFeedbackRequests: number;
    };
  }>('/admin/stats');
  return res.data;
}

// -------------------------------------------------------
// FRIENDSHIPS & FRIEND REQUESTS ADMINISTRATION
// -------------------------------------------------------
export async function adminGetUserFriendRequests(userId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    incoming: any[];
    outgoing: any[];
    friends: any[];
  }>(`/admin/users/${userId}/friend-requests`);
  return res.data;
}

export async function adminForceAcceptFriendRequest(
  requestId: string,
  data: { reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/friend-requests/${requestId}/accept`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminForceRejectFriendRequest(
  requestId: string,
  data: { reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/friend-requests/${requestId}/reject`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminForceCreateFriendship(
  data: { userIdA: string; userIdB: string; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    '/admin/friendships/create',
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminForceRemoveFriendship(
  data: { userIdA: string; userIdB: string; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
    '/admin/friendships',
    {
      data: body,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

// -------------------------------------------------------
// GROUP JOIN REQUESTS, INVITATIONS & FORCE MEMBERSHIP
// -------------------------------------------------------
export async function adminGetGroupJoinRequests(groupId: string, status?: string) {
  const res = await adminApiClient.get<{ success: boolean; joinRequests: any[] }>(
    `/admin/groups/${groupId}/join-requests${status ? `?status=${status}` : ''}`
  );
  return res.data;
}

export async function adminRespondToGroupJoinRequest(
  groupId: string,
  requestId: string,
  data: { action: 'APPROVE' | 'REJECT'; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/groups/${groupId}/join-requests/${requestId}/respond`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminGetGroupInvitations(groupId: string) {
  const res = await adminApiClient.get<{ success: boolean; invitations: any[] }>(
    `/admin/groups/${groupId}/invitations`
  );
  return res.data;
}

export async function adminCancelGroupInvitation(
  invitationId: string,
  data: { reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
    `/admin/invitations/${invitationId}`,
    {
      data: body,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminForceAddMemberToGroup(
  groupId: string,
  data: { userId: string; role?: 'MEMBER' | 'ADMIN'; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/groups/${groupId}/force-add-member`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminSetGroupMemberVisibility(
  groupId: string,
  userId: string,
  data: { hiddenFrom: string[]; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; hiddenFrom: string[] }>(
    `/admin/groups/${groupId}/members/${userId}/visibility`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

// -------------------------------------------------------
// USER NOTIFICATIONS ADMINISTRATION
// -------------------------------------------------------
export async function adminGetUserNotifications(userId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    notifications: any[];
    total: number;
    unreadCount: number;
  }>(`/admin/users/${userId}/notifications`);
  return res.data;
}

export async function adminDeleteNotification(notificationId: string) {
  const res = await adminApiClient.delete<{ success: boolean; message: string }>(
    `/admin/notifications/${notificationId}`
  );
  return res.data;
}

export async function adminClearUserNotifications(
  userId: string,
  data: { reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.delete<{ success: boolean; message: string; count: number }>(
    `/admin/users/${userId}/notifications`,
    {
      data: body,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminMarkAllNotificationsRead(userId: string) {
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    `/admin/users/${userId}/notifications/mark-all-read`
  );
  return res.data;
}

// -------------------------------------------------------
// TASK CREATION & COMPLETION ADMINISTRATION
// -------------------------------------------------------
export async function adminCreateTaskForUser(
  userId: string,
  data: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    recurrence?: string;
    scheduledDays?: number[];
    dueTime?: string;
    groupId?: string;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; task: any }>(
    `/admin/users/${userId}/tasks`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminDeleteTaskCompletion(
  completionId: string,
  data: { reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.delete<{ success: boolean; message: string; pointsDeducted: number }>(
    `/admin/completions/${completionId}`,
    {
      data: body,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

export async function adminUncompleteTask(
  userId: string,
  taskId: string,
  data: { date: string; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; updatedStreaks: any }>(
    `/admin/users/${userId}/tasks/${taskId}/uncomplete`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

// -------------------------------------------------------
// POINT LEDGER & MILESTONES RESET
// -------------------------------------------------------
export async function adminGetUserPointLedger(userId: string) {
  const res = await adminApiClient.get<{
    success: boolean;
    user: { id: string; username: string; points: number };
    pointLedger: any[];
    totalEarned: number;
    totalDeducted: number;
  }>(`/admin/users/${userId}/point-ledger`);
  return res.data;
}

export async function adminResetUserMilestones(
  userId: string,
  data: { scopeKey?: string; reason: string } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.delete<{ success: boolean; message: string; count: number }>(
    `/admin/users/${userId}/milestones`,
    {
      data: body,
      headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {},
    }
  );
  return res.data;
}

// -------------------------------------------------------
// REMINDER SCHEDULE CREATION
// -------------------------------------------------------
export async function adminCreateReminderSchedule(
  userId: string,
  data: {
    time: string;
    type: 'OVERALL' | 'TASK';
    taskId?: string;
    sendInApp?: boolean;
    sendEmail?: boolean;
    reason: string;
  } & AdminNotificationPayload
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; reminder: any }>(
    `/admin/users/${userId}/reminders/create`,
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

// -------------------------------------------------------
// SYSTEM HEALTH, DIAGNOSTICS & PLATFORM POWERS
// -------------------------------------------------------
export interface AdminSystemHealth {
  status: string;
  dbLatencyMs: number;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  nodeVersion: string;
  platform: string;
  environment: string;
  tableCounts: {
    users: number;
    tasks: number;
    taskCompletions: number;
    groups: number;
    friendships: number;
    notifications: number;
    auditLogs: number;
    freezeLogs: number;
  };
}

export interface PlatformAnnouncementData {
  id: string;
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  link?: string;
  linkText?: string;
  dismissible: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminSystemHealth() {
  const res = await adminApiClient.get<{ success: boolean; health: AdminSystemHealth }>('/admin/system/health');
  return res.data;
}

export async function adminFlushAllCaches(sensitivePin?: string) {
  const res = await adminApiClient.post<{ success: boolean; message: string }>(
    '/admin/system/cache/flush',
    {},
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminTriggerStreakReconciliation(sensitivePin?: string) {
  const res = await adminApiClient.post<{
    success: boolean;
    message: string;
    result: { updatedUsers: number; updatedTasks: number };
  }>(
    '/admin/system/reconcile-streaks',
    {},
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function fetchAdminAnnouncement() {
  const res = await adminApiClient.get<{ success: boolean; announcement: PlatformAnnouncementData }>('/admin/system/announcement');
  return res.data;
}

export async function updateAdminAnnouncement(
  data: Partial<PlatformAnnouncementData> & { sensitivePin?: string }
) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; announcement: PlatformAnnouncementData }>(
    '/admin/system/announcement',
    body,
    { headers: sensitivePin ? { 'x-admin-pin': sensitivePin } : {} }
  );
  return res.data;
}

export async function adminBatchGrantFreeze(data: { amount: number; reason: string; sensitivePin: string }) {
  const { sensitivePin, ...body } = data;
  const res = await adminApiClient.post<{ success: boolean; message: string; usersCount: number }>(
    '/admin/users/batch-grant-freeze',
    body,
    { headers: { 'x-admin-pin': sensitivePin } }
  );
  return res.data;
}

export async function exportAdminUsersCsv(): Promise<Blob> {
  const res = await adminApiClient.get('/admin/system/export/users?format=csv', {
    responseType: 'blob',
  });
  return res.data;
}

export async function exportAdminAuditLogsCsv(): Promise<Blob> {
  const res = await adminApiClient.get('/admin/system/export/audit-logs?format=csv', {
    responseType: 'blob',
  });
  return res.data;
}

export async function fetchPublicAnnouncement() {
  const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
  const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
  const res = await axios.get<{ success: boolean; announcement: PlatformAnnouncementData }>(`${API_BASE_URL}/announcement`);
  return res.data;
}









