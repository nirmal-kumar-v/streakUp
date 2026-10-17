import React from 'react';
import { DateTime } from 'luxon';
import { Calendar, CheckCircle2 } from 'lucide-react';

interface ActivityItem {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ActivityHeatmapProps {
  activity: ActivityItem[];
  daysToShow?: number;
  timezone?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  activity,
  daysToShow = 70,
  timezone = 'Asia/Kolkata',
}) => {
  const activityMap = new Map<string, number>();
  activity.forEach((item) => activityMap.set(item.date, item.count));

  // Generate date list backwards from today
  const now = DateTime.now().setZone(timezone);
  const days: Array<{ dateStr: string; label: string; count: number; dayOfWeek: number }> = [];

  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = now.minus({ days: i });
    const dateStr = d.toFormat('yyyy-MM-dd');
    const label = d.toFormat('ccc, MMM d, yyyy');
    const count = activityMap.get(dateStr) || 0;
    days.push({
      dateStr,
      label,
      count,
      dayOfWeek: d.weekday, // 1 = Monday, 7 = Sunday
    });
  }

  const totalCompletions = activity.reduce((sum, a) => sum + a.count, 0);
  const activeDaysCount = activity.filter((a) => a.count > 0).length;

  // Determine intensity color
  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-dark-surface border-dark-border/60 hover:border-zinc-500';
    if (count === 1) return 'bg-emerald-900/60 border-emerald-700/60 text-emerald-200';
    if (count === 2) return 'bg-emerald-600/80 border-emerald-500 text-emerald-100 shadow-sm shadow-emerald-500/20';
    return 'bg-emerald-500 border-emerald-400 text-zinc-950 font-bold shadow-sm shadow-emerald-400/30';
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
            Daily Consistency Heatmap
          </h3>
          <span className="text-xs text-dark-muted font-normal">Last {daysToShow} days</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>{activeDaysCount}</strong> active days
            </span>
          </div>
          <div className="text-dark-muted">
            <span>
              <strong>{totalCompletions}</strong> total tasks done
            </span>
          </div>
        </div>
      </div>

      {/* Grid of days */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 min-w-full">
          {days.map((day) => (
            <div
              key={day.dateStr}
              title={`${day.label}: ${day.count} task${day.count === 1 ? '' : 's'} completed`}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border transition-all duration-150 cursor-pointer hover:scale-125 ${getCellColor(
                day.count
              )}`}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-dark-muted mt-3 pt-3 border-t border-dark-border/60">
        <span>Less consistent</span>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[10px]">0</span>
          <div className="w-3 h-3 rounded bg-dark-surface border border-dark-border/60" />
          <div className="w-3 h-3 rounded bg-emerald-900/60 border border-emerald-700/60" />
          <div className="w-3 h-3 rounded bg-emerald-600/80 border border-emerald-500" />
          <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400" />
          <span className="text-[10px]">3+</span>
        </div>
        <span>High consistency</span>
      </div>
    </div>
  );
};
