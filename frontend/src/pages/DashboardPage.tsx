import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchDashboardSummary,
  completeTask,
  uncompleteTask,
  createTask,
  updateTask,
  deleteTask,
  toggleArchiveTask,
  Task,
  Priority,
  Recurrence,
} from '../api/tasks';
import { DualClock } from '../components/DualClock';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { TaskCompletionModal } from '../components/TaskCompletionModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { triggerStreakCelebration } from '../components/StreakCelebration';
import { triggerPostCompletionNudge } from '../components/PostCompletionNudge';
import {
  Flame,
  Trophy,
  CheckCircle2,
  ListTodo,
  Plus,
  TrendingUp,
  Shield,
  Zap,
  Award,
  Calendar,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';

export const DashboardPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pointsStats, setPointsStats] = useState<{
    totalPoints: number;
    completedCount: number;
    missedCount: number;
    netCompletedPoints: number;
    netMissedPoints: number;
  } | null>(null);

  // Freeze & Protected dates
  const [overallFreezeBalance, setOverallFreezeBalance] = useState<number>(0);
  const [overallFreezeRechargeDays, setOverallFreezeRechargeDays] = useState<number>(0);
  const [recentProtectedDates, setRecentProtectedDates] = useState<string[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const sumRes = await fetchDashboardSummary();

      if (sumRes.success) {
        setTasks(sumRes.todayTasks || []);
        if (sumRes.pointsStats) {
          setPointsStats(sumRes.pointsStats);
        }
        if (sumRes.user) {
          updateUser({
            currentStreak: sumRes.user.currentStreak,
            longestStreak: sumRes.user.longestStreak,
            profileImage: sumRes.user.profileImage,
            points: sumRes.user.points,
          });
          setOverallFreezeBalance(sumRes.user.overallFreezeBalance || 0);
          setOverallFreezeRechargeDays(sumRes.user.overallFreezeRechargeDays || 0);
          setRecentProtectedDates(sumRes.user.protectedDates || []);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Handle Tick / Untick
  const handleToggleComplete = async (task: Task) => {
    if (task.completedToday) {
      // Optimistic untick immediately
      const prevTasks = [...tasks];
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completedToday: false, todayStudyNote: null } : t))
      );
      try {
        const res = await uncompleteTask(task.id);
        if (res.success) {
          if (res.streak) {
            updateUser({
              currentStreak: res.streak.currentStreak,
              longestStreak: res.streak.longestStreak,
            });
          }
          await loadDashboard();
        } else {
          throw new Error('Failed to undo completion');
        }
      } catch (err: any) {
        // Rollback
        setTasks(prevTasks);
        toast.error(extractErrorMessage(err, 'Failed to undo habit completion.'));
      }
    } else {
      // Open study note modal before completing
      setCompletingTask(task);
    }
  };

  const handleCompleteSubmit = async (studyNote: string) => {
    if (!completingTask || !studyNote) return;
    try {
      const res = await completeTask(completingTask.id, studyNote);
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === completingTask.id
              ? { ...t, completedToday: true, todayStudyNote: studyNote || null }
              : t
          )
        );
        if (res.streak) {
          updateUser({
            currentStreak: res.streak.currentStreak,
            longestStreak: res.streak.longestStreak,
          });
        }

        // 1. Subtle, rewarding Duolingo/LeetCode inspired streak celebration animation
        triggerStreakCelebration({
          newStreak: res.streak?.currentStreak,
        });

        // 2. Compact, clean friend accountability nudge reminder
        triggerPostCompletionNudge({
          taskId: completingTask.id,
          taskTitle: completingTask.title,
        });

        await loadDashboard();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to complete habit.'));
    }
  };

  const handleCreateOrUpdateTask = async (taskData: {
    title: string;
    description?: string;
    category?: string;
    priority: Priority;
    recurrence: Recurrence;
    scheduledDays?: number[];
    dueTime?: string;
  }) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        toast.info('Habit updated');
      } else {
        await createTask(taskData);
        toast.info('Habit created');
      }
      await loadDashboard();
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to save habit.'));
    }
  };

  const handleArchiveToggle = async (task: Task) => {
    const isNowArchived = task.status !== 'ARCHIVED';
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: isNowArchived ? 'ARCHIVED' : 'ACTIVE' } : t))
    );
    toast.info(isNowArchived ? 'Habit archived' : 'Habit restored');

    try {
      const res = await toggleArchiveTask(task.id);
      if (!res.success) throw new Error('Failed to toggle archive');
      await loadDashboard();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
      toast.error(extractErrorMessage(err, 'Failed to update habit status.'));
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const previousTasks = [...tasks];

    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.info('Habit removed');

    try {
      const res = await deleteTask(task.id);
      if (!res.success) throw new Error('Failed to delete habit');
      await loadDashboard();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
      toast.error(extractErrorMessage(err, 'Failed to delete habit.'));
    }
  };

  // Determine current day of week in user's authoritative timezone (0=Sun, 1=Mon, ..., 6=Sat)
  const todayDayOfWeek = DateTime.now().setZone(user?.timezone || 'Asia/Kolkata').weekday % 7;

  // Filter tasks into Today's Checklist vs Other Scheduled Days
  const isScheduledForToday = (t: Task) => {
    if (t.completedToday) return true;
    if (t.recurrence === 'ONE_TIME') return true;
    if (!t.scheduledDays || t.scheduledDays.length === 0) return true;
    return t.scheduledDays.includes(todayDayOfWeek);
  };

  const activeTasks = tasks.filter((t) => t.status === 'ACTIVE');
  const todaysTasks = activeTasks.filter((t) => isScheduledForToday(t));
  const otherScheduledTasks = activeTasks.filter((t) => !isScheduledForToday(t));

  const completedCount = todaysTasks.filter((t) => t.completedToday).length;
  const totalCount = todaysTasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
            Welcome back, <span className="text-flame-400">{user?.name?.split(' ')[0]}</span>!
          </h1>
          <p className="text-sm text-dark-muted mt-1">
            Keep your streak blazing. Complete today's daily checklist before midnight.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-flame-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Dual Clocks Section: Real Time & Midnight Countdown */}
      <DualClock timezone={user?.timezone || 'Asia/Kolkata'} onDayRollover={loadDashboard} />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Streak with Discreet Freeze Status */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-visible">
          <div className="flex items-center justify-between text-dark-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Overall Streak</span>
            <div className="flex items-center gap-2">
              {/* Secondary Discreet Freeze Indicator */}
              <div className="relative group/freeze">
                <button
                  type="button"
                  aria-label="Overall Streak Freeze Status"
                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
                    overallFreezeBalance > 0
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/20'
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800'
                  }`}
                >
                  <Shield className="w-3 h-3 text-cyan-400" />
                  <span>{overallFreezeBalance > 0 ? '1 Freeze' : `${overallFreezeRechargeDays}/7`}</span>
                </button>

                {/* Popover / Tooltip on hover/focus */}
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl opacity-0 invisible group-hover/freeze:opacity-100 group-hover/freeze:visible transition-all duration-150 z-30 pointer-events-none text-left">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-100">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      Overall Streak Freeze
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {overallFreezeBalance > 0 ? 'Ready' : 'Charging'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Protects your streak if you miss completing a habit on any day. Max 1 freeze at a time.
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Recharge Progress</span>
                    </span>
                    <span className="text-zinc-200 font-bold">
                      {overallFreezeBalance === 1 ? '1/1 Ready' : `${overallFreezeRechargeDays} of 7 days`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          overallFreezeBalance === 1
                            ? 100
                            : Math.min(100, (overallFreezeRechargeDays / 7) * 100)
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <Flame className="w-4 h-4 text-flame-500 fill-flame-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-flame-400">
              {user?.currentStreak || 0}
            </span>
            <span className="text-xs text-dark-muted font-medium">days</span>
          </div>
          <p className="text-[11px] text-dark-muted mt-2">
            {user?.currentStreak && user.currentStreak > 0
              ? 'Streak active! Complete at least 1 task daily.'
              : 'Complete a task today to begin!'}
          </p>
        </div>

        {/* Longest Streak */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden">
          <div className="flex items-center justify-between text-dark-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Longest Streak</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-zinc-100">
              {user?.longestStreak || 0}
            </span>
            <span className="text-xs text-dark-muted font-medium">days record</span>
          </div>
          <p className="text-[11px] text-dark-muted mt-2">Personal all-time best consistency</p>
        </div>

        {/* Tasks Completed Today */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden">
          <div className="flex items-center justify-between text-dark-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Done Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-400">
              {completedCount}
            </span>
            <span className="text-xs text-dark-muted font-medium">of {totalCount}</span>
          </div>
          <p className="text-[11px] text-dark-muted mt-2">
            {completedCount >= totalCount && totalCount > 0
              ? 'All daily tasks complete!'
              : `${totalCount - completedCount} tasks remaining`}
          </p>
        </div>

        {/* Completion Rate */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden">
          <div className="flex items-center justify-between text-dark-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Today's Progress</span>
            <TrendingUp className="w-4 h-4 text-flame-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-zinc-100">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-dark-surface rounded-full h-1.5 mt-3 overflow-hidden border border-dark-border">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Points & Accountability Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Accountability Points
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold">
                  +5 / -2 System
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                Earn +5 points for completing habits on scheduled days. Missed scheduled habits incur -2 points. Group tasks are purely streak-based.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center bg-dark-surface px-3.5 py-1.5 rounded-xl border border-dark-border">
            <span className="text-xs text-dark-muted font-medium">Score:</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              {(pointsStats?.totalPoints ?? user?.points ?? 0) > 0
                ? `+${pointsStats?.totalPoints ?? user?.points ?? 0}`
                : (pointsStats?.totalPoints ?? user?.points ?? 0)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">pts</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-dark-border/60">
          <div className="bg-dark-surface/60 rounded-xl p-3 border border-dark-border/60">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
              Completed Scheduled Habits
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1">
              {pointsStats?.completedCount ?? 0} <span className="text-xs font-normal text-zinc-400">instances</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
              +{pointsStats?.netCompletedPoints ?? 0} pts earned
            </div>
          </div>

          <div className="bg-dark-surface/60 rounded-xl p-3 border border-dark-border/60">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"></span>
              Missed Scheduled Habits
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-rose-400 mt-1">
              {pointsStats?.missedCount ?? 0} <span className="text-xs font-normal text-zinc-400">instances</span>
            </div>
            <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">
              -{pointsStats?.netMissedPoints ?? 0} pts deducted
            </div>
          </div>

          <div className="bg-dark-surface/60 rounded-xl p-3 border border-dark-border/60">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-flame-400 inline-block" />
              Consistency Ratio
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-zinc-100 mt-1">
              {(pointsStats?.completedCount ?? 0) + (pointsStats?.missedCount ?? 0) > 0
                ? `${Math.round(((pointsStats?.completedCount ?? 0) / ((pointsStats?.completedCount ?? 0) + (pointsStats?.missedCount ?? 0))) * 100)}%`
                : '100%'}
            </div>
            <div className="text-[10px] text-dark-muted font-mono mt-0.5">
              Scheduled habit accuracy
            </div>
          </div>
        </div>
      </div>

      {/* Recent Protected Dates Alert (if any) */}
      {recentProtectedDates.length > 0 && (
        <div className="px-3.5 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center gap-2 text-xs text-cyan-300">
          <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            Streak protection used on: <strong>{recentProtectedDates.join(', ')}</strong>. Streak continuity remained unbroken!
          </span>
        </div>
      )}

      {/* Today's Checklist Section (Primary Task Completion Interface) */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <ListTodo className="w-5 h-5 text-flame-400" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-100">Today's Checklist</h2>
            <span className="text-xs bg-dark-surface text-dark-muted px-2.5 py-0.5 rounded-full border border-dark-border font-mono">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-dark-muted">Loading your tasks...</div>
        ) : todaysTasks.length === 0 ? (
          <div className="py-12 text-center bg-dark-surface/40 rounded-2xl border border-dashed border-dark-border p-6">
            <ListTodo className="w-10 h-10 text-dark-muted mx-auto mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-zinc-200">No active tasks for today</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
              {otherScheduledTasks.length > 0
                ? 'All caught up for today! Habits scheduled for other days can be viewed below.'
                : 'All caught up for today! Create a new habit to keep your streak blazing.'}
            </p>
            <button
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Add New Habit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {todaysTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canTick={true}
                onToggleComplete={handleToggleComplete}
                onViewDetails={(t) => setDetailTaskId(t.id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsModalOpen(true);
                }}
                onArchiveToggle={handleArchiveToggle}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Other Scheduled Habits (Habits scheduled for other days of the week) */}
      {otherScheduledTasks.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">Other Scheduled Habits</h2>
                <span className="text-xs bg-dark-surface text-dark-muted px-2.5 py-0.5 rounded-full border border-dark-border font-mono">
                  {otherScheduledTasks.length}
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                Habits scheduled for other days of the week. They will appear in your checklist on their scheduled days.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {otherScheduledTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canTick={false}
                onViewDetails={(t) => setDetailTaskId(t.id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsModalOpen(true);
                }}
                onArchiveToggle={handleArchiveToggle}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activity Heatmap Section (Requirement 3 & 7) */}
      <ActivityHeatmap
        timezone={user?.timezone || 'Asia/Kolkata'}
        currentStreak={user?.currentStreak || 0}
      />

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdateTask}
        editingTask={editingTask}
      />

      {/* Task Completion with Study Note Modal */}
      {completingTask && (
        <TaskCompletionModal
          task={completingTask}
          isOpen={!!completingTask}
          onClose={() => setCompletingTask(null)}
          onComplete={handleCompleteSubmit}
        />
      )}

      {/* Task Details & Calendar Modal */}
      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          isOpen={!!detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onTaskUpdated={loadDashboard}
        />
      )}
    </div>
  );
};

