import apiClient from './client';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Recurrence = 'DAILY' | 'ONE_TIME';
export type TaskStatus = 'ACTIVE' | 'ARCHIVED';

export interface Task {
  id: string;
  userId: string;
  title: string;
  normalizedTitle?: string | null;
  description: string | null;
  category: string;
  priority: Priority;
  recurrence: Recurrence;
  scheduledDays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dueTime: string | null;
  status: TaskStatus;
  completedToday: boolean;
  todayStudyNote?: string | null;
  currentStreak?: number;
  longestStreak?: number;
  freezeBalance?: number;
  freezeRechargeDays?: number;
  groupId?: string | null;
  isGroupTask?: boolean;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  hasCompletedToday: boolean;
  lastCompletedDate: string | null;
  freezeBalance?: number;
  freezeRechargeDays?: number;
  protectedDates?: string[];
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
    profileImage?: string | null;
    currentStreak: number;
    longestStreak: number;
    overallFreezeBalance?: number;
    overallFreezeRechargeDays?: number;
    protectedDates?: string[];
    timezone: string;
    points?: number;
  };
  stats: {
    totalActiveTasks: number;
    completedTodayCount: number;
    pendingTodayCount: number;
    completionPercentage: number;
  };
  pointsStats?: {
    totalPoints: number;
    completedCount: number;
    missedCount: number;
    netCompletedPoints: number;
    netMissedPoints: number;
  };
  todayTasks: Task[];
  clockInfo: ClockInfo;
}

export interface TaskDetailData {
  success: boolean;
  task: Task & {
    totalCompletedDays: number;
    isOwner: boolean;
    owner: {
      id: string;
      name: string;
      username: string;
      profileImage: string | null;
      timezone: string;
    };
  };
  completions: Array<{
    id: string;
    completionDate: string;
    completedAt: string;
    studyNote: string | null;
  }>;
  freezeLogs: Array<{
    id: string;
    protectedDate: string;
    usedAt: string;
  }>;
  calendar: {
    completedDates: string[];
    protectedDates: string[];
    todayDateStr: string;
  };
}

export interface TaskFriendsLeaderboardData {
  success: boolean;
  taskTitle: string;
  leaderboard: Array<{
    rank: number;
    taskId: string;
    taskTitle: string;
    userId: string;
    name: string;
    username: string;
    profileImage: string | null;
    currentStreak: number;
    longestStreak: number;
    completedToday: boolean;
    todayStudyNote: string | null;
    isCurrentUser: boolean;
  }>;
  suggestedMatches: Array<{
    taskId: string;
    title: string;
    user: {
      id: string;
      name: string;
      username: string;
      profileImage: string | null;
    };
    confidence: number;
    reason: string;
  }>;
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
  scheduledDays?: number[];
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
    scheduledDays: number[];
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

export async function completeTask(id: string, studyNote: string) {
  const res = await apiClient.post<{
    success: boolean;
    completedToday: boolean;
    studyNote: string;
    taskStreak?: any;
    overallStreak?: StreakInfo;
    streak: StreakInfo;
    pointsAwarded?: number;
    totalPoints?: number;
  }>(`/tasks/${id}/complete`, { studyNote });
  return res.data;
}

export async function uncompleteTask(id: string) {
  const res = await apiClient.post<{
    success: boolean;
    completedToday: boolean;
    taskStreak?: any;
    overallStreak?: StreakInfo;
    streak: StreakInfo;
    totalPoints?: number;
  }>(`/tasks/${id}/uncomplete`);
  return res.data;
}

export async function updateCompletionNote(id: string, date: string, note: string) {
  const res = await apiClient.put<{
    success: boolean;
    message: string;
    completion: { id: string; studyNote: string | null };
  }>(`/tasks/${id}/completions/${date}/note`, { note });
  return res.data;
}

export async function fetchTaskDetails(id: string) {
  const res = await apiClient.get<TaskDetailData>(`/tasks/${id}/details`);
  return res.data;
}

export async function fetchTaskFriendsLeaderboard(id: string) {
  const res = await apiClient.get<TaskFriendsLeaderboardData>(`/tasks/${id}/friends-leaderboard`);
  return res.data;
}

export async function confirmTaskEquivalence(userTaskId: string, friendTaskId: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>('/tasks/equivalences/confirm', {
    userTaskId,
    friendTaskId,
  });
  return res.data;
}

export async function rejectTaskEquivalence(userTaskId: string, friendTaskId: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>('/tasks/equivalences/reject', {
    userTaskId,
    friendTaskId,
  });
  return res.data;
}

export async function fetchDashboardSummary() {
  const res = await apiClient.get<DashboardSummaryResponse>('/tasks/dashboard-summary');
  return res.data;
}

export interface ActivityTaskInfo {
  title: string;
  note: string | null;
}

export interface ActivityDateItem {
  date: string;
  count: number;
  tasks?: ActivityTaskInfo[];
}

export interface ActivityHistoryResponse {
  success: boolean;
  year?: number | null;
  startDate?: string;
  endDate?: string;
  today?: string;
  timezone?: string;
  availableYears?: number[];
  activity: ActivityDateItem[];
  totalCompletions: number;
  activeDaysCount?: number;
}

export interface ActivityHistoryParams {
  year?: number;
  startDate?: string;
  endDate?: string;
}

export async function fetchActivityHistory(paramsOrYear?: number | ActivityHistoryParams) {
  const params: Record<string, any> = {};
  if (typeof paramsOrYear === 'number') {
    params.year = paramsOrYear;
  } else if (paramsOrYear && typeof paramsOrYear === 'object') {
    if (paramsOrYear.year !== undefined) params.year = paramsOrYear.year;
    if (paramsOrYear.startDate) params.startDate = paramsOrYear.startDate;
    if (paramsOrYear.endDate) params.endDate = paramsOrYear.endDate;
  }

  const res = await apiClient.get<ActivityHistoryResponse>('/tasks/activity-history', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return res.data;
}



