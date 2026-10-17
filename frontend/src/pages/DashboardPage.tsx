import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Flame,
  Trophy,
  CheckCircle2,
  ListTodo,
  Plus,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  Award,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, updateUser } = useAuth();

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
      // Untick immediately
      try {
        const res = await uncompleteTask(task.id);
        if (res.success) {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, completedToday: false, todayStudyNote: null } : t))
          );
          if (res.streak) {
            updateUser({
              currentStreak: res.streak.currentStreak,
              longestStreak: res.streak.longestStreak,
            });
          }
          await loadDashboard();
        }
      } catch (err) {
        console.error('Error undoing completion:', err);
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
        await loadDashboard();
      }
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };


  const handleCreateOrUpdateTask = async (taskData: {
    title: string;
    description?: string;
    category?: string;
    priority: Priority;
    recurrence: Recurrence;
    dueTime?: string;
  }) => {
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
    } else {
      await createTask(taskData);
    }
    await loadDashboard();
  };

  const handleArchiveToggle = async (task: Task) => {
    await toggleArchiveTask(task.id);
    await loadDashboard();
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTask(task.id);
    await loadDashboard();
  };

  const completedCount = tasks.filter((t) => t.completedToday).length;
  const totalCount = tasks.length;
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
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-flame-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Dual Clocks Section: Real Time & Midnight Countdown */}
      <DualClock timezone={user?.timezone || 'Asia/Kolkata'} onDayRollover={loadDashboard} />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Streak */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden">
          <div className="flex items-center justify-between text-dark-muted text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Overall Streak</span>
            <Flame className="w-4 h-4 text-flame-500" />
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

      {/* Points & Accountability Card (Requirement 9) */}
      <div className="bg-gradient-to-br from-amber-500/10 via-dark-card to-dark-surface border border-amber-500/20 rounded-2xl p-5 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  Accountability Points
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                  +5 / -5 System
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                Earn +5 points for completing habits on scheduled days. Missed scheduled habits incur -5 points.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center bg-dark-bg/80 px-4 py-2 rounded-xl border border-amber-500/20">
            <span className="text-xs text-dark-muted font-medium">Total Score:</span>
            <span className="text-2xl font-black font-mono text-amber-400">
              {(pointsStats?.totalPoints ?? user?.points ?? 0) > 0
                ? `+${pointsStats?.totalPoints ?? user?.points ?? 0}`
                : (pointsStats?.totalPoints ?? user?.points ?? 0)}
            </span>
            <span className="text-xs text-zinc-400 font-mono">pts</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-dark-border/60">
          <div className="bg-dark-bg/60 rounded-xl p-3 border border-dark-border">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              Completed Scheduled Habits
            </div>
            <div className="text-lg font-black font-mono text-emerald-400 mt-1">
              {pointsStats?.completedCount ?? 0} <span className="text-xs font-normal text-zinc-400">instances</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
              +{pointsStats?.netCompletedPoints ?? 0} pts earned
            </div>
          </div>

          <div className="bg-dark-bg/60 rounded-xl p-3 border border-dark-border">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
              Missed Scheduled Habits
            </div>
            <div className="text-lg font-black font-mono text-rose-400 mt-1">
              {pointsStats?.missedCount ?? 0} <span className="text-xs font-normal text-zinc-400">instances</span>
            </div>
            <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">
              -{pointsStats?.netMissedPoints ?? 0} pts deducted
            </div>
          </div>

          <div className="bg-dark-bg/60 rounded-xl p-3 border border-dark-border">
            <div className="text-[11px] text-dark-muted font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-flame-400 inline-block" />
              Consistency Ratio
            </div>
            <div className="text-lg font-black font-mono text-zinc-100 mt-1">
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

      {/* Overall Streak Freeze Status Banner (Requirement 8) */}
      <div className="p-4 bg-gradient-to-r from-cyan-950/20 via-dark-surface to-dark-bg border border-cyan-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                Overall Streak Freeze
              </h4>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  overallFreezeBalance > 0
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {overallFreezeBalance > 0 ? '🧊 1 Available' : '0 Available'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Protects your overall streak if you miss completing any task on a day. Max 1 freeze at a time.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-64 space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Recharge</span>
            </span>
            <span>
              {overallFreezeBalance === 1
                ? 'Ready (1/1)'
                : `${overallFreezeRechargeDays} of 7 qualifying days`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-500"
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

      {/* Recent Protected Dates Alert (if any) */}
      {recentProtectedDates.length > 0 && (
        <div className="px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center gap-2 text-xs text-cyan-300">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Streak protection used on: <strong>{recentProtectedDates.join(', ')}</strong>. Streak continuity remained unbroken!
          </span>
        </div>
      )}

      {/* Today's Checklist Section */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-flame-400" />
            <h2 className="text-lg font-bold text-zinc-100">Today's Task Checklist</h2>
            <span className="text-xs bg-dark-surface text-dark-muted px-2 py-0.5 rounded-full border border-dark-border font-mono">
              {completedCount}/{totalCount}
            </span>
          </div>
          <Link
            to="/tasks"
            className="text-xs font-bold text-flame-400 hover:text-flame-300 flex items-center gap-1 font-mono"
          >
            <span>Manage All Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-dark-muted">Loading your tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center bg-dark-surface/40 rounded-2xl border border-dashed border-dark-border p-6">
            <ListTodo className="w-10 h-10 text-dark-muted mx-auto mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-zinc-200">No active tasks for today</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
              Create your daily habits or one-time tasks to start building your streak!
            </p>
            <button
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Add Your First Task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
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

      {/* Activity Heatmap Section (Requirement 3 & 7) */}
      <ActivityHeatmap timezone={user?.timezone || 'Asia/Kolkata'} />

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

