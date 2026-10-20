import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../api/tasks';
import {
  Check,
  Calendar,
  Edit2,
  Archive,
  Trash2,
  Repeat,
  Flame,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { isLinkedInName } from '../utils/linkedin';

interface TaskCardProps {
  task: Task;
  onToggleComplete?: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onArchiveToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onViewDetails?: (task: Task) => void;
  canTick?: boolean;
  isProcessing?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onArchiveToggle,
  onDelete,
  onViewDetails,
  canTick = true,
  isProcessing = false,
}) => {
  const navigate = useNavigate();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isLinkedIn = Boolean(task.isLinkedIn || (task.isGroupTask && isLinkedInName(task.title)));
  const isArchived = task.status === 'ARCHIVED';

  const handleLinkedInNavigate = () => {
    if (task.groupId) {
      navigate(`/groups/${task.groupId}?tab=games`);
    } else {
      navigate('/groups');
    }
  };

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleComplete || !canTick || isArchived || isProcessing) return;
    onToggleComplete(task);
  };

  const getScheduleLabel = (days?: number[]) => {
    if (!days || days.length === 0 || days.length === 7) return 'Daily';
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d));
    if (isWeekdays) return 'Weekdays';
    const isWeekends = days.length === 2 && [0, 6].every((d) => days.includes(d));
    if (isWeekends) return 'Weekends';
    return days.map((d) => dayLabels[d]).join(', ');
  };

  return (
    <div
      className={`group relative bg-dark-card border rounded-2xl p-4 transition-all duration-200 ${
        isArchived
          ? 'border-zinc-800 bg-dark-surface/30 opacity-90'
          : task.completedToday
          ? 'border-dark-border/60 bg-dark-surface/40 shadow-none'
          : 'border-dark-border hover:border-zinc-700 shadow-panel'
      }`}
    >
      <div className="flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Completion Checkbox / Tick Button OR Schedule Icon if non-today/archived */}
          {!isArchived && canTick && onToggleComplete ? (
            <button
              onClick={handleCheck}
              disabled={isProcessing}
              type="button"
              aria-label={task.completedToday ? 'Mark incomplete' : 'Mark complete'}
              className={`flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border transition-all duration-150 ${
                isProcessing
                  ? 'opacity-60 cursor-not-allowed pointer-events-none'
                  : 'active:scale-90'
              } ${
                task.completedToday
                  ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                  : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
              ) : (
                <Check className={`w-4 h-4 stroke-[3] transition-transform duration-150 ${task.completedToday ? 'scale-100' : 'scale-50'}`} />
              )}
            </button>
          ) : isArchived ? (
            <div
              title="Archived habit"
              className="flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400"
            >
              <Archive className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              title={`Scheduled for ${getScheduleLabel(task.scheduledDays)}`}
              className="flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border border-dark-border bg-dark-surface/80 text-zinc-500"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          )}

          {/* Task Name & Streak Only */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h3
              onClick={() => {
                if (isLinkedIn) {
                  handleLinkedInNavigate();
                } else if (onViewDetails) {
                  onViewDetails(task);
                }
              }}
              title={isLinkedIn ? 'Click to open LinkedIn Games Hub' : 'Click to view details'}
              className={`text-sm sm:text-base font-semibold tracking-tight transition-colors truncate cursor-pointer hover:text-flame-400 ${
                isArchived
                  ? 'text-zinc-300'
                  : task.completedToday
                  ? 'text-zinc-400 line-through'
                  : 'text-zinc-100'
              }`}
            >
              {task.title}
            </h3>

            {/* Archived badge */}
            {isArchived && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25 shrink-0">
                <Archive className="w-2.5 h-2.5" />
                <span>Archived</span>
              </span>
            )}

            {/* Task Streak Badge */}
            {task.recurrence === 'DAILY' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-flame-400 bg-flame-500/10 px-2 py-0.5 rounded-full border border-flame-500/20 shrink-0">
                <Flame className="w-3 h-3 fill-flame-500" />
                <span>{task.currentStreak || 0}d</span>
              </span>
            )}

            {/* Non-today schedule badge */}
            {!isArchived && !canTick && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-dark-surface px-2 py-0.5 rounded-md border border-dark-border shrink-0">
                <Repeat className="w-3 h-3 text-flame-400" />
                <span>{getScheduleLabel(task.scheduledDays)}</span>
              </span>
            )}
          </div>
        </div>


        {/* Action Buttons: Edit, Archive/Restore, Delete */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 opacity-90 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
          {!isArchived && (
            <button
              onClick={() => onEdit(task)}
              title="Edit task"
              aria-label="Edit task"
              className="p-2 sm:p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onArchiveToggle(task)}
            title={isArchived ? 'Restore habit to active checklist' : 'Archive habit'}
            aria-label={isArchived ? 'Restore habit to active checklist' : 'Archive habit'}
            className={`p-2 sm:p-1.5 rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
              isArchived
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15'
                : 'text-zinc-400 hover:text-amber-400 hover:bg-dark-hover'
            }`}
          >
            {isArchived ? (
              <RotateCcw className="w-3.5 h-3.5" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setShowConfirmDelete(true)}
            title="Delete task"
            aria-label="Delete task"
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* In-App Delete Confirmation */}
      {showConfirmDelete && (
        <div className="mt-3 pt-3 border-t border-dark-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-dark-surface/60 -mx-4 -mb-4 p-3 rounded-b-2xl">
          <span className="text-xs text-rose-300 font-medium">Delete this task and all its history?</span>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-xs px-3 py-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-dark-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDelete(task);
                setShowConfirmDelete(false);
              }}
              className="text-xs px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg shadow-sm"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
