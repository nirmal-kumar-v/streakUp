import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../api/tasks';
import {
  Check,
  Flame,
  Loader2,
  Code2,
  ExternalLink,
} from 'lucide-react';
import { getSpecialGroupMeta } from '../utils/specialGroups';

interface SpecialGroupCardProps {
  groupId: string;
  groupName: string;
  platform?: string | null;
  dailyTask?: Task;
  potdTask?: Task;
  onToggleComplete?: (task: Task) => Promise<void>;
  onViewDetails?: (task: Task) => void;
  processingTaskIds?: Set<string>;
  canTick?: boolean;
}

export const SpecialGroupCard: React.FC<SpecialGroupCardProps> = ({
  groupId,
  groupName,
  platform,
  dailyTask,
  potdTask,
  onToggleComplete,
  onViewDetails,
  processingTaskIds = new Set(),
  canTick = true,
}) => {
  const navigate = useNavigate();
  const isActionLockedRef = useRef(false);

  const meta = getSpecialGroupMeta(platform);
  const isLeetCode = platform === 'LEETCODE';
  const isGFG = platform === 'GEEKSFORGEEKS';

  const isDailyProcessing = dailyTask ? processingTaskIds.has(dailyTask.id) : false;
  const isPotdProcessing = potdTask ? processingTaskIds.has(potdTask.id) : false;

  const handleTaskCheck = (task?: Task) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!task || !onToggleComplete || !canTick || isActionLockedRef.current) {
      return;
    }
    const isProcessing = processingTaskIds.has(task.id);
    if (isProcessing) return;

    onToggleComplete(task);
  };

  const platformBadgeStyle = isLeetCode
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : isGFG
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : 'bg-flame-500/10 text-flame-400 border-flame-500/30';

  const cardBorderStyle =
    dailyTask?.completedToday && (potdTask ? potdTask.completedToday : true)
      ? 'border-emerald-500/30 bg-dark-card/90'
      : 'border-dark-border hover:border-zinc-700 shadow-panel bg-dark-card';

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden ${cardBorderStyle}`}
    >
      {/* Top Banner: Group Name & Platform Badge */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-dark-surface/60 border-b border-dark-border/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${platformBadgeStyle}`}
          >
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}`)}
              className="text-xs sm:text-sm font-bold text-zinc-100 hover:text-flame-400 truncate text-left block transition-colors group-hover:text-zinc-50"
            >
              {groupName}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${platformBadgeStyle}`}
          >
            {meta?.name || 'Special Group'}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/groups/${groupId}`)}
            title="View group details"
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-dark-hover transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Activities Grid / Rows */}
      <div className="p-3.5 sm:p-4 space-y-2.5">
        {/* Activity 1: Daily Practice */}
        {dailyTask && (
          <div
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
              dailyTask.completedToday
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-dark-surface/50 border-dark-border hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Checkbox Tick */}
              <button
                type="button"
                onClick={handleTaskCheck(dailyTask)}
                disabled={isDailyProcessing}
                aria-label={dailyTask.completedToday ? 'Daily practice completed' : 'Mark daily practice complete'}
                className={`flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border transition-all duration-150 ${
                  isDailyProcessing
                    ? 'opacity-60 cursor-not-allowed pointer-events-none'
                    : 'active:scale-90 cursor-pointer'
                } ${
                  dailyTask.completedToday
                    ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                    : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent'
                }`}
              >
                {isDailyProcessing ? (
                  <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
                ) : (
                  <Check
                    className={`w-4 h-4 stroke-[3] transition-transform duration-150 ${
                      dailyTask.completedToday ? 'scale-100' : 'scale-50'
                    }`}
                  />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    onClick={() => onViewDetails?.(dailyTask)}
                    className={`text-xs sm:text-sm font-semibold truncate cursor-pointer hover:text-flame-400 ${
                      dailyTask.completedToday
                        ? 'text-zinc-400 line-through'
                        : 'text-zinc-200'
                    }`}
                  >
                    {dailyTask.title}
                  </span>
                </div>
                {dailyTask.todayStudyNote && (
                  <p className="text-[11px] text-zinc-400 italic line-clamp-1 mt-0.5">
                    "{dailyTask.todayStudyNote}"
                  </p>
                )}
              </div>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <span
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border transition-colors ${
                  (dailyTask.currentStreak ?? 0) > 0
                    ? 'text-flame-400 bg-flame-500/10 border-flame-500/20'
                    : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40'
                }`}
              >
                <Flame
                  className={`w-3.5 h-3.5 ${
                    (dailyTask.currentStreak ?? 0) > 0
                      ? 'fill-flame-500 text-flame-500'
                      : 'text-zinc-500'
                  }`}
                />
                <span>{dailyTask.currentStreak ?? 0}d</span>
              </span>
            </div>
          </div>
        )}

        {/* Activity 2: POTD (Problem of the Day) - Only when committed */}
        {potdTask && (
          <div
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
              potdTask.completedToday
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-dark-surface/50 border-dark-border hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Checkbox Tick */}
              <button
                type="button"
                onClick={handleTaskCheck(potdTask)}
                disabled={isPotdProcessing}
                aria-label={potdTask.completedToday ? 'POTD completed' : 'Mark POTD complete'}
                className={`flex-shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border transition-all duration-150 ${
                  isPotdProcessing
                    ? 'opacity-60 cursor-not-allowed pointer-events-none'
                    : 'active:scale-90 cursor-pointer'
                } ${
                  potdTask.completedToday
                    ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                    : 'border-zinc-600 hover:border-amber-400 hover:bg-amber-500/10 text-transparent'
                }`}
              >
                {isPotdProcessing ? (
                  <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
                ) : (
                  <Check
                    className={`w-4 h-4 stroke-[3] transition-transform duration-150 ${
                      potdTask.completedToday ? 'scale-100' : 'scale-50'
                    }`}
                  />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    onClick={() => onViewDetails?.(potdTask)}
                    className={`text-xs sm:text-sm font-semibold truncate cursor-pointer hover:text-amber-400 ${
                      potdTask.completedToday
                        ? 'text-zinc-400 line-through'
                        : 'text-zinc-200'
                    }`}
                  >
                    {potdTask.title}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Completing POTD auto-completes Daily practice
                </p>
                {potdTask.todayStudyNote && (
                  <p className="text-[11px] text-zinc-400 italic line-clamp-1 mt-0.5">
                    "{potdTask.todayStudyNote}"
                  </p>
                )}
              </div>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <span
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border transition-colors ${
                  (potdTask.currentStreak ?? 0) > 0
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40'
                }`}
              >
                <Flame
                  className={`w-3.5 h-3.5 ${
                    (potdTask.currentStreak ?? 0) > 0
                      ? 'fill-amber-500 text-amber-500'
                      : 'text-zinc-500'
                  }`}
                />
                <span>{potdTask.currentStreak ?? 0}d</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
