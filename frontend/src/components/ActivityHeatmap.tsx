import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  Calendar,
  CheckCircle2,
  Flame,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActivityTaskInfo, fetchActivityHistory, ActivityHistoryResponse } from '../api/tasks';

interface ActivityHeatmapProps {
  timezone?: string;
  currentStreak?: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  timezone = 'Asia/Kolkata',
  currentStreak,
}) => {
  const { user } = useAuth();
  const streak = currentStreak !== undefined ? currentStreak : (user?.currentStreak || 0);

  // Current date in authoritative user timezone
  const todayDt = useMemo(() => {
    return DateTime.now().setZone(timezone).startOf('day');
  }, [timezone]);

  // Rolling 365 consecutive calendar days ending today
  const startDate = useMemo(() => todayDt.minus({ days: 364 }), [todayDt]);
  const endDate = todayDt;

  const [activityMap, setActivityMap] = useState<Map<string, { count: number; tasks: ActivityTaskInfo[] }>>(new Map());
  const [activeDaysCount, setActiveDaysCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Client-side in-memory cache
  const cacheRef = useRef<Map<string, ActivityHistoryResponse>>(new Map());

  // Selected date details modal
  const [selectedDateDetail, setSelectedDateDetail] = useState<{
    dateStr: string;
    formattedDate: string;
    count: number;
    tasks: ActivityTaskInfo[];
  } | null>(null);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDateDetail) {
        setSelectedDateDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDateDetail]);

  const applyResponse = (res: ActivityHistoryResponse) => {
    const map = new Map<string, { count: number; tasks: ActivityTaskInfo[] }>();
    res.activity.forEach((item) => {
      map.set(item.date, {
        count: item.count,
        tasks: item.tasks || [],
      });
    });
    setActivityMap(map);
    setActiveDaysCount(res.activeDaysCount || 0);
  };

  // Fetch 365-day rolling activity data
  const loadActivityData = useCallback(async () => {
    const cacheKey = `rolling_${startDate.toFormat('yyyy-MM-dd')}_${endDate.toFormat('yyyy-MM-dd')}`;

    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)!;
      applyResponse(cached);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await fetchActivityHistory({
        startDate: startDate.toFormat('yyyy-MM-dd'),
        endDate: endDate.toFormat('yyyy-MM-dd'),
      });

      if (res && res.success) {
        cacheRef.current.set(cacheKey, res);
        applyResponse(res);
      } else {
        setError('Failed to load activity history.');
      }
    } catch (err: any) {
      setError('Unable to load heatmap. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadActivityData();
  }, [loadActivityData]);

  // Construct calendar grid: columns = weeks (Sun..Sat), aligned to first Sunday
  const firstGridSunday = startDate.minus({ days: startDate.weekday % 7 });
  const daysDiff = Math.ceil(endDate.diff(firstGridSunday, 'days').days) + 1;
  const totalWeeks = Math.ceil(daysDiff / 7);

  const weeks: Array<Array<{
    dateStr: string;
    isInRange: boolean;
    isFuture: boolean;
    dayOfWeek: number;
    count: number;
    tasks: ActivityTaskInfo[];
    formattedDate: string;
  }>> = [];

  // Month labels mapped to exact week column index
  const monthLabels: Array<{ monthName: string; weekIndex: number }> = [];
  let lastMonth = -1;

  for (let w = 0; w < totalWeeks; w++) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      const curDt = firstGridSunday.plus({ days: w * 7 + d });
      const dateStr = curDt.toFormat('yyyy-MM-dd');
      const isInRange = curDt >= startDate && curDt <= endDate;
      const isFuture = curDt > todayDt;
      const data = !isFuture && isInRange ? (activityMap.get(dateStr) || { count: 0, tasks: [] }) : { count: 0, tasks: [] };

      // Track month transitions for accurate column alignment
      if (isInRange && curDt.month !== lastMonth && d === 0) {
        monthLabels.push({
          monthName: curDt.toFormat('LLL'),
          weekIndex: w,
        });
        lastMonth = curDt.month;
      }

      weekDays.push({
        dateStr,
        isInRange,
        isFuture,
        dayOfWeek: curDt.weekday % 7,
        count: isFuture ? 0 : data.count,
        tasks: isFuture ? [] : data.tasks,
        formattedDate: curDt.toFormat('cccc, MMMM d, yyyy'),
      });
    }
    weeks.push(weekDays);
  }

  // Intensity color function (GitHub emerald aesthetic tailored for StreakUp dark theme)
  const getCellColor = (count: number, isInRange: boolean, isFuture: boolean) => {
    if (!isInRange) return 'bg-transparent border-transparent opacity-0 pointer-events-none';
    if (isFuture) return 'bg-dark-surface/30 border-dark-border/20 cursor-not-allowed opacity-40';
    if (count === 0) return 'bg-dark-surface/70 border-dark-border/60 hover:border-zinc-400 cursor-pointer';
    if (count === 1) return 'bg-emerald-950 border-emerald-800 text-emerald-200 hover:border-emerald-500 cursor-pointer';
    if (count === 2) return 'bg-emerald-800 border-emerald-600 text-emerald-100 hover:border-emerald-400 shadow-sm shadow-emerald-700/20 cursor-pointer';
    if (count >= 3 && count <= 4) return 'bg-emerald-600 border-emerald-400 text-emerald-50 hover:border-emerald-300 shadow-sm shadow-emerald-500/30 cursor-pointer';
    return 'bg-emerald-400 border-emerald-300 text-zinc-950 font-bold hover:scale-125 shadow-md shadow-emerald-400/40 ring-1 ring-emerald-400/50 cursor-pointer';
  };

  const handleCellClick = (day: {
    dateStr: string;
    isInRange: boolean;
    isFuture: boolean;
    count: number;
    tasks: ActivityTaskInfo[];
    formattedDate: string;
  }) => {
    if (!day.isInRange || day.isFuture) return;
    setSelectedDateDetail({
      dateStr: day.dateStr,
      formattedDate: day.formattedDate,
      count: day.count,
      tasks: day.tasks,
    });
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel my-6 space-y-4">
      {/* Heatmap Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              Activity Heatmap
            </h3>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-flame-400 font-semibold">
            <Flame className="w-3.5 h-3.5 fill-flame-500 text-flame-500 shrink-0" />
            <span>
              <strong>{streak}</strong> {streak === 1 ? 'day streak' : 'days streak'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>{activeDaysCount}</strong> working {activeDaysCount === 1 ? 'day' : 'days'} in past 365 days
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadActivityData()}
            className="text-xs text-rose-200 underline hover:no-underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Heatmap Grid Area */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading activity history...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="inline-block min-w-full">
            {/* Month labels aligned with week columns */}
            <div className="flex mb-1 pl-7 text-[10px] font-mono text-zinc-400 select-none">
              {weeks.map((_, wIdx) => {
                const label = monthLabels.find((m) => m.weekIndex === wIdx);
                return (
                  <div
                    key={wIdx}
                    className="w-3 sm:w-3.5 mr-1 text-left shrink-0 overflow-visible whitespace-nowrap"
                  >
                    {label ? label.monthName : ''}
                  </div>
                );
              })}
            </div>

            {/* Main grid with day labels on left */}
            <div className="flex items-start gap-1.5">
              {/* Day of week labels (Sun..Sat) */}
              <div className="flex flex-col gap-1 pt-0.5 text-[9px] font-mono text-zinc-500 shrink-0 select-none">
                <span className="h-3 sm:h-3.5 leading-3">Sun</span>
                <span className="h-3 sm:h-3.5 leading-3 opacity-0">Mon</span>
                <span className="h-3 sm:h-3.5 leading-3">Tue</span>
                <span className="h-3 sm:h-3.5 leading-3 opacity-0">Wed</span>
                <span className="h-3 sm:h-3.5 leading-3">Thu</span>
                <span className="h-3 sm:h-3.5 leading-3 opacity-0">Fri</span>
                <span className="h-3 sm:h-3.5 leading-3">Sat</span>
              </div>

              {/* 52-53 Columns of 7 Days */}
              <div className="inline-grid grid-rows-7 grid-flow-col gap-1">
                {weeks.map((week) =>
                  week.map((day) => (
                    <div
                      key={day.dateStr}
                      onClick={() => handleCellClick(day)}
                      title={
                        day.isFuture
                          ? `${day.formattedDate}: Future date`
                          : `${day.formattedDate}: ${day.count} habit${day.count === 1 ? '' : 's'} completed`
                      }
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border transition-all duration-100 ${getCellColor(
                        day.count,
                        day.isInRange,
                        day.isFuture
                      )}`}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend & Summary Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-dark-muted pt-3 border-t border-dark-border/60 gap-2">
        <div className="flex items-center gap-2">
          <span>Click any square to view habits & study notes</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[10px]">Less</span>
          <div className="w-3 h-3 rounded-sm bg-dark-surface/70 border border-dark-border/60" title="0 completions" />
          <div className="w-3 h-3 rounded-sm bg-emerald-950 border border-emerald-800" title="1 completion" />
          <div className="w-3 h-3 rounded-sm bg-emerald-800 border border-emerald-600" title="2 completions" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-400" title="3-4 completions" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-300" title="5+ completions" />
          <span className="text-[10px]">More</span>
        </div>
      </div>

      {/* Date Detail Modal on Click */}
      {selectedDateDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="heatmap-date-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedDateDetail(null)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="heatmap-date-title" className="text-sm font-bold text-zinc-100">
                    {selectedDateDetail.formattedDate}
                  </h4>
                  <p className="text-xs text-dark-muted font-mono">
                    {selectedDateDetail.count} habit{selectedDateDetail.count === 1 ? '' : 's'} completed (+{selectedDateDetail.count * 5} pts)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDateDetail(null)}
                aria-label="Close dialog"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-dark-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDateDetail.tasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-dark-muted">
                No habit completions recorded on this date.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {selectedDateDetail.tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-dark-surface border border-dark-border rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-100">{task.title}</span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        +5 pts
                      </span>
                    </div>
                    {task.note ? (
                      <p className="text-xs text-zinc-300 italic bg-dark-bg/60 p-2.5 rounded-lg border border-dark-border/40 font-mono">
                        "{task.note}"
                      </p>
                    ) : (
                      <p className="text-[11px] text-dark-muted italic">Completed without study note</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setSelectedDateDetail(null)}
              className="w-full py-2 bg-dark-surface hover:bg-dark-hover active:scale-95 text-zinc-200 text-xs font-bold rounded-xl border border-dark-border transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
