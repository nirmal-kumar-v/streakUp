import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchDashboardSummary,
  fetchActivityHistory,
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
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import {
  Flame,
  Trophy,
  CheckCircle2,
  ListTodo,
  Plus,
  Users2,
  Globe2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, updateUser } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<Array<{ date: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [sumRes, actRes] = await Promise.all([
        fetchDashboardSummary(),
        fetchActivityHistory(),
      ]);

      if (sumRes.success) {
        setTasks(sumRes.todayTasks || []);
        // Sync streak with auth context if updated
        if (sumRes.user) {
          updateUser({
            currentStreak: sumRes.user.currentStreak,
            longestStreak: sumRes.user.longestStreak,
          });
        }
      }

      if (actRes.success) {
        setActivity(actRes.activity || []);
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

  // Handle Tick / Untick directly from Dashboard
  const handleToggleComplete = async (task: Task) => {
    try {
      if (task.completedToday) {
        const res = await uncompleteTask(task.id);
        if (res.success) {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, completedToday: false } : t))
          );
          if (res.streak) {
            updateUser({
              currentStreak: res.streak.currentStreak,
              longestStreak: res.streak.longestStreak,
            });
          }
          await loadDashboard(); // refresh counts
        }
      } else {
        const res = await completeTask(task.id);
        if (res.success) {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, completedToday: true } : t))
          );
          if (res.streak) {
            updateUser({
              currentStreak: res.streak.currentStreak,
              longestStreak: res.streak.longestStreak,
            });
          }
          await loadDashboard(); // refresh counts
        }
      }
    } catch (err) {
      console.error('Error toggling task completion:', err);
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
            <span>Current Streak</span>
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
              ? 'Streak active! Complete tasks daily.'
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

      {/* Activity Heatmap Section */}
      <ActivityHeatmap
        activity={activity}
        daysToShow={70}
        timezone={user?.timezone || 'Asia/Kolkata'}
      />

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/tasks"
          className="bg-dark-card border border-dark-border hover:border-zinc-700 rounded-2xl p-5 shadow-panel transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors">
              Task Manager
            </h4>
            <p className="text-xs text-dark-muted mt-0.5">Filter, sort, and organize habits</p>
          </div>
          <ArrowRight className="w-4 h-4 text-dark-muted group-hover:text-flame-400 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/leaderboard/global"
          className="bg-dark-card border border-dark-border hover:border-zinc-700 rounded-2xl p-5 shadow-panel transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors">
              Global Leaderboard
            </h4>
            <p className="text-xs text-dark-muted mt-0.5">See worldwide top streak holders</p>
          </div>
          <Globe2 className="w-4 h-4 text-dark-muted group-hover:text-flame-400 transition-colors" />
        </Link>

        <Link
          to="/leaderboard/friends"
          className="bg-dark-card border border-dark-border hover:border-zinc-700 rounded-2xl p-5 shadow-panel transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors">
              Friends Leaderboard
            </h4>
            <p className="text-xs text-dark-muted mt-0.5">Compete with your friend circle</p>
          </div>
          <Users2 className="w-4 h-4 text-dark-muted group-hover:text-flame-400 transition-colors" />
        </Link>
      </div>

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdateTask}
        editingTask={editingTask}
      />
    </div>
  );
};
