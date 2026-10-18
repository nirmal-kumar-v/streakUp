import React, { useState } from 'react';
import { Task } from '../api/tasks';
import { CheckCircle2, Lock, X, Sparkles, Flame } from 'lucide-react';

interface TaskCompletionModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (studyNote: string) => Promise<void>;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  task,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [studyNote, setStudyNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const trimmed = studyNote.trim();
  const isValid = trimmed.length >= 3;

  const handleComplete = async () => {
    if (!isValid) {
      setError('Please provide a meaningful study note (at least 3 characters).');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onComplete(trimmed);
      setStudyNote('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to complete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setStudyNote('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-2xl shadow-zinc-950/50 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-flame-500/15 border border-flame-500/30 flex items-center justify-center text-flame-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Complete Habit</span>
                {task.currentStreak !== undefined && task.currentStreak > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-flame-500/10 text-flame-400 border border-flame-500/20">
                    <Flame className="w-3 h-3 fill-flame-500" />
                    <span>{task.currentStreak}d</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{task.title}</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-dark-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Study Note Textarea */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-flame-400" />
              <span>What did you study or accomplish today? <span className="text-flame-400 font-bold">*</span></span>
            </span>
            <span className={`text-[11px] font-mono ${studyNote.length > 450 ? 'text-amber-400' : 'text-zinc-500'}`}>
              {studyNote.length}/500
            </span>
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={studyNote}
            onChange={(e) => {
              setStudyNote(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Practiced 10 dynamic programming problems in Java..."
            className="w-full px-3.5 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500 focus:ring-1 focus:ring-flame-500/50 resize-none transition-all"
            autoFocus
          />
          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}
          {!error && trimmed.length > 0 && trimmed.length < 3 && (
            <p className="text-xs text-amber-400">Please enter at least 3 characters.</p>
          )}
        </div>

        {/* Visibility Notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400">
          <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>
            Study notes are private and visible only to <strong className="text-zinc-200">you and your accepted friends</strong>.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-dark-border">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting || !isValid}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
              isValid && !isSubmitting
                ? 'bg-flame-500 hover:bg-flame-600 text-zinc-950 shadow-flame-500/20 active:scale-95 cursor-pointer'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
            }`}
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>
              Save Note & Complete {task?.groupId || task?.isGroupTask ? '' : '(+5 pts)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
