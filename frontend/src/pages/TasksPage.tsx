import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';
import { isLinkedInName } from '../utils/linkedin';

export const TasksPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting state
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
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
        } else {
          throw new Error('Failed to undo completion');
        }
      } catch (err: any) {
        // Rollback
        setTasks(prevTasks);
        toast.error(extractErrorMessage(err, 'Failed to undo habit completion.'));
      }
    } else {
      // If LinkedIn task, complete immediately without requesting a study note
      const isLinkedIn = Boolean(task.isLinkedIn || (task.isGroupTask && isLinkedInName(task.title)));
      if (isLinkedIn) {
        try {
          const res = await completeTask(task.id, 'LinkedIn games completed');
          if (res.success) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, completedToday: true, currentStreak: res.streak?.currentStreak ?? t.currentStreak }
                  : t
              )
            );
            if (res.streak) {
              updateUser({
                currentStreak: res.streak.currentStreak,
                longestStreak: res.streak.longestStreak,
              });
            }
            triggerStreakCelebration({
              newStreak: res.streak?.currentStreak,
            });
            await loadTasks();
            toast.success('Committed LinkedIn games completed!');
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to complete LinkedIn habit.'));
        }
        return;
      }

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

        await loadTasks();
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
    hiddenFrom?: string[];
    visibleOnlyTo?: string[];
  }) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        toast.info('Habit updated');
      } else {
        await createTask(taskData);
        toast.info('Habit created');
      }
      await loadTasks();
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to save habit.'));
    }
  };

  const handleArchiveToggle = async (task: Task) => {
    const isNowArchived = task.status !== 'ARCHIVED';
    const previousTasks = [...tasks];

    // Optimistic toggle: if on ACTIVE tab and archiving, remove from list; if restoring, remove from ARCHIVED tab list
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.info(isNowArchived ? 'Habit archived' : 'Habit restored');

    try {
      const res = await toggleArchiveTask(task.id);
      if (!res.success) throw new Error('Failed to toggle archive');
      await loadTasks();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
      toast.error(extractErrorMessage(err, 'Failed to update habit status.'));
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const previousTasks = [...tasks];

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.info('Habit removed');

    try {
      const res = await deleteTask(task.id);
      if (!res.success) throw new Error('Failed to delete habit');
      await loadTasks();
    } catch (err: any) {
      // Rollback
      setTasks(previousTasks);
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
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('ARCHIVED')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Archived
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
