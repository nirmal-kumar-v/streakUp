import React, { useState, useEffect, useMemo } from 'react';
import { Task, Priority, Recurrence } from '../api/tasks';
import { fetchFriendsList, FriendUser } from '../api/friends';
import { X, Clock, Tag, AlertCircle, Sparkles, Shield, Eye, EyeOff } from 'lucide-react';
import { InitialsAvatar } from './InitialsAvatar';
import { extractErrorMessage } from '../utils/error';
import { useBodyScrollLock } from '../utils/scrollLock';

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
    hiddenFrom?: string[];
    visibleOnlyTo?: string[];
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
  useBodyScrollLock(isOpen);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [recurrence, setRecurrence] = useState<Recurrence>('DAILY');
  const [scheduleType, setScheduleType] = useState<'EVERY_DAY' | 'CUSTOM'>('EVERY_DAY');
  const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [dueTime, setDueTime] = useState('');
  const [hiddenFrom, setHiddenFrom] = useState<string[]>([]);
  const [visibleOnlyTo, setVisibleOnlyTo] = useState<string[]>([]);
  const [hideFromInput, setHideFromInput] = useState('');
  const [showOnlyToInput, setShowOnlyToInput] = useState('');
  const [hideSuggestionsOpen, setHideSuggestionsOpen] = useState(false);
  const [showSuggestionsOpen, setShowSuggestionsOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<FriendUser[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFriendsList()
        .then((res) => {
          if (res.success && res.friends) {
            setFriendsList(res.friends);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

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
      setHiddenFrom(editingTask.hiddenFrom || []);
      setVisibleOnlyTo(editingTask.visibleOnlyTo || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('General');
      setPriority('MEDIUM');
      setRecurrence('DAILY');
      setScheduleType('EVERY_DAY');
      setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
      setDueTime('');
      setHiddenFrom([]);
      setVisibleOnlyTo([]);
    }
    setHideFromInput('');
    setShowOnlyToInput('');
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

  const addHideFrom = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!hiddenFrom.includes(clean)) {
      setHiddenFrom([...hiddenFrom, clean]);
    }
    setHideFromInput('');
  };

  const removeHideFrom = (name: string) => {
    setHiddenFrom(hiddenFrom.filter((h) => h !== name));
  };

  const addVisibleOnlyTo = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!visibleOnlyTo.includes(clean)) {
      setVisibleOnlyTo([...visibleOnlyTo, clean]);
    }
    setShowOnlyToInput('');
  };

  const removeVisibleOnlyTo = (name: string) => {
    setVisibleOnlyTo(visibleOnlyTo.filter((v) => v !== name));
  };

  const filteredHideSuggestions = useMemo(() => {
    const q = hideFromInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; isAll?: boolean; image?: string | null }> = [];
    if ('all'.startsWith(q) || 'everyone'.startsWith(q)) {
      list.push({ id: 'all', label: 'all', sublabel: 'Hide from everyone', isAll: true });
    }
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !hiddenFrom.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [hideFromInput, friendsList, hiddenFrom]);

  const filteredShowSuggestions = useMemo(() => {
    const q = showOnlyToInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; image?: string | null }> = [];
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !visibleOnlyTo.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [showOnlyToInput, friendsList, visibleOnlyTo]);

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
        hiddenFrom,
        visibleOnlyTo,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save task.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto overscroll-contain">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
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
                          className={`py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-lg border transition-all text-center flex items-center justify-center min-w-0 truncate ${
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

          {/* Privacy & Visibility Controls */}
          <div className="p-4 rounded-2xl bg-dark-surface/60 border border-dark-border space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Privacy & Sharing Controls</span>
            </div>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              Control who can view this task, streak, and study notes in friend feeds and leaderboards.
            </p>

            {/* Hide From Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hide From</span>
                </label>
                <span className="text-[10px] text-dark-muted font-mono">
                  Type username or <strong className="text-amber-400 font-bold">"all"</strong> to hide from everyone
                </span>
              </div>

              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type name or 'all'..."
                    value={hideFromInput}
                    onChange={(e) => {
                      setHideFromInput(e.target.value);
                      setHideSuggestionsOpen(true);
                    }}
                    onFocus={() => setHideSuggestionsOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHideFrom(hideFromInput);
                        setHideSuggestionsOpen(false);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addHideFrom(hideFromInput);
                      setHideSuggestionsOpen(false);
                    }}
                    className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Auto-suggest dropdown */}
                {hideSuggestionsOpen && filteredHideSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-14 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden py-1 max-h-44 overflow-y-auto">
                    {filteredHideSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addHideFrom(s.label);
                          setHideSuggestionsOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {s.isAll ? (
                            <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-300 flex items-center justify-center text-xs font-bold">🛡️</span>
                          ) : (
                            <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                          )}
                          <div className="truncate">
                            <span className="font-semibold text-zinc-200 block truncate">
                              {s.isAll ? '"all" (Hide from everyone)' : `@${s.label}`}
                            </span>
                            {s.sublabel && !s.isAll && (
                              <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Hidden Tags */}
              {hiddenFrom.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {hiddenFrom.map((name) => (
                    <span
                      key={name}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium border ${
                        name === 'all'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-bold'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <span>{name === 'all' ? '🛡️ Everyone ("all")' : `@${name}`}</span>
                      <button
                        type="button"
                        onClick={() => removeHideFrom(name)}
                        className="hover:text-white p-0.5 text-zinc-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Show Only To Field */}
            <div className="pt-2 border-t border-dark-border/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Show Only To</span>
                </label>
                <span className="text-[10px] text-dark-muted font-mono">
                  Optional exclusive whitelist
                </span>
              </div>

              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type name to whitelist..."
                    value={showOnlyToInput}
                    onChange={(e) => {
                      setShowOnlyToInput(e.target.value);
                      setShowSuggestionsOpen(true);
                    }}
                    onFocus={() => setShowSuggestionsOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVisibleOnlyTo(showOnlyToInput);
                        setShowSuggestionsOpen(false);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addVisibleOnlyTo(showOnlyToInput);
                      setShowSuggestionsOpen(false);
                    }}
                    className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Auto-suggest dropdown */}
                {showSuggestionsOpen && filteredShowSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-14 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden py-1 max-h-44 overflow-y-auto">
                    {filteredShowSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addVisibleOnlyTo(s.label);
                          setShowSuggestionsOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-zinc-800 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                          <div className="truncate">
                            <span className="font-semibold text-zinc-200 block truncate">@{s.label}</span>
                            {s.sublabel && (
                              <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Visible Tags */}
              {visibleOnlyTo.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {visibleOnlyTo.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    >
                      <span>@{name}</span>
                      <button
                        type="button"
                        onClick={() => removeVisibleOnlyTo(name)}
                        className="hover:text-white p-0.5 text-emerald-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-dark-border mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-xl transition-colors font-medium text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-2 text-sm bg-flame-500 hover:bg-flame-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-flame-500/20 disabled:opacity-50 text-center"
            >
              {isSubmitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
