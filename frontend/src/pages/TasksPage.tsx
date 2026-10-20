import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleArchiveTask,
  completeTask,
  uncompleteTask,
  Task,
  Priority,
  Recurrence,
} from '../api/tasks';
import { useAuth } from '../context/AuthContext';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { TaskCompletionModal } from '../components/TaskCompletionModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CustomSelect } from '../components/CustomSelect';
import { triggerStreakCelebration } from '../components/StreakCelebration';
import { triggerPostCompletionNudge } from '../components/PostCompletionNudge';
import {
  CheckSquare,
  Plus,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  Archive,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';
import { isLinkedInName } from '../utils/linkedin';
import { calculateOptimisticUserStreak } from '../utils/streak';

export const TasksPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // In-flight operation lock to block clicks during backend processing
  const [processingTaskIds, setProcessingTaskIds] = useState<Set<string>>(new Set());
  const processingTaskIdsRef = useRef<Set<string>>(new Set());

  const urlStatus = searchParams.get('status') || searchParams.get('tab');
  const initialStatus: 'ACTIVE' | 'ARCHIVED' =
    urlStatus?.toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<{ active: number; archived: number }>({ active: 0, archived: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting state
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const hasLoadedRef = React.useRef(false);

  // Sync state if URL query param changes
  useEffect(() => {
    const currentParam = searchParams.get('status') || searchParams.get('tab');
    if (currentParam?.toUpperCase() === 'ARCHIVED' && statusFilter !== 'ARCHIVED') {
      setStatusFilter('ARCHIVED');
      hasLoadedRef.current = false;
    } else if (currentParam?.toUpperCase() === 'ACTIVE' && statusFilter !== 'ACTIVE') {
      setStatusFilter('ACTIVE');
      hasLoadedRef.current = false;
    }
  }, [searchParams]);

  const handleStatusChange = (newStatus: 'ACTIVE' | 'ARCHIVED') => {
    setStatusFilter(newStatus);
    hasLoadedRef.current = false;
    setSearchParams(newStatus === 'ARCHIVED' ? { status: 'ARCHIVED' } : {});
  };

  const loadTasks = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await fetchTasks({
        status: statusFilter,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        sortBy,
        sortOrder,
      });

      if (res.success) {
        setTasks(res.tasks || []);
        if (typeof res.activeCount === 'number' && typeof res.archivedCount === 'number') {
          setCounts({ active: res.activeCount, archived: res.archivedCount });
        }
        hasLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle Tick / Untick
  const handleToggleComplete = async (task: Task) => {
    if (processingTaskIdsRef.current.has(task.id)) {
      return;
    }
    processingTaskIdsRef.current.add(task.id);
    setProcessingTaskIds(new Set(processingTaskIdsRef.current));

    try {
      if (task.completedToday) {
        // Optimistic untick immediately
        const prevTasks = [...tasks];
        const nextTaskStreak = Math.max(0, (task.currentStreak || 1) - 1);

        const otherCompleted = tasks.filter((t) => t.id !== task.id && t.completedToday).length;
        const nextUserStreak = otherCompleted === 0 ? Math.max(0, (user?.currentStreak || 1) - 1) : (user?.currentStreak || 0);

        const optimisticTasks = tasks.map((t) =>
          t.id === task.id
            ? { ...t, completedToday: false, todayStudyNote: null, currentStreak: nextTaskStreak }
            : t
        );
        setTasks(optimisticTasks);

        // Optimistically update overall streak
        updateUser({
          currentStreak: nextUserStreak,
        });

        try {
          const res = await uncompleteTask(task.id);
          if (res.success) {
            const finalTaskStreak = res.taskStreak?.currentStreak ?? nextTaskStreak;
            const finalTaskLongest = res.taskStreak?.longestStreak ?? task.longestStreak;
            const finalUserStreak = res.streak?.currentStreak ?? nextUserStreak;
            const finalUserLongest = res.streak?.longestStreak ?? user?.longestStreak;

            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      completedToday: false,
                      currentStreak: finalTaskStreak,
                      longestStreak: finalTaskLongest,
                    }
                  : t
              )
            );

            if (typeof res.totalPoints === 'number') {
              updateUser({
                currentStreak: finalUserStreak,
                longestStreak: finalUserLongest,
                points: res.totalPoints,
              });
            } else if (res.streak) {
              updateUser({
                currentStreak: finalUserStreak,
                longestStreak: finalUserLongest,
              });
            }
          } else {
            throw new Error('Failed to undo completion');
          }
        } catch (err: any) {
          if (err?.response?.status === 429) {
            return;
          }
          // Rollback
          setTasks(prevTasks);
          toast.error(extractErrorMessage(err, 'Failed to undo habit completion.'));
        }
      } else {
        // If LinkedIn task, complete immediately without requesting a study note
        const isLinkedIn = Boolean(
          task.isLinkedIn ||
          ((task.isGroupTask || !!task.groupId) && isLinkedInName(task.title)) ||
          isLinkedInName(task.title)
        );
        if (isLinkedIn) {
          const prevTasks = [...tasks];
          const nextStreak = (task.currentStreak || 0) + 1;
          const nextLongest = Math.max(task.longestStreak || 0, nextStreak);

          const otherCompleted = tasks.some((t) => t.id !== task.id && t.completedToday);
          const nextUserStreak = calculateOptimisticUserStreak(user?.currentStreak || 0, otherCompleted, user?.createdAt);
          const nextUserLongest = Math.max(user?.longestStreak || 0, nextUserStreak);

          const optimisticTasks = tasks.map((t) =>
            t.id === task.id
              ? { ...t, completedToday: true, currentStreak: nextStreak, longestStreak: nextLongest }
              : t
          );
          setTasks(optimisticTasks);

          // Optimistically update overall streak
          updateUser({
            currentStreak: nextUserStreak,
            longestStreak: nextUserLongest,
          });

          triggerStreakCelebration({
            newStreak: nextStreak,
          });

          try {
            const res = await completeTask(task.id, 'LinkedIn games completed');
            if (res.success) {
              const finalTaskStreak = res.taskStreak?.currentStreak ?? nextStreak;
              const finalTaskLongest = res.taskStreak?.longestStreak ?? nextLongest;
              const finalUserStreak = res.streak?.currentStreak ?? nextUserStreak;
              const finalUserLongest = res.streak?.longestStreak ?? nextUserLongest;

              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? {
                        ...t,
                        completedToday: true,
                        currentStreak: finalTaskStreak,
                        longestStreak: finalTaskLongest,
                      }
                    : t
                )
              );

              if (typeof res.totalPoints === 'number') {
                updateUser({
                  currentStreak: finalUserStreak,
                  longestStreak: finalUserLongest,
                  points: res.totalPoints,
                });
              } else if (res.streak) {
                updateUser({
                  currentStreak: finalUserStreak,
                  longestStreak: finalUserLongest,
                });
              }
            }
          } catch (err: any) {
            if (err?.response?.status === 429) {
              return;
            }
            setTasks(prevTasks);
            toast.error(extractErrorMessage(err, 'Failed to complete LinkedIn habit.'));
          }
          return;
        }

        setCompletingTask(task);
      }
    } finally {
      processingTaskIdsRef.current.delete(task.id);
      setProcessingTaskIds(new Set(processingTaskIdsRef.current));
    }
  };

  const handleCompleteSubmit = async (studyNote: string) => {
    if (!completingTask || !studyNote) return;
    const taskToComplete = completingTask;
    if (processingTaskIdsRef.current.has(taskToComplete.id)) return;
    processingTaskIdsRef.current.add(taskToComplete.id);
    setProcessingTaskIds(new Set(processingTaskIdsRef.current));

    const prevTasks = [...tasks];
    const nextStreak = (taskToComplete.currentStreak || 0) + 1;
    const nextLongest = Math.max(taskToComplete.longestStreak || 0, nextStreak);

    const otherCompleted = tasks.some((t) => t.id !== taskToComplete.id && t.completedToday);
    const nextUserStreak = calculateOptimisticUserStreak(user?.currentStreak || 0, otherCompleted, user?.createdAt);
    const nextUserLongest = Math.max(user?.longestStreak || 0, nextUserStreak);

    const optimisticTasks = tasks.map((t) =>
      t.id === taskToComplete.id
        ? { ...t, completedToday: true, todayStudyNote: studyNote || null, currentStreak: nextStreak, longestStreak: nextLongest }
        : t
    );

    // Immediately close modal and optimistically update habit list for 0ms lag
    setCompletingTask(null);
    setTasks(optimisticTasks);

    // Optimistically update overall streak
    updateUser({
      currentStreak: nextUserStreak,
      longestStreak: nextUserLongest,
    });

    // 1. Subtle, rewarding Duolingo/LeetCode inspired streak celebration animation
    triggerStreakCelebration({
      newStreak: nextStreak,
    });

    // 2. Compact, clean friend accountability nudge reminder
    triggerPostCompletionNudge({
      taskId: taskToComplete.id,
      taskTitle: taskToComplete.title,
    });

    try {
      const res = await completeTask(taskToComplete.id, studyNote);
      if (res.success) {
        const finalTaskStreak = res.taskStreak?.currentStreak ?? nextStreak;
        const finalTaskLongest = res.taskStreak?.longestStreak ?? nextLongest;
        const finalUserStreak = res.streak?.currentStreak ?? nextUserStreak;
        const finalUserLongest = res.streak?.longestStreak ?? nextUserLongest;

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskToComplete.id
              ? {
                  ...t,
                  completedToday: true,
                  currentStreak: finalTaskStreak,
                  longestStreak: finalTaskLongest,
                  todayStudyNote: res.studyNote || studyNote,
                }
              : t
          )
        );

        if (typeof res.totalPoints === 'number') {
          updateUser({
            currentStreak: finalUserStreak,
            longestStreak: finalUserLongest,
            points: res.totalPoints,
          });
        } else if (res.streak) {
          updateUser({
            currentStreak: finalUserStreak,
            longestStreak: finalUserLongest,
          });
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        return;
      }
      setTasks(prevTasks);
      toast.error(extractErrorMessage(err, 'Failed to complete habit.'));
    } finally {
      processingTaskIdsRef.current.delete(taskToComplete.id);
      setProcessingTaskIds(new Set(processingTaskIdsRef.current));
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
    hiddenFrom?: string[];
    visibleOnlyTo?: string[];
  }) => {
    const prevTasks = [...tasks];
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t))
      );
      toast.info('Habit updated');
      try {
        await updateTask(editingTask.id, taskData);
        loadTasks();
      } catch (err: any) {
        setTasks(prevTasks);
        toast.error(extractErrorMessage(err, 'Failed to save habit.'));
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: Task = {
        id: tempId,
        title: taskData.title,
        description: taskData.description || null,
        category: taskData.category || 'General',
        priority: taskData.priority,
        recurrence: taskData.recurrence,
        scheduledDays: taskData.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
        dueTime: taskData.dueTime || null,
        status: 'ACTIVE',
        currentStreak: 0,
        longestStreak: 0,
        freezeBalance: 0,
        freezeRechargeDays: 0,
        completedToday: false,
        todayStudyNote: null,
        hiddenFrom: taskData.hiddenFrom || [],
        visibleOnlyTo: taskData.visibleOnlyTo || [],
        userId: user?.id || 'me',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (statusFilter === 'ACTIVE') {
        setTasks((prev) => [optimisticTask, ...prev]);
        setCounts((prev) => ({ ...prev, active: prev.active + 1 }));
      }
      toast.info('Habit created');
      try {
        const res = await createTask(taskData);
        if (res.success && res.task) {
          setTasks((prev) => prev.map((t) => (t.id === tempId ? res.task : t)));
        }
        loadTasks();
      } catch (err: any) {
        setTasks(prevTasks);
        toast.error(extractErrorMessage(err, 'Failed to create habit.'));
      }
    }
  };

  const handleArchiveToggle = async (task: Task) => {
    const isNowArchived = task.status !== 'ARCHIVED';
    const previousTasks = [...tasks];
    const previousCounts = { ...counts };

    // Optimistic toggle: if on ACTIVE tab and archiving, remove from list; if restoring, remove from ARCHIVED tab list
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCounts((prev) => ({
      active: isNowArchived ? Math.max(0, prev.active - 1) : prev.active + 1,
      archived: isNowArchived ? prev.archived + 1 : Math.max(0, prev.archived - 1),
    }));

    toast.info(isNowArchived ? 'Habit moved to Archived' : 'Habit restored to Active checklist');

    try {
      const res = await toggleArchiveTask(task.id);
      if (!res.success) throw new Error('Failed to toggle archive');
      await loadTasks();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
      setCounts(previousCounts);
      toast.error(extractErrorMessage(err, 'Failed to update habit status.'));
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const previousTasks = [...tasks];
    const previousCounts = { ...counts };

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    if (task.status === 'ARCHIVED') {
      setCounts((prev) => ({ ...prev, archived: Math.max(0, prev.archived - 1) }));
    } else {
      setCounts((prev) => ({ ...prev, active: Math.max(0, prev.active - 1) }));
    }
    toast.info('Habit removed');

    try {
      const res = await deleteTask(task.id);
      if (!res.success) throw new Error('Failed to delete habit');
      await loadTasks();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
      setCounts(previousCounts);
      toast.error(extractErrorMessage(err, 'Failed to delete habit.'));
    }
  };

  // Filter tasks client-side by search query
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  });

  // Current day of week in user's authoritative timezone (0=Sun, 1=Mon, ..., 6=Sat)
  const todayDayOfWeek = DateTime.now().setZone(user?.timezone || 'Asia/Kolkata').weekday % 7;

  const isScheduledForToday = (t: Task) => {
    if (t.completedToday) return true;
    if (t.recurrence === 'ONE_TIME') return true;
    if (!t.scheduledDays || t.scheduledDays.length === 0) return true;
    return t.scheduledDays.includes(todayDayOfWeek);
  };

  // Separate pending today, completed today, and other scheduled days
  const pendingTasksToday = filteredTasks.filter((t) => !t.completedToday && isScheduledForToday(t));
  const completedTasksToday = filteredTasks.filter((t) => t.completedToday);
  const otherScheduledTasks = filteredTasks.filter((t) => !t.completedToday && !isScheduledForToday(t));

  // Derive unique categories from tasks
  const categories = Array.from(new Set(['ALL', ...tasks.map((t) => t.category).filter(Boolean)]));

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-flame-500" />
            My Tasks
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted mt-1">
            Manage your daily recurring habits and one-time productivity goals
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

      {/* Filter and Control Bar */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex bg-dark-surface p-1 rounded-xl border border-dark-border">
            <button
              onClick={() => handleStatusChange('ACTIVE')}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                statusFilter === 'ACTIVE'
                  ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Active</span>
              {counts.active > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'ACTIVE' ? 'bg-flame-500/30 text-flame-300' : 'bg-dark-card text-zinc-500'
                }`}>
                  {counts.active}
                </span>
              )}
            </button>
            <button
              onClick={() => handleStatusChange('ARCHIVED')}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archived</span>
              {counts.archived > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'ARCHIVED' ? 'bg-amber-500/30 text-amber-200' : 'bg-dark-card text-zinc-500'
                }`}>
                  {counts.archived}
                </span>
              )}
            </button>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-dark-muted flex-shrink-0" />
            <CustomSelect
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'HIGH', label: 'High Priority' },
                { value: 'MEDIUM', label: 'Medium Priority' },
                { value: 'LOW', label: 'Low Priority' },
              ]}
              size="sm"
            />
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-dark-muted flex-shrink-0" />
            <CustomSelect
              value={`${sortBy}_${sortOrder}`}
              onChange={(val) => {
                const [sb, so] = val.split('_');
                setSortBy(sb);
                setSortOrder(so as 'asc' | 'desc');
              }}
              options={[
                { value: 'createdAt_desc', label: 'Newest First' },
                { value: 'createdAt_asc', label: 'Oldest First' },
                { value: 'priority_desc', label: 'Highest Priority' },
                { value: 'dueTime_asc', label: 'Earliest Due Time' },
                { value: 'title_asc', label: 'Title (A - Z)' },
              ]}
              size="sm"
            />
          </div>
        </div>

        {/* Category Pills */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-dark-border/60">
            <span className="text-[11px] font-semibold text-dark-muted uppercase mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-flame-500/10 text-flame-400 border-flame-500/30 font-bold'
                    : 'bg-dark-surface text-zinc-400 border-dark-border hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task Content */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-dark-muted">
          <div className="inline-flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        </div>
      ) : statusFilter === 'ARCHIVED' ? (
        <div className="space-y-6">
          {/* Informational Guidance Banner */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-dark-card to-dark-card rounded-2xl border border-amber-500/25 flex items-start gap-3.5 shadow-panel">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Archived Habits & Tasks
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'habit' : 'habits'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                These habits are inactive and won't affect your daily checklist or break your streaks. All historical completions, notes, and records are safely preserved. Click the restore icon on any card to bring it back to active.
              </p>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-20 text-center bg-dark-card border border-dashed border-dark-border rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-dark-surface border border-dark-border flex items-center justify-center mx-auto mb-3 text-dark-muted">
                <Archive className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-200">No archived habits</h3>
              <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
                When you pause or archive a habit, it safely sleeps here until you choose to restore it.
              </p>
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                className="mt-4 px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 font-bold text-xs rounded-xl transition-all"
              >
                View Active Habits
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredTasks.map((task) => (
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
          )}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-20 text-center bg-dark-card border border-dashed border-dark-border rounded-2xl p-8">
          <Layers className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold text-zinc-200">No tasks match your filters</h3>
          <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
            Try adjusting your status or priority filters, or create a brand new task.
          </p>
          <button
            onClick={() => {
              setEditingTask(null);
              setIsModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add New Task
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Tasks for Today */}
          {pendingTasksToday.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                    To-Do Today ({pendingTasksToday.length})
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {pendingTasksToday.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canTick={true}
                    isProcessing={processingTaskIds.has(task.id)}
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
            </div>
          )}

          {/* Completed Tasks Today */}
          {completedTasksToday.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-dark-border/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                  Completed Today ({completedTasksToday.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {completedTasksToday.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canTick={true}
                    isProcessing={processingTaskIds.has(task.id)}
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
            </div>
          )}

          {/* Scheduled on Other Days */}
          {otherScheduledTasks.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-dark-border/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                  Scheduled for Other Days ({otherScheduledTasks.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
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
        </div>
      )}

      {/* Task Creation & Edit Modal */}
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

      {/* Task Detail Modal */}
      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          isOpen={!!detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onTaskUpdated={loadTasks}
        />
      )}
    </div>
  );
};
