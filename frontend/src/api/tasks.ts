import apiClient from './client';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Recurrence = 'DAILY' | 'ONE_TIME';
export type TaskStatus = 'ACTIVE' | 'ARCHIVED';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  priority: Priority;
  recurrence: Recurrence;
  dueTime: string | null;
  status: TaskStatus;
  completedToday: boolean;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  hasCompletedToday: boolean;
  lastCompletedDate: string | null;
}

export interface ClockInfo {
  timezone: string;
  currentIso: string;
  timeFormatted: string;
  dateFormatted: string;
  todayDateString: string;
  nextMidnightIso: string;
  countdown: {
    totalSecondsRemaining: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  };
}

export interface DashboardSummaryResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    username: string;
    currentStreak: number;
    longestStreak: number;
    timezone: string;
  };
  stats: {
    totalActiveTasks: number;
    completedTodayCount: number;
    pendingTodayCount: number;
    completionPercentage: number;
  };
  todayTasks: Task[];
  clockInfo: ClockInfo;
}

export async function fetchTasks(params?: {
  status?: string;
  priority?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const res = await apiClient.get<{
    success: boolean;
    tasks: Task[];
    todayDateStr: string;
    timezone: string;
  }>('/tasks', { params });
  return res.data;
}

export async function createTask(data: {
  title: string;
  description?: string;
  category?: string;
  priority?: Priority;
  recurrence?: Recurrence;
  dueTime?: string;
}) {
  const res = await apiClient.post<{ success: boolean; task: Task }>('/tasks', data);
  return res.data;
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    category: string;
    priority: Priority;
    recurrence: Recurrence;
    dueTime: string | null;
    status: TaskStatus;
  }>
) {
  const res = await apiClient.put<{ success: boolean; task: Task }>(`/tasks/${id}`, data);
  return res.data;
}

export async function deleteTask(id: string) {
  const res = await apiClient.delete<{ success: boolean; streak: StreakInfo }>(`/tasks/${id}`);
  return res.data;
}

export async function toggleArchiveTask(id: string) {
  const res = await apiClient.patch<{ success: boolean; task: Task }>(`/tasks/${id}/archive`);
  return res.data;
}

export async function completeTask(id: string) {
  const res = await apiClient.post<{
    success: boolean;
    completedToday: boolean;
    streak: StreakInfo;
  }>(`/tasks/${id}/complete`);
  return res.data;
}

export async function uncompleteTask(id: string) {
  const res = await apiClient.post<{
    success: boolean;
    completedToday: boolean;
    streak: StreakInfo;
  }>(`/tasks/${id}/uncomplete`);
  return res.data;
}

export async function fetchDashboardSummary() {
  const res = await apiClient.get<DashboardSummaryResponse>('/tasks/dashboard-summary');
  return res.data;
}

export async function fetchActivityHistory() {
  const res = await apiClient.get<{
    success: boolean;
    activity: Array<{ date: string; count: number }>;
    totalCompletions: number;
  }>('/tasks/activity-history');
  return res.data;
}
