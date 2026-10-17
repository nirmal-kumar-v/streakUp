import React, { useState, useEffect } from 'react';
import { Task, Priority, Recurrence } from '../api/tasks';
import { X, Clock, Tag, AlertCircle, Sparkles } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description?: string;
    category?: string;
    priority: Priority;
    recurrence: Recurrence;
    dueTime?: string;
  }) => Promise<void>;
  editingTask?: Task | null;
}

const CATEGORY_PRESETS = ['General', 'Coding', 'Health', 'Fitness', 'Learning', 'Work', 'Reading', 'Personal'];

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
      setDueTime(editingTask.dueTime || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('General');
      setPriority('MEDIUM');
      setRecurrence('DAILY');
      setDueTime('');
    }
    setError('');
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
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
        dueTime: dueTime || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save task.');
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
