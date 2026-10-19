import api from './client';

export type NotificationCategory =
  | 'OVERALL_REMINDER'
  | 'TASK_REMINDER'
  | 'FRIEND_OVERALL_ACTIVITY'
  | 'FRIEND_TASK_ACTIVITY'
  | 'FRIEND_OVERALL_MILESTONE'
  | 'FRIEND_TASK_MILESTONE'
  | 'MY_MILESTONE'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  friendId?: string | null;
  taskId?: string | null;
  actionUrl?: string | null;
  eventKey?: string | null;
  isRead: boolean;
  readAt?: string | null;
  isStarred?: boolean;
  starredAt?: string | null;
  createdAt: string;
  friend?: {
    id: string;
    name: string;
    username: string;
    profileImage?: string | null;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  overallStreakRemindersEmail: boolean;
  overallStreakRemindersInApp?: boolean;
  taskRemindersEmail: boolean;
  taskRemindersInApp?: boolean;
  friendOverallActivityAlerts: boolean;
  friendOverallActivityInApp?: boolean;
  friendTaskActivityAlerts: boolean;
  friendTaskActivityInApp?: boolean;
  friendOverallMilestones: boolean;
  friendOverallMilestonesInApp?: boolean;
  friendTaskMilestones: boolean;
  friendTaskMilestonesInApp?: boolean;
  myMilestonesEmail: boolean;
  myMilestonesInApp?: boolean;
  freezeStatusNotifications: boolean;
  freezeStatusInApp?: boolean;
  customNotificationEmail?: string | null;
  isCustomEmailVerified: boolean;
}

export interface ReminderScheduleItem {
  id: string;
  userId: string;
  scope: 'OVERALL' | 'TASK';
  taskId?: string | null;
  time: string; // "HH:mm"
  isEnabled: boolean;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export async function fetchNotifications(params?: {
  category?: NotificationCategory;
  status?: 'all' | 'unread' | 'read' | 'starred';
  page?: number;
  limit?: number;
}) {
  const res = await api.get('/notifications', { params });
  return res.data as {
    success: boolean;
    notifications: NotificationItem[];
    unreadCount: number;
    totalCount: number;
    allCount?: number;
    starredCount?: number;
    page: number;
    totalPages: number;
  };
}

export async function markNotificationRead(id: string) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data as { success: boolean; notification: NotificationItem };
}

export async function toggleStarNotification(id: string) {
  const res = await api.patch(`/notifications/${id}/star`);
  return res.data as { success: boolean; notification: NotificationItem };
}

export async function markAllNotificationsRead() {
  const res = await api.post('/notifications/mark-all-read');
  return res.data as { success: boolean; message: string };
}

export async function dismissNotification(id: string) {
  const res = await api.delete(`/notifications/${id}`);
  return res.data as { success: boolean; message: string };
}

export async function fetchNotificationPreferences() {
  const res = await api.get('/notifications/preferences');
  return res.data as {
    success: boolean;
    preferences: NotificationPreference;
    defaultEmail: string;
    timezone: string;
    isEmailVerified?: boolean;
    isSmtpConfigured?: boolean;
    reminderLimit?: number;
    taskReminderLimit?: number;
  };
}

export async function updateNotificationPreferences(data: Partial<NotificationPreference>) {
  const res = await api.put('/notifications/preferences', data);
  return res.data as {
    success: boolean;
    message: string;
    preferences: NotificationPreference;
  };
}

export async function fetchReminderSchedules() {
  const res = await api.get('/notifications/reminders');
  return res.data as {
    success: boolean;
    schedules: ReminderScheduleItem[];
    maxAllowed?: number;
    taskMaxAllowed?: number;
  };
}

export async function createReminderSchedule(data: {
  scope: 'OVERALL' | 'TASK';
  taskId?: string | null;
  time: string; // "HH:mm"
}) {
  const res = await api.post('/notifications/reminders', data);
  return res.data as {
    success: boolean;
    message: string;
    schedule: ReminderScheduleItem;
  };
}

export async function deleteReminderSchedule(id: string) {
  const res = await api.delete(`/notifications/reminders/${id}`);
  return res.data as { success: boolean; message: string };
}

export async function sendTestEmail() {
  const res = await api.post('/notifications/test-email');
  return res.data as { success: boolean; message: string };
}

export async function fetchSmtpStatus() {
  const res = await api.get('/notifications/smtp-status');
  return res.data as {
    success: boolean;
    isConfigured: boolean;
    message: string;
    host?: string;
    port?: number;
  };
}

export async function requestNotificationEmailOtp(email: string) {
  const res = await api.post<{
    success: boolean;
    message: string;
    email: string;
    error?: string;
    retryAfterSeconds?: number;
  }>('/notifications/custom-email/request-otp', { email });
  return res.data;
}

export async function verifyNotificationEmailOtp(email: string, otp: string) {
  const res = await api.post<{
    success: boolean;
    message: string;
    preferences: NotificationPreference;
    error?: string;
  }>('/notifications/custom-email/verify-otp', { email, otp });
  return res.data;
}

export async function removeNotificationEmail() {
  const res = await api.delete<{
    success: boolean;
    message: string;
    preferences: NotificationPreference;
    error?: string;
  }>('/notifications/custom-email');
  return res.data;
}

