import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { adminUncompleteTask } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';

interface AdminUncompleteTaskModalProps {
  userId: string;
  username: string;
  task: { id: string; title: string };
  onClose: () => void;
  onSuccess: () => void;
  onRequirePin: (title: string, description: string, action: (pin: string) => Promise<void>) => void;
}

export const AdminUncompleteTaskModal: React.FC<AdminUncompleteTaskModalProps> = ({
  userId,
  username,
  task,
  onClose,
  onSuccess,
  onRequirePin,
}) => {
  const toast = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Valid date in YYYY-MM-DD format is required.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Administrative reason is required.');
      return;
    }

    onRequirePin(
      'Uncomplete Task',
      `Remove completion for "${task.title}" on ${date} for @${username}? This deducts 5 points and recalculates streaks.`,
      async (pin) => {
        try {
          setIsSubmitting(true);
          const res = await adminUncompleteTask(userId, task.id, {
            date,
            reason: reason.trim(),
            sensitivePin: pin,
          });
          if (res.success) {
            toast.success(res.message);
            onSuccess();
            onClose();
          }
        } catch (err) {
          toast.error(extractErrorMessage(err));
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100">
                Uncomplete Task for Date
              </h3>
              <p className="text-xs text-zinc-400">Task: {task.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            Removing this checkmark will deduct <strong>5 points</strong> from @{username}'s balance
            and recalculate their consecutive task and overall streaks automatically.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Completion Date (YYYY-MM-DD) *</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Administrative Reason * (Logged in Audit Ledger)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Accidental click / dispute resolution"
              rows={2}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-zinc-300 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Uncomplete (-5 pts)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
