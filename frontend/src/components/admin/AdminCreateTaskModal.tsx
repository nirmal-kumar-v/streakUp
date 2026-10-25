import React, { useState } from 'react';
import { X, Plus, Layers } from 'lucide-react';
import { adminCreateTaskForUser } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';

interface AdminCreateTaskModalProps {
  userId: string;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
  onRequirePin: (title: string, description: string, action: (pin: string) => Promise<void>) => void;
}

export const AdminCreateTaskModal: React.FC<AdminCreateTaskModalProps> = ({
  userId,
  username,
  onClose,
  onSuccess,
  onRequirePin,
}) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState('MEDIUM');
  const [recurrence, setRecurrence] = useState('DAILY');
  const [dueTime, setDueTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Administrative reason is required.');
      return;
    }

    onRequirePin(
      'Create Task for User',
      `Create task "${title}" on behalf of @${username}?`,
      async (pin) => {
        try {
          setIsSubmitting(true);
          const res = await adminCreateTaskForUser(userId, {
            title: title.trim(),
            description: description.trim() || undefined,
            category: category.trim() || 'General',
            priority,
            recurrence,
            dueTime: dueTime.trim() || undefined,
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
      <div className="bg-dark-card border border-dark-border rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100">
                Create Task on Behalf of @{username}
              </h3>
              <p className="text-xs text-zinc-400">Add a new daily habit or tracking goal.</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read 20 Pages of System Design"
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or guidelines..."
              rows={2}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Learning, Coding, Health"
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKDAYS">WEEKDAYS</option>
                <option value="WEEKENDS">WEEKENDS</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Due Time (HH:mm)</label>
              <input
                type="text"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="21:00"
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Administrative Reason * (Audit Ledger)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Assigned upon user request or contest preparation"
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
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
              className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
