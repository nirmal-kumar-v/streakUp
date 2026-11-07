import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  Calendar,
  CheckCircle2,
  Flame,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActivityTaskInfo, fetchActivityHistory, ActivityHistoryResponse } from '../api/tasks';
import { useBodyScrollLock } from '../utils/scrollLock';
import { getPersistentData, setPersistentData } from '../utils/persistentCache';
import { openStreakMilestoneModal } from '../utils/streakMilestones';

interface ActivityHeatmapProps {
  timezone?: string;
  currentStreak?: number;
  todayTasks?: Array<{ title: string; completedToday?: boolean; todayStudyNote?: string | null }>;
}

interface CalendarGridCell {
  dateStr: string;
  isInRange: boolean;
  isFuture: boolean;
  dayOfWeek: number;
  formattedDate: string;
}

// Module-level in-memory RAM cache:
// Survives component unmount/remount when navigating between Dashboard, Leaderboard, Tasks, etc.
// Guarantees strictly 0.000 ms zero-latency rendering upon page returns!
interface GlobalHeatmapMemory {
  cacheKey: string;
  activityMap: Map<string, { count: number; tasks: ActivityTaskInfo[] }>;
  freezeMap: Map<string, string>;
  activeDaysCount: number;
}

let globalMemoryHeatmap: GlobalHeatmapMemory | null = null;

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  timezone = 'Asia/Kolkata',
  currentStreak,
  todayTasks,
}) => {
  const { user } = useAuth();
  const streak = currentStreak !== undefined ? currentStreak : (user?.currentStreak || 0);

  // Current date in authoritative user timezone
  const todayDt = useMemo(() => {
    return DateTime.now().setZone(timezone).startOf('day');
  }, [timezone]);

  const todayStr = useMemo(() => todayDt.toFormat('yyyy-MM-dd'), [todayDt]);

  // Rolling 365 consecutive calendar days ending today
  const startDate = useMemo(() => todayDt.minus({ days: 364 }), [todayDt]);
  const endDate = todayDt;

  const cacheKey = useMemo(
    () => `heatmap_${startDate.toFormat('yyyy-MM-dd')}_${endDate.toFormat('yyyy-MM-dd')}`,
    [startDate, endDate]
  );

  // Initialize state directly from fast RAM cache first, fallback to persistentCache
  const initialCache = useMemo(() => {
    if (globalMemoryHeatmap && globalMemoryHeatmap.cacheKey === cacheKey) {
      return null; // RAM cache has priority
    }
    return getPersistentData<ActivityHistoryResponse>(cacheKey);
  }, [cacheKey]);

  const [activityMap, setActivityMap] = useState<Map<string, { count: number; tasks: ActivityTaskInfo[] }>>(() => {
    if (globalMemoryHeatmap && globalMemoryHeatmap.cacheKey === cacheKey) {
      return globalMemoryHeatmap.activityMap;
    }
    const map = new Map<string, { count: number; tasks: ActivityTaskInfo[] }>();
    if (initialCache?.activity) {
      initialCache.activity.forEach((item) => {
        map.set(item.date, { count: item.count, tasks: item.tasks || [] });
      });
    }
    return map;
  });

  const [freezeMap, setFreezeMap] = useState<Map<string, string>>(() => {
    if (globalMemoryHeatmap && globalMemoryHeatmap.cacheKey === cacheKey) {
      return globalMemoryHeatmap.freezeMap;
    }
    const fMap = new Map<string, string>();
    if (initialCache?.freezeDates) {
      initialCache.freezeDates.forEach((f) => fMap.set(f.date, f.scopeKey || 'OVERALL'));
    }
    return fMap;
  });

  const [activeDaysCount, setActiveDaysCount] = useState<number>(() => {
    if (globalMemoryHeatmap && globalMemoryHeatmap.cacheKey === cacheKey) {
      return globalMemoryHeatmap.activeDaysCount;
    }
    return initialCache?.activeDaysCount || 0;
  });

  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(() => {
    return Boolean((globalMemoryHeatmap && globalMemoryHeatmap.cacheKey === cacheKey) || initialCache);
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !hasLoadedOnce);
  const [error, setError] = useState('');

  // Selected date details modal
  const [selectedDateDetail, setSelectedDateDetail] = useState<{
    dateStr: string;
    formattedDate: string;
    count: number;
    isFrozen?: boolean;
    freezeScope?: string;
    tasks: ActivityTaskInfo[];
  } | null>(null);

  useBodyScrollLock(Boolean(selectedDateDetail));

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

  const applyResponse = useCallback((res: ActivityHistoryResponse, cKey: string) => {
    const map = new Map<string, { count: number; tasks: ActivityTaskInfo[] }>();
    res.activity.forEach((item) => {
      map.set(item.date, {
        count: item.count,
        tasks: item.tasks || [],
      });
    });
    setActivityMap(map);

    const fMap = new Map<string, string>();
    if (res.freezeDates) {
      res.freezeDates.forEach((f) => fMap.set(f.date, f.scopeKey || 'OVERALL'));
    }
    setFreezeMap(fMap);

    const activeDays = res.activeDaysCount || 0;
    setActiveDaysCount(activeDays);
    setHasLoadedOnce(true);

    // Save to global RAM cache for instant tab switching
    globalMemoryHeatmap = {
      cacheKey: cKey,
      activityMap: map,
      freezeMap: fMap,
      activeDaysCount: activeDays,
    };
  }, []);

  // Fetch 365-day rolling activity data
  const loadActivityData = useCallback(async () => {
    const cKey = `heatmap_${startDate.toFormat('yyyy-MM-dd')}_${endDate.toFormat('yyyy-MM-dd')}`;
    const cached = globalMemoryHeatmap?.cacheKey === cKey ? true : getPersistentData<ActivityHistoryResponse>(cKey);

    if (!cached) {
      setIsLoading(true);
    }
    setError('');
    try {
      const res = await fetchActivityHistory({
        startDate: startDate.toFormat('yyyy-MM-dd'),
        endDate: endDate.toFormat('yyyy-MM-dd'),
      });

      if (res && res.success) {
        setPersistentData(cKey, res);
        applyResponse(res, cKey);
      } else if (!cached) {
        setError('Failed to load activity history.');
      }
    } catch (err: any) {
      if (!cached) {
        setError('Unable to load heatmap. Please check your network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, applyResponse]);

  useEffect(() => {
    loadActivityData();
  }, [loadActivityData]);

  // Derive today's live completion state if todayTasks provided
  const liveTodayData = useMemo(() => {
    if (!todayTasks) return null;
    const completed = todayTasks.filter((t) => t.completedToday);
    return {
      count: completed.length,
      tasks: completed.map((t) => ({
        title: t.title,
        note: t.todayStudyNote || null,
      })),
    };
  }, [todayTasks]);

  // Construct calendar grid: columns = weeks (Sun..Sat), aligned to first Sunday
  // Memoized strictly by millisecond boundaries to avoid recalculating 742 Luxon string formatters per render!
  const startMs = startDate.toMillis();
  const endMs = endDate.toMillis();
  const todayMs = todayDt.toMillis();

  const { gridWeeks, monthLabels } = useMemo(() => {
    const firstGridSunday = startDate.minus({ days: startDate.weekday % 7 });
    const daysDiff = Math.ceil(endDate.diff(firstGridSunday, 'days').days) + 1;
    const totalWeeks = Math.ceil(daysDiff / 7);

    const weeksList: CalendarGridCell[][] = [];
    const labelsList: Array<{ monthName: string; weekIndex: number }> = [];
    let lastMonth = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays: CalendarGridCell[] = [];
      for (let d = 0; d < 7; d++) {
        const curDt = firstGridSunday.plus({ days: w * 7 + d });
        const dateStr = curDt.toFormat('yyyy-MM-dd');
        const isInRange = curDt >= startDate && curDt <= endDate;
        const isFuture = curDt > todayDt;

        // Track month transitions for accurate column alignment
        if (isInRange && curDt.month !== lastMonth && d === 0) {
          labelsList.push({
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
          formattedDate: curDt.toFormat('cccc, MMMM d, yyyy'),
        });
      }
      weeksList.push(weekDays);
    }

    return { gridWeeks: weeksList, monthLabels: labelsList };
  }, [startMs, endMs, todayMs]);

  // Fast O(1) data resolver for grid cells
  const getCellData = useCallback(
    (cell: CalendarGridCell) => {
      if (!cell.isInRange || cell.isFuture) {
        return { count: 0, tasks: [] as ActivityTaskInfo[], isFrozen: false, freezeScope: undefined };
      }
      if (cell.dateStr === todayStr && liveTodayData !== null) {
        return {
          count: liveTodayData.count,
          tasks: liveTodayData.tasks,
          isFrozen: freezeMap.has(cell.dateStr),
          freezeScope: freezeMap.get(cell.dateStr),
        };
      }
      const data = activityMap.get(cell.dateStr);
      const isFrozen = freezeMap.has(cell.dateStr);
      return {
        count: data ? data.count : 0,
        tasks: data ? data.tasks : [],
        isFrozen,
        freezeScope: freezeMap.get(cell.dateStr),
      };
    },
    [activityMap, freezeMap, todayStr, liveTodayData]
  );

  // Intensity color function (GitHub emerald aesthetic tailored for StreakUp dark theme + Ice Blue freeze shield)
  const getCellColor = (count: number, isInRange: boolean, isFuture: boolean, isFrozen: boolean) => {
    if (!isInRange) return 'bg-transparent border-transparent opacity-0 pointer-events-none';
    if (isFuture) return 'bg-dark-surface/30 border-dark-border/20 cursor-not-allowed opacity-40';
    if (count === 0 && isFrozen) {
      return 'bg-cyan-950/90 border-cyan-500 text-cyan-200 ring-1 ring-cyan-400/50 hover:border-cyan-300 shadow-sm shadow-cyan-500/20 cursor-pointer';
    }
    if (count === 0) return 'bg-dark-surface/70 border-dark-border/60 hover:border-zinc-400 cursor-pointer';
    if (count === 1) return 'bg-emerald-950 border-emerald-800 text-emerald-200 hover:border-emerald-500 cursor-pointer';
    if (count === 2) return 'bg-emerald-800 border-emerald-600 text-emerald-100 hover:border-emerald-400 shadow-sm shadow-emerald-700/20 cursor-pointer';
    if (count >= 3 && count <= 4) return 'bg-emerald-600 border-emerald-400 text-emerald-50 hover:border-emerald-300 shadow-sm shadow-emerald-500/30 cursor-pointer';
    return 'bg-emerald-400 border-emerald-300 text-zinc-950 font-bold hover:scale-125 shadow-md shadow-emerald-400/40 ring-1 ring-emerald-400/50 cursor-pointer';
  };

  const handleCellClick = (cell: CalendarGridCell) => {
    if (!cell.isInRange || cell.isFuture) return;
    const { count, tasks, isFrozen, freezeScope } = getCellData(cell);
    setSelectedDateDetail({
      dateStr: cell.dateStr,
      formattedDate: cell.formattedDate,
      count,
      isFrozen,
      freezeScope,
      tasks,
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
          <button
            type="button"
            onClick={() =>
              openStreakMilestoneModal({
                currentStreak: streak,
                longestStreak: user?.longestStreak || streak,
                userName: user?.name,
                userHandle: user?.username,
              })
            }
            title="View streak badges and milestones"
            className="flex items-center gap-1.5 text-flame-400 font-semibold hover:text-amber-300 transition-colors cursor-pointer group"
          >
            <Flame className="w-3.5 h-3.5 fill-flame-500 text-flame-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span>
              <strong>{streak}</strong> {streak === 1 ? 'day streak' : 'days streak'}
            </span>
          </button>
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
      {isLoading && !hasLoadedOnce && activityMap.size === 0 ? (
        <div className="py-16 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading activity history...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[760px] w-full">
            {/* Month labels aligned with week columns */}
            <div className="flex items-center gap-1.5 mb-1.5 select-none">
              <div className="w-6 shrink-0" />
              <div className="grid grid-flow-col auto-cols-fr gap-1 flex-1 text-[10px] font-mono text-zinc-400">
                {gridWeeks.map((_, wIdx) => {
                  const label = monthLabels.find((m) => m.weekIndex === wIdx);
                  return (
                    <div
                      key={wIdx}
                      className="text-left overflow-visible whitespace-nowrap"
                    >
                      {label ? label.monthName : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main grid with day labels on left */}
            <div className="flex items-stretch gap-1.5">
              {/* Day of week labels (Sun..Sat) */}
              <div className="grid grid-rows-7 gap-1 w-6 shrink-0 text-[9px] font-mono text-zinc-500 select-none">
                <span className="flex items-center leading-none">Sun</span>
                <span className="flex items-center leading-none opacity-0">Mon</span>
                <span className="flex items-center leading-none">Tue</span>
                <span className="flex items-center leading-none opacity-0">Wed</span>
                <span className="flex items-center leading-none">Thu</span>
                <span className="flex items-center leading-none opacity-0">Fri</span>
                <span className="flex items-center leading-none">Sat</span>
              </div>

              {/* 52-53 Columns of 7 Days */}
              <div className="grid grid-rows-7 grid-flow-col auto-cols-fr gap-1 flex-1">
                {gridWeeks.map((week) =>
                  week.map((cell) => {
                    const data = getCellData(cell);
                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => handleCellClick(cell)}
                        title={
                          cell.isFuture
                            ? `${cell.formattedDate}: Future date`
                            : data.isFrozen && data.count === 0
                            ? `${cell.formattedDate}: ❄️ Streak Shield Active (Protected)`
                            : `${cell.formattedDate}: ${data.count} habit${data.count === 1 ? '' : 's'} completed`
                        }
                        className={`aspect-square w-full rounded-sm border transition-all duration-100 ${getCellColor(
                          data.count,
                          cell.isInRange,
                          cell.isFuture,
                          data.isFrozen
                        )}`}
                      />
                    );
                  })
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
          <span className="text-[10px] text-dark-muted px-1">|</span>
          <div className="w-3 h-3 rounded-sm bg-cyan-950/90 border border-cyan-500 shadow-sm shadow-cyan-500/20" title="Freeze Shield Protected" />
          <span className="text-[10px] text-cyan-300 font-semibold">❄️ Frozen</span>
        </div>
      </div>

      {/* Date Detail Modal on Click */}
      {selectedDateDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="heatmap-date-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain"
          onClick={() => setSelectedDateDetail(null)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scaleUp my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-dark-border pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedDateDetail.isFrozen && selectedDateDetail.count === 0 ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  {selectedDateDetail.isFrozen && selectedDateDetail.count === 0 ? <span className="text-sm">❄️</span> : <CheckCircle2 className="w-4 h-4" />}
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

            {selectedDateDetail.isFrozen && (
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs text-cyan-200 font-medium">
                <span className="text-base">❄️</span>
                <div>
                  <p className="font-bold">Streak Shield Protected</p>
                  <p className="text-[11px] text-cyan-300/80">A freeze shield protected this missed day so your streak remained intact.</p>
                </div>
              </div>
            )}

            {selectedDateDetail.tasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-dark-muted flex-1">
                {selectedDateDetail.isFrozen ? 'Protected from streak break.' : 'No habit completions recorded on this date.'}
              </div>
            ) : (
              <div className="space-y-2.5 min-h-0 overflow-y-auto pr-1 flex-1">
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
              className="w-full py-2 bg-dark-surface hover:bg-dark-hover active:scale-95 text-zinc-200 text-xs font-bold rounded-xl border border-dark-border transition-all shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
