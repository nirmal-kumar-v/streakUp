import React, { useState, useEffect } from 'react';
import { Task, Priority, Recurrence } from '../api/tasks';
import { X, Clock, Tag, AlertCircle, Sparkles } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description?: string;
    category?: string;
    priority: Priority;
    recurrence: Recurrence;
    scheduledDays?: number[];
    dueTime?: string;
  }) => Promise<void>;
  editingTask?: Task | null;
}

const CATEGORY_PRESETS = ['General', 'Coding', 'Health', 'Fitness', 'Learning', 'Work', 'Reading', 'Personal'];

const WEEKDAYS = [
  { day: 0, label: 'Sun' },
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [recurrence, setRecurrence] = useState<Recurrence>('DAILY');
  const [scheduleType, setScheduleType] = useState<'EVERY_DAY' | 'CUSTOM'>('EVERY_DAY');
  const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [dueTime, setDueTime] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setCategory(editingTask.category || 'General');
      setPriority(editingTask.priority);
      setRecurrence(editingTask.recurrence);
      const days = editingTask.scheduledDays || [0, 1, 2, 3, 4, 5, 6];
      setScheduledDays(days);
      setScheduleType(days.length === 7 ? 'EVERY_DAY' : 'CUSTOM');
      setDueTime(editingTask.dueTime || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('General');
      setPriority('MEDIUM');
      setRecurrence('DAILY');
      setScheduleType('EVERY_DAY');
      setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
      setDueTime('');
    }
    setError('');
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    if (scheduledDays.includes(day)) {
      if (scheduledDays.length <= 1) {
        setError('At least one day must be scheduled');
        return;
      }
      setScheduledDays(scheduledDays.filter((d) => d !== day));
    } else {
      setScheduledDays([...scheduledDays, day].sort());
      setError('');
    }
  };

  const handleScheduleTypeChange = (type: 'EVERY_DAY' | 'CUSTOM') => {
    setScheduleType(type);
    if (type === 'EVERY_DAY') {
      setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
    } else if (scheduledDays.length === 7) {
      setScheduledDays([1, 2, 3, 4, 5]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (recurrence === 'DAILY' && scheduledDays.length === 0) {
      setError('Please select at least one day for this habit schedule.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || 'General',
        priority,
        recurrence,
        scheduledDays: recurrence === 'DAILY' ? scheduledDays : undefined,
        dueTime: dueTime || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save task.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-flame-500/10 border border-flame-500/20 flex items-center justify-center text-flame-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h2>
              <p className="text-xs text-dark-muted">
                {editingTask ? 'Update task parameters' : 'Define your daily habit or goal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-dark-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Task Title <span className="text-flame-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 45-min Deep Coding Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 focus:ring-1 focus:ring-flame-500/40 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add key notes, links, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 focus:ring-1 focus:ring-flame-500/40 transition-all resize-none"
            />
          </div>

          {/* Recurrence & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recurrence */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Recurrence</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-dark-surface rounded-xl border border-dark-border">
                <button
                  type="button"
                  onClick={() => setRecurrence('DAILY')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    recurrence === 'DAILY'
                      ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Daily Habit
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrence('ONE_TIME')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    recurrence === 'ONE_TIME'
                      ? 'bg-zinc-700/60 text-zinc-200 border border-zinc-600'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  One-time Task
                </button>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Priority</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-dark-surface rounded-xl border border-dark-border">
                {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      priority === p
                        ? p === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : p === 'MEDIUM'
                          ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30'
                          : 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Habit Schedule Selector (Requirement 2) */}
          {recurrence === 'DAILY' && (
            <div className="p-3.5 bg-dark-surface/70 border border-dark-border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-200">Habit Schedule</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleScheduleTypeChange('EVERY_DAY')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      scheduleType === 'EVERY_DAY'
                        ? 'bg-flame-500/20 text-flame-300 border-flame-500/30 font-bold'
                        : 'bg-dark-surface text-zinc-400 border-dark-border hover:text-zinc-200'
                    }`}
                  >
                    Every Day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScheduleTypeChange('CUSTOM')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      scheduleType === 'CUSTOM'
                        ? 'bg-flame-500/20 text-flame-300 border-flame-500/30 font-bold'
                        : 'bg-dark-surface text-zinc-400 border-dark-border hover:text-zinc-200'
                    }`}
                  >
                    Custom Days
                  </button>
                </div>
              </div>

              {scheduleType === 'CUSTOM' && (
                <div className="pt-1 space-y-2">
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((w) => {
                      const isSelected = scheduledDays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          onClick={() => toggleDay(w.day)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-flame-500 text-zinc-950 border-flame-400 shadow-sm shadow-flame-500/20'
                              : 'bg-dark-surface text-zinc-400 border-dark-border hover:border-zinc-600 hover:text-zinc-200'
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-dark-muted">
                    <span>
                      Active: <strong className="text-zinc-200">{scheduledDays.length} day{scheduledDays.length === 1 ? '' : 's'}/week</strong>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduledDays([1, 2, 3, 4, 5])}
                        className="text-flame-400 hover:text-flame-300 hover:underline"
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduledDays([0, 6])}
                        className="text-flame-400 hover:text-flame-300 hover:underline"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category & Due Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-flame-400" /> Category
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {CATEGORY_PRESETS.slice(0, 5).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                      category === cat
                        ? 'bg-flame-500/10 text-flame-300 border-flame-500/30'
                        : 'bg-dark-surface text-zinc-400 border-dark-border hover:text-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Time */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-flame-400" /> Due Time (optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80 font-mono"
              />
              <p className="text-[10px] text-dark-muted mt-1.5">Optional target time for completing this task.</p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-border mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm bg-flame-500 hover:bg-flame-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-flame-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
