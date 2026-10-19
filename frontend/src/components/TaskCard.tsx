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
  Sparkles,
  Flame,
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
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onArchiveToggle,
  onDelete,
  onViewDetails,
  canTick = true,
}) => {
  const navigate = useNavigate();
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isLinkedIn = Boolean(task.isLinkedIn || (task.isGroupTask && isLinkedInName(task.title)));

  const handleLinkedInNavigate = () => {
    if (task.groupId) {
      navigate(`/groups/${task.groupId}?tab=games`);
    } else {
      navigate('/groups');
    }
  };

  const handleCheck = async () => {
    if (isToggling || !onToggleComplete || !canTick) return;
    setIsToggling(true);
    try {
      await onToggleComplete(task);
    } finally {
      setIsToggling(false);
    }
  };

  const getScheduleLabel = (days?: number[]) => {
    if (!days || days.length === 0 || days.length === 7) return 'Every day';
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
        task.completedToday
          ? 'border-emerald-500/30 bg-emerald-950/10 shadow-sm'
          : 'border-dark-border hover:border-zinc-700 shadow-panel'
      }`}
    >
      <div className="flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Completion Checkbox / Tick Button OR Schedule Icon if non-today */}
          {canTick && onToggleComplete ? (
            <button
              onClick={handleCheck}
              disabled={isToggling}
              aria-label={task.completedToday ? 'Mark task as incomplete' : 'Mark task as complete'}
              className={`flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border transition-all duration-200 ${
                task.completedToday
                  ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/20'
                  : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent'
              } ${isToggling ? 'opacity-50 scale-95' : 'hover:scale-105 active:scale-95'}`}
            >
              <Check className={`w-4 h-4 stroke-[3] transition-transform ${task.completedToday ? 'scale-100' : 'scale-50'}`} />
            </button>
          ) : (
            <div
              title={`Scheduled for ${getScheduleLabel(task.scheduledDays)}`}
              className="flex-shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center border border-dark-border bg-dark-surface/80 text-zinc-500"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          )}

          {/* Task Name & Streak Only (Clicking name or card opens LinkedIn games hub / task details) */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h3
              onClick={() => {
                if (isLinkedIn) {
                  handleLinkedInNavigate();
                } else if (onViewDetails) {
                  onViewDetails(task);
                }
              }}
              title={isLinkedIn ? 'Click to open LinkedIn Games Hub' : 'Click to view details & streak calendar'}
              className={`text-sm sm:text-base font-semibold tracking-tight transition-colors truncate cursor-pointer hover:text-flame-400 ${
                task.completedToday ? 'text-zinc-400 line-through' : 'text-zinc-100'
              }`}
            >
              {task.title}
            </h3>

            {/* Task Streak Badge (Highest streak among committed games for LinkedIn task) */}
            {task.recurrence === 'DAILY' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-flame-400 bg-flame-500/10 px-2 py-0.5 rounded-full border border-flame-500/20 shrink-0">
                <Flame className="w-3 h-3 fill-flame-500" />
                <span>{task.currentStreak || 0}d</span>
              </span>
            )}

            {/* For other scheduled days (when canTick is false), show schedule label */}
            {!canTick && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-dark-surface px-2 py-0.5 rounded-md border border-dark-border shrink-0">
                <Repeat className="w-3 h-3 text-flame-400" />
                <span>{getScheduleLabel(task.scheduledDays)}</span>
              </span>
            )}

            {task.completedToday && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                <Sparkles className="w-3 h-3" /> Done
              </span>
            )}
          </div>
        </div>


        {/* Action Buttons: Edit, Archive, Delete */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 opacity-90 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            aria-label="Edit task"
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onArchiveToggle(task)}
            title={task.status === 'ACTIVE' ? 'Archive task' : 'Restore task'}
            aria-label={task.status === 'ACTIVE' ? 'Archive task' : 'Restore task'}
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Archive className="w-3.5 h-3.5" />
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
