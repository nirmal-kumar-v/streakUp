import React, { useState } from 'react';
import { Task } from '../api/tasks';
import { Link } from 'react-router-dom';
import {
  Check,
  Clock,
  Calendar,
  Edit2,
  Archive,
  Trash2,
  Repeat,
  Sparkles,
  Flame,
  Shield,
  Zap,
  Info,
  Users,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onArchiveToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onViewDetails?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onArchiveToggle,
  onDelete,
  onViewDetails,
}) => {
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleCheck = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggleComplete(task);
    } finally {
      setIsToggling(false);
    }
  };

  const priorityColors = {
    HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    MEDIUM: 'bg-flame-500/10 text-flame-400 border-flame-500/20',
    LOW: 'bg-zinc-800 text-zinc-400 border-zinc-700/50',
  }[task.priority];

  return (
    <div
      className={`group relative bg-dark-card border rounded-2xl p-4 transition-all duration-200 ${
        task.completedToday
          ? 'border-emerald-500/30 bg-emerald-950/10 shadow-sm'
          : 'border-dark-border hover:border-zinc-700 shadow-panel'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Completion Checkbox / Tick Button */}
        <button
          onClick={handleCheck}
          disabled={isToggling}
          aria-label={task.completedToday ? 'Mark task as incomplete' : 'Mark task as complete'}
          className={`flex-shrink-0 mt-0.5 w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center border transition-all duration-200 ${
            task.completedToday
              ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/20'
              : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent'
          } ${isToggling ? 'opacity-50 scale-95' : 'hover:scale-105 active:scale-95'}`}
        >
          <Check className={`w-4 h-4 stroke-[3] transition-transform ${task.completedToday ? 'scale-100' : 'scale-50'}`} />
        </button>

        {/* Task Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3
              onClick={() => onViewDetails && onViewDetails(task)}
              className={`text-base font-semibold tracking-tight transition-all truncate cursor-pointer hover:text-flame-400 ${
                task.completedToday ? 'text-zinc-400 line-through' : 'text-zinc-100'
              }`}
            >
              {task.title}
            </h3>

            {/* Group Task Badge */}
            {(task.isGroupTask || task.groupId) && (
              <Link
                to={task.groupId ? `/groups/${task.groupId}` : '/groups'}
                title="View Group details & leaderboard"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25 hover:bg-indigo-500/20 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Users className="w-3 h-3 text-indigo-400" />
                <span>Group Task</span>
              </Link>
            )}

            {/* Independent Task Streak Badge */}
            {task.recurrence === 'DAILY' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-flame-400 bg-flame-500/10 px-2 py-0.5 rounded-full border border-flame-500/20">
                <Flame className="w-3 h-3 fill-flame-500" />
                <span>{task.currentStreak || 0}d</span>
              </span>
            )}

            {/* Independent Freeze Status Badge */}
            {task.recurrence === 'DAILY' && (
              <span
                title={
                  (task.freezeBalance || 0) > 0
                    ? '1 Task Freeze Available'
                    : `Recharge: ${task.freezeRechargeDays || 0}/7 qualifying days`
                }
                className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  (task.freezeBalance || 0) > 0
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {(task.freezeBalance || 0) > 0 ? (
                  <>
                    <Shield className="w-3 h-3 text-cyan-400" /> 1
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-zinc-500" /> {task.freezeRechargeDays || 0}/7
                  </>
                )}
              </span>
            )}

            {task.completedToday && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> Done Today
              </span>
            )}
          </div>

          {task.description && (
            <p className={`text-xs mt-1 leading-relaxed ${task.completedToday ? 'text-zinc-500' : 'text-dark-muted'}`}>
              {task.description}
            </p>
          )}

          {/* Today's Study Note Preview */}
          {task.todayStudyNote && (
            <div className="mt-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 italic flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-flame-400 shrink-0" />
              <span className="line-clamp-1">"{task.todayStudyNote}"</span>
            </div>
          )}

          {/* Metadata Badges */}
          <div className="flex items-center gap-2 flex-wrap mt-3 text-xs">
            {/* Category */}
            <span className="bg-dark-surface text-zinc-300 px-2 py-0.5 rounded-md border border-dark-border text-[11px] font-medium">
              {task.category}
            </span>

            {/* Priority */}
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium uppercase tracking-wider ${priorityColors}`}>
              {task.priority}
            </span>

            {/* Recurrence & Schedule */}
            <span className="inline-flex items-center gap-1 bg-dark-surface text-zinc-400 px-2 py-0.5 rounded-md border border-dark-border text-[11px]">
              {task.recurrence === 'DAILY' ? (
                <>
                  <Repeat className="w-3 h-3 text-flame-400" />
                  <span>
                    {(() => {
                      const days = task.scheduledDays || [0, 1, 2, 3, 4, 5, 6];
                      if (days.length === 7) return 'Every day';
                      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d));
                      if (isWeekdays) return 'Weekdays';
                      const isWeekends = days.length === 2 && [0, 6].every((d) => days.includes(d));
                      if (isWeekends) return 'Weekends';
                      return days.map((d) => dayLabels[d]).join(', ');
                    })()}
                  </span>
                </>
              ) : (
                <>
                  <Calendar className="w-3 h-3 text-zinc-400" /> One-time
                </>
              )}
            </span>

            {/* Rest Day / Unscheduled Indicator */}
            {task.recurrence === 'DAILY' && !task.completedToday && task.scheduledDays && !task.scheduledDays.includes(new Date().getDay()) && (
              <span className="bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700/60 text-[10px]">
                Rest Day
              </span>
            )}

            {/* Due Time */}
            {task.dueTime && (
              <span className="inline-flex items-center gap-1 bg-dark-surface text-zinc-300 px-2 py-0.5 rounded-md border border-dark-border text-[11px] font-mono">
                <Clock className="w-3 h-3 text-amber-400" />
                {task.dueTime}
              </span>
            )}

            {task.status === 'ARCHIVED' && (
              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 text-[11px]">
                Archived
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 opacity-90 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(task)}
              title="View task details & history"
              className="p-2 sm:p-1.5 text-zinc-400 hover:text-flame-400 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onArchiveToggle(task)}
            title={task.status === 'ACTIVE' ? 'Archive task' : 'Restore task'}
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            title="Delete task"
            className="p-2 sm:p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-dark-hover rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
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
