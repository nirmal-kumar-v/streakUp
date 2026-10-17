import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ActivityTaskInfo, fetchActivityHistory } from '../api/tasks';

interface ActivityHeatmapProps {
  timezone?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  timezone = 'Asia/Kolkata',
}) => {
  const currentYear = DateTime.now().setZone(timezone).year;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [activityMap, setActivityMap] = useState<Map<string, { count: number; tasks: ActivityTaskInfo[] }>>(new Map());
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [activeDaysCount, setActiveDaysCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected date details modal/popover
  const [selectedDateDetail, setSelectedDateDetail] = useState<{
    dateStr: string;
    formattedDate: string;
    count: number;
    tasks: ActivityTaskInfo[];
  } | null>(null);

  // Load activity for selected year
  useEffect(() => {
    let isMounted = true;
    const loadYearData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetchActivityHistory(selectedYear);
        if (isMounted && res.success) {
          const map = new Map<string, { count: number; tasks: ActivityTaskInfo[] }>();
          res.activity.forEach((item) => {
            map.set(item.date, {
              count: item.count,
              tasks: item.tasks || [],
            });
          });
          setActivityMap(map);
          setTotalCompletions(res.totalCompletions || 0);
          setActiveDaysCount(res.activeDaysCount || 0);
          if (res.availableYears && res.availableYears.length > 0) {
            setAvailableYears(res.availableYears);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Failed to load yearly activity data.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadYearData();
    return () => {
      isMounted = false;
    };
  }, [selectedYear]);

  // Construct 53-week calendar grid from Jan 1 to Dec 31 of selectedYear
  const startOfYear = DateTime.fromObject({ year: selectedYear, month: 1, day: 1 }, { zone: timezone });
  const endOfYear = DateTime.fromObject({ year: selectedYear, month: 12, day: 31 }, { zone: timezone });

  // Align start to the preceding Sunday (0) so columns are full 7-day weeks (Sun..Sat)
  const firstGridSunday = startOfYear.minus({ days: startOfYear.weekday % 7 });
  // Total days to render
  const daysDiff = Math.ceil(endOfYear.diff(firstGridSunday, 'days').days) + 1;
  const totalWeeks = Math.ceil(daysDiff / 7);

  // Weeks grid: Array of columns (weeks), each containing 7 day slots
  const weeks: Array<Array<{
    dateStr: string;
    inSelectedYear: boolean;
    dayOfWeek: number;
    count: number;
    tasks: ActivityTaskInfo[];
    formattedDate: string;
  }>> = [];

  const monthLabels: Array<{ monthName: string; weekIndex: number }> = [];
  let lastMonth = -1;

  for (let w = 0; w < totalWeeks; w++) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      const curDt = firstGridSunday.plus({ days: w * 7 + d });
      const dateStr = curDt.toFormat('yyyy-MM-dd');
      const inSelectedYear = curDt.year === selectedYear;
      const data = activityMap.get(dateStr) || { count: 0, tasks: [] };

      // Track month transitions for header labels
      if (inSelectedYear && curDt.month !== lastMonth && d === 0) {
        monthLabels.push({
          monthName: curDt.toFormat('LLL'),
          weekIndex: w,
        });
        lastMonth = curDt.month;
      }

      weekDays.push({
        dateStr,
        inSelectedYear,
        dayOfWeek: curDt.weekday % 7,
        count: inSelectedYear ? data.count : 0,
        tasks: data.tasks,
        formattedDate: curDt.toFormat('cccc, MMMM d, yyyy'),
      });
    }
    weeks.push(weekDays);
  }

  // Intensity color
  const getCellColor = (count: number, inYear: boolean) => {
    if (!inYear) return 'bg-transparent border-transparent opacity-0 pointer-events-none';
    if (count === 0) return 'bg-dark-surface/80 border-dark-border/50 hover:border-zinc-500';
    if (count === 1) return 'bg-emerald-950 border-emerald-800 text-emerald-200';
    if (count === 2) return 'bg-emerald-800 border-emerald-600 text-emerald-100 shadow-sm shadow-emerald-700/20';
    if (count === 3) return 'bg-emerald-600 border-emerald-400 text-emerald-50 shadow-sm shadow-emerald-500/30';
    return 'bg-emerald-400 border-emerald-300 text-zinc-950 font-bold shadow-md shadow-emerald-400/40 ring-1 ring-emerald-400/50';
  };

  const handleCellClick = (day: {
    dateStr: string;
    inSelectedYear: boolean;
    count: number;
    tasks: ActivityTaskInfo[];
    formattedDate: string;
  }) => {
    if (!day.inSelectedYear) return;
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
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Yearly Habit Heatmap</span>
              <span className="text-[11px] font-mono font-normal text-flame-400 px-2 py-0.5 rounded-full bg-flame-500/10 border border-flame-500/20">
                {selectedYear}
              </span>
            </h3>
            <p className="text-[11px] text-dark-muted">
              Interactive GitHub-style record of completed daily habits & study notes
            </p>
          </div>
        </div>

        {/* Year Navigator & Stats */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Year Switcher */}
          <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-xl p-0.5 text-xs font-mono">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              disabled={availableYears.length > 0 && selectedYear <= Math.min(...availableYears)}
              title="Previous Year"
              className="p-1.5 hover:bg-dark-hover rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-bold text-zinc-200">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= currentYear}
              title="Next Year"
              className="p-1.5 hover:bg-dark-hover rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aggregate Stats */}
          <div className="hidden md:flex items-center gap-3 text-xs font-mono pl-2 border-l border-dark-border">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <strong>{activeDaysCount}</strong> active days
              </span>
            </div>
            <div className="text-dark-muted">
              <span>
                <strong>{totalCompletions}</strong> total habits done
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Heatmap Grid Area */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading activity history for {selectedYear}...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="inline-block min-w-full">
            {/* Month labels row */}
            <div className="flex mb-1.5 pl-8 text-[10px] font-mono text-zinc-400">
              {monthLabels.map((m, idx) => (
                <div
                  key={`${m.monthName}-${idx}`}
                  style={{ width: `${(weeks.length / 12) * 15}px` }}
                  className="shrink-0"
                >
                  {m.monthName}
                </div>
              ))}
            </div>

            {/* Main grid with day labels on left */}
            <div className="flex items-start gap-2">
              {/* Day of week labels */}
              <div className="flex flex-col gap-1.5 pt-0.5 text-[9px] font-mono text-zinc-500 shrink-0 select-none">
                <span className="h-3 leading-3">Sun</span>
                <span className="h-3 leading-3 opacity-0">Mon</span>
                <span className="h-3 leading-3">Tue</span>
                <span className="h-3 leading-3 opacity-0">Wed</span>
                <span className="h-3 leading-3">Thu</span>
                <span className="h-3 leading-3 opacity-0">Fri</span>
                <span className="h-3 leading-3">Sat</span>
              </div>

              {/* 53 Columns of 7 Days */}
              <div className="inline-grid grid-rows-7 grid-flow-col gap-1">
                {weeks.map((week) =>
                  week.map((day) => (
                    <div
                      key={day.dateStr}
                      onClick={() => handleCellClick(day)}
                      title={`${day.formattedDate}: ${day.count} habit${day.count === 1 ? '' : 's'} completed`}
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border transition-all duration-100 cursor-pointer hover:scale-125 ${getCellColor(
                        day.count,
                        day.inSelectedYear
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
          <div className="w-3 h-3 rounded-sm bg-dark-surface/80 border border-dark-border/60" />
          <div className="w-3 h-3 rounded-sm bg-emerald-950 border border-emerald-800" />
          <div className="w-3 h-3 rounded-sm bg-emerald-800 border border-emerald-600" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-400" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-300" />
          <span className="text-[10px]">More</span>
        </div>
      </div>

      {/* Date Detail Modal / Popover on Click */}
      {selectedDateDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">{selectedDateDetail.formattedDate}</h4>
                  <p className="text-xs text-dark-muted font-mono">
                    {selectedDateDetail.count} habit{selectedDateDetail.count === 1 ? '' : 's'} completed (+{selectedDateDetail.count * 5} pts)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDateDetail(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-dark-hover"
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
                    className="p-3 bg-dark-surface border border-dark-border rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-100">{task.title}</span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">+5 pts</span>
                    </div>
                    {task.note ? (
                      <p className="text-xs text-zinc-300 italic bg-dark-bg/60 p-2 rounded-lg border border-dark-border/40">
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
              className="w-full py-2 bg-dark-surface hover:bg-dark-hover text-zinc-200 text-xs font-bold rounded-xl border border-dark-border"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
