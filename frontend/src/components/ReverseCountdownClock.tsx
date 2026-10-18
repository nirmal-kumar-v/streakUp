import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Hourglass } from 'lucide-react';
import { DateTime } from 'luxon';

interface ReverseCountdownClockProps {
  timezone?: string;
  onDayRollover?: () => void;
}

export const ReverseCountdownClock: React.FC<ReverseCountdownClockProps> = ({
  timezone = 'Asia/Kolkata',
  onDayRollover,
}) => {
  const [countdownFormatted, setCountdownFormatted] = useState<string>('');
  const [dayPercentage, setDayPercentage] = useState<number>(0);
  const [hoursLeft, setHoursLeft] = useState<number>(0);

  const prevDateRef = useRef<string>('');

  const updateClock = useCallback(() => {
    // Current time in configured timezone
    const now = DateTime.now().setZone(timezone);
    if (!now.isValid) return;

    // Check if day rolled over to trigger refresh
    const currentDateStr = now.toFormat('yyyy-MM-dd');
    if (prevDateRef.current && prevDateRef.current !== currentDateStr) {
      if (onDayRollover) onDayRollover();
    }
    prevDateRef.current = currentDateStr;

    // Reverse clock / countdown until next local midnight
    const nextMidnight = now.plus({ days: 1 }).startOf('day');
    const startOfCurrentDay = now.startOf('day');

    const totalDaySeconds = nextMidnight.diff(startOfCurrentDay, 'seconds').seconds || 86400;
    const secondsRemaining = Math.max(0, Math.floor(nextMidnight.diff(now, 'seconds').seconds));

    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    const seconds = secondsRemaining % 60;

    setHoursLeft(hours);
    setCountdownFormatted(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );

    // Percentage of today remaining (for visual bar)
    const elapsedSeconds = totalDaySeconds - secondsRemaining;
    const percent = Math.min(100, Math.max(0, (elapsedSeconds / totalDaySeconds) * 100));
    setDayPercentage(percent);
  }, [timezone, onDayRollover]);

  useEffect(() => {
    // Immediate calculation
    updateClock();

    // High precision 1000ms ticker
    const timer = setInterval(updateClock, 1000);

    // Sync immediately when tab becomes visible after backgrounding
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateClock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateClock]);

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-flame-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-dark-muted text-xs font-semibold uppercase tracking-wider">
          <Hourglass className={`w-4 h-4 ${hoursLeft < 4 ? 'text-rose-400 animate-pulse' : 'text-flame-500'}`} />
          <span>Day Countdown</span>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
            hoursLeft < 4
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              : 'bg-flame-500/10 text-flame-300 border-flame-500/30'
          }`}
        >
          {hoursLeft}h remaining today
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-flame-400">
            {countdownFormatted || '00:00:00'}
          </div>
          <span className="text-xs text-dark-muted font-mono font-medium">left until midnight</span>
        </div>

        {/* Progress bar of day elapsed */}
        <div className="mt-3">
          <div className="w-full bg-dark-surface rounded-full h-2 overflow-hidden border border-dark-border/80">
            <div
              className="h-full bg-gradient-to-r from-flame-500 to-amber-300 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${dayPercentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-dark-muted font-mono mt-1.5">
            <span>Day Start (00:00)</span>
            <span>{Math.round(dayPercentage)}% Elapsed</span>
            <span>Midnight (24:00)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
