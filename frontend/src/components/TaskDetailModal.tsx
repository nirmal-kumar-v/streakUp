import React, { useState, useEffect } from 'react';
import {
  fetchTaskDetails,
  fetchTaskFriendsLeaderboard,
  confirmTaskEquivalence,
  rejectTaskEquivalence,
  updateCompletionNote,
  TaskDetailData,
  TaskFriendsLeaderboardData,
} from '../api/tasks';
import { InitialsAvatar } from './InitialsAvatar';
import { useToast } from '../context/ToastContext';
import {
  Flame,
  Shield,
  Zap,
  Calendar as CalendarIcon,
  CheckCircle2,
  Trophy,
  Edit2,
  Check,
  X,
  Sparkles,
  Lock,
  Clock,
  HelpCircle,
} from 'lucide-react';

import { useBodyScrollLock } from '../utils/scrollLock';

interface TaskDetailModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  useBodyScrollLock(isOpen);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'leaderboard'>('overview');
  const [details, setDetails] = useState<TaskDetailData | null>(null);
  const [leaderboard, setLeaderboard] = useState<TaskFriendsLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Note editing state
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [detailRes, leaderboardRes] = await Promise.all([
        fetchTaskDetails(taskId),
        fetchTaskFriendsLeaderboard(taskId),
      ]);
      if (detailRes.success) setDetails(detailRes);
      if (leaderboardRes.success) setLeaderboard(leaderboardRes);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load task details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadData();
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const handleStartEditNote = (date: string, currentNote: string | null) => {
    setEditingDate(date);
    setEditNoteText(currentNote || '');
  };

  const handleSaveNote = async (date: string) => {
    setIsSavingNote(true);
    try {
      const res = await updateCompletionNote(taskId, date, editNoteText.trim());
      if (res.success && details) {
        setDetails({
          ...details,
          completions: details.completions.map((c) =>
            c.completionDate === date ? { ...c, studyNote: editNoteText.trim() || null } : c
          ),
        });
        setEditingDate(null);
        toast.info('Note updated');
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleConfirmMatch = async (friendTaskId: string) => {
    try {
      await confirmTaskEquivalence(taskId, friendTaskId);
      toast.info('Habit matched with friend');
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to confirm equivalence.');
    }
  };

  const handleRejectMatch = async (friendTaskId: string) => {
    try {
      await rejectTaskEquivalence(taskId, friendTaskId);
      toast.info('Match dismissed');
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject match.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-2xl bg-dark-surface border border-dark-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 border-b border-dark-border flex items-start justify-between bg-dark-bg/50 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-flame-400 font-bold px-2 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
                {details?.task.category || 'General'}
              </span>
              {details?.task.priority && (
                <span
                  className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border uppercase ${
                    details.task.priority === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : details.task.priority === 'MEDIUM'
                      ? 'bg-flame-500/10 text-flame-400 border-flame-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {details.task.priority} Priority
                </span>
              )}
              <span className="text-[11px] font-mono text-zinc-400 bg-dark-surface px-2 py-0.5 rounded-md border border-dark-border">
                {details?.task.recurrence === 'DAILY'
                  ? (() => {
                      const days = details.task.scheduledDays || [0, 1, 2, 3, 4, 5, 6];
                      if (days.length === 7) return 'Every day';
                      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
                      if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return 'Weekends';
                      return `Repeats: ${days.map((d: number) => dayLabels[d]).join(', ')}`;
                    })()
                  : 'One-Time Task'}
              </span>
              {details?.task.dueTime && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Due {details.task.dueTime}
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-zinc-100 tracking-tight">
              {details?.task.title || 'Task Details'}
            </h2>
            {details?.task.description && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{details.task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-dark-border px-6 bg-dark-bg/30 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-flame-500 text-flame-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Streaks & Freezes</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'calendar'
                ? 'border-flame-500 text-flame-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>History & Notes ({details?.completions.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'leaderboard'
                ? 'border-flame-500 text-flame-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Friends Rank ({leaderboard?.leaderboard.length || 0})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <div className="w-6 h-6 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono">Loading task metrics...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center">
              {error}
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & FREEZE STATUS */}
              {activeTab === 'overview' && details && (
                <div className="space-y-6">
                  {/* Streak Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-dark-bg border border-dark-border rounded-xl">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold mb-1">
                        <Flame className="w-3.5 h-3.5 text-flame-500" />
                        <span>Current Streak</span>
                      </div>
                      <div className="text-2xl font-black text-flame-400 font-mono">
                        {details.task.currentStreak || 0}
                        <span className="text-xs text-zinc-500 font-normal ml-1">days</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-dark-bg border border-dark-border rounded-xl">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold mb-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Longest Streak</span>
                      </div>
                      <div className="text-2xl font-black text-zinc-100 font-mono">
                        {details.task.longestStreak || 0}
                        <span className="text-xs text-zinc-500 font-normal ml-1">days</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-dark-bg border border-dark-border rounded-xl">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Completed Days</span>
                      </div>
                      <div className="text-2xl font-black text-zinc-100 font-mono">
                        {details.task.totalCompletedDays || 0}
                        <span className="text-xs text-zinc-500 font-normal ml-1">total</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-dark-bg border border-dark-border rounded-xl">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-semibold mb-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>Today</span>
                      </div>
                      <div
                        className={`text-sm font-bold font-mono mt-1 ${
                          details.task.completedToday ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {details.task.completedToday ? 'Completed ✓' : 'Pending...'}
                      </div>
                    </div>
                  </div>

                  {/* Task Freeze Card */}
                  <div className="p-4 bg-gradient-to-br from-cyan-950/20 to-dark-bg border border-cyan-500/20 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                            Independent Task Freeze
                          </h4>
                          <p className="text-[11px] text-zinc-400">
                            Protects 1 missed day without breaking this task's streak.
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                          (details.task.freezeBalance || 0) > 0
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {(details.task.freezeBalance || 0) > 0 ? '🧊 1 Available' : '0 Available'}
                      </div>
                    </div>

                    {/* Recharge progress bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          <span>Recharge Progress</span>
                        </span>
                        <span>
                          {details.task.freezeBalance === 1
                            ? 'Fully Charged (1/1)'
                            : `${details.task.freezeRechargeDays || 0} of 7 qualifying days`}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-500"
                          style={{
                            width: `${
                              details.task.freezeBalance === 1
                                ? 100
                                : Math.min(100, ((details.task.freezeRechargeDays || 0) / 7) * 100)
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Protected dates notice */}
                    {details.freezeLogs.length > 0 && (
                      <div className="text-[11px] text-cyan-400/90 pt-1 border-t border-cyan-500/10">
                        🛡️ Protected missed dates:{' '}
                        {details.freezeLogs.map((l) => l.protectedDate).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CALENDAR & COMPLETION NOTES */}
              {activeTab === 'calendar' && details && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Study notes visible only to you and accepted friends</span>
                    </span>
                    <span className="font-mono text-[11px]">
                      {details.completions.length} completions recorded
                    </span>
                  </div>

                  {details.completions.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      No completions yet. Tick this task to add your first study note!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {details.completions.map((comp) => {
                        const isEditing = editingDate === comp.completionDate;

                        return (
                          <div
                            key={comp.id}
                            className="p-3 bg-dark-bg border border-dark-border rounded-xl space-y-2 hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-xs font-bold text-zinc-200 font-mono">
                                  {comp.completionDate}
                                </span>
                              </div>

                              {details.task.isOwner && !isEditing && (
                                <button
                                  onClick={() =>
                                    handleStartEditNote(comp.completionDate, comp.studyNote)
                                  }
                                  className="text-[11px] text-zinc-400 hover:text-flame-400 flex items-center gap-1 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>{comp.studyNote ? 'Edit Note' : 'Add Note'}</span>
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  rows={2}
                                  value={editNoteText}
                                  onChange={(e) => setEditNoteText(e.target.value)}
                                  placeholder="What did you study or accomplish on this day?"
                                  className="w-full px-3 py-2 bg-dark-surface border border-flame-500/50 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingDate(null)}
                                    disabled={isSavingNote}
                                    className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 rounded-md"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveNote(comp.completionDate)}
                                    disabled={isSavingNote}
                                    className="px-3 py-1 bg-flame-500 text-zinc-950 font-bold text-[11px] rounded-md hover:bg-flame-600 flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                </div>
                              </div>
                            ) : comp.studyNote ? (
                              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 italic flex items-start gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-flame-400 shrink-0 mt-0.5" />
                                <span>"{comp.studyNote}"</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 italic pl-4">
                                Completed without note
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TASK-SPECIFIC FRIENDS LEADERBOARD */}
              {activeTab === 'leaderboard' && leaderboard && (
                <div className="space-y-6">
                  {/* Suggested Fuzzy Matches (Owner only) */}
                  {leaderboard.suggestedMatches && leaderboard.suggestedMatches.length > 0 && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        <HelpCircle className="w-4 h-4" />
                        <span>Suggested Equivalent Friend Tasks</span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        These friends' tasks look similar to your "{leaderboard.taskTitle}". Confirm
                        to compare streaks together!
                      </p>
                      <div className="space-y-2">
                        {leaderboard.suggestedMatches.map((m) => (
                          <div
                            key={m.taskId}
                            className="p-2.5 bg-dark-bg border border-dark-border rounded-lg flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <InitialsAvatar
                                name={m.user.name}
                                image={m.user.profileImage}
                                size="sm"
                              />
                              <div>
                                <span className="font-semibold text-zinc-200">
                                  @{m.user.username}
                                </span>
                                <span className="text-zinc-400 mx-1.5">•</span>
                                <span className="text-amber-300 italic">"{m.title}"</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleConfirmMatch(m.taskId)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-md transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => handleRejectMatch(m.taskId)}
                                className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 rounded-md"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leaderboard Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-3 uppercase tracking-wider">
                      <span>Friend</span>
                      <div className="flex items-center gap-6">
                        <span>Current</span>
                        <span>Best</span>
                        <span>Today</span>
                      </div>
                    </div>

                    {leaderboard.leaderboard.length === 0 ? (
                      <div className="py-10 text-center text-zinc-500 text-xs">
                        None of your accepted friends have matching tasks yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {leaderboard.leaderboard.map((entry) => (
                          <div
                            key={entry.taskId}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                              entry.isCurrentUser
                                ? 'bg-flame-500/10 border-flame-500/30 text-zinc-100'
                                : 'bg-dark-bg border-dark-border text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 text-center font-mono font-bold text-xs ${
                                  entry.rank === 1
                                    ? 'text-amber-400'
                                    : entry.rank === 2
                                    ? 'text-zinc-300'
                                    : entry.rank === 3
                                    ? 'text-amber-600'
                                    : 'text-zinc-500'
                                }`}
                              >
                                #{entry.rank}
                              </span>
                              <InitialsAvatar
                                name={entry.name}
                                image={entry.profileImage}
                                size="sm"
                              />
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{entry.name}</span>
                                  {entry.isCurrentUser && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-flame-500 text-zinc-950 font-black rounded-full">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono">
                                  "{entry.taskTitle}"
                                </div>
                                {entry.todayStudyNote && (
                                  <div className="text-[11px] text-zinc-400 italic mt-0.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-flame-400" />
                                    <span>{entry.todayStudyNote}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-6 font-mono text-xs">
                              <div className="w-10 text-right font-bold text-flame-400 flex items-center justify-end gap-1">
                                <Flame className="w-3 h-3 fill-flame-500" />
                                <span>{entry.currentStreak}d</span>
                              </div>
                              <div className="w-10 text-right text-zinc-400">
                                {entry.longestStreak}d
                              </div>
                              <div className="w-8 text-right">
                                {entry.completedToday ? (
                                  <span className="text-emerald-400 font-bold">✓</span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
