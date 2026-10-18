import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Hourglass, Globe } from 'lucide-react';
import { DateTime } from 'luxon';

interface DualClockProps {
  timezone?: string;
  onDayRollover?: () => void;
}

export const DualClock: React.FC<DualClockProps> = ({ timezone = 'Asia/Kolkata', onDayRollover }) => {
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');
  const [countdownFormatted, setCountdownFormatted] = useState<string>('');
  const [dayPercentage, setDayPercentage] = useState<number>(0);
  const [hoursLeft, setHoursLeft] = useState<number>(0);

  const prevDateRef = useRef<string>('');

  const updateClocks = useCallback(() => {
    // Current time in configured timezone
    const now = DateTime.now().setZone(timezone);
    if (!now.isValid) return;

    // A. Current local time clock (HH:mm:ss a)
    setCurrentTimeFormatted(now.toFormat('hh:mm:ss a'));
    setCurrentDateFormatted(now.toFormat('cccc, MMMM d, yyyy'));

    // Check if day rolled over to trigger refresh
    const currentDateStr = now.toFormat('yyyy-MM-dd');
    if (prevDateRef.current && prevDateRef.current !== currentDateStr) {
      if (onDayRollover) onDayRollover();
    }
    prevDateRef.current = currentDateStr;

    // B. Reverse clock / countdown until next local midnight
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
    updateClocks();

    // High precision 1000ms ticker
    const timer = setInterval(updateClocks, 1000);

    // Sync immediately when tab becomes visible after backgrounding
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateClocks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateClocks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {/* Clock 1: Current Local Time */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-dark-muted text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-flame-400" />
            <span>Local Time</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-dark-muted bg-dark-surface px-2.5 py-1 rounded-full border border-dark-border">
            <Globe className="w-3 h-3 text-flame-500" />
            <span className="font-mono text-[11px] truncate max-w-[140px]">{timezone}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-zinc-100 flex items-baseline">
            {currentTimeFormatted || '--:--:-- --'}
          </div>
          <div className="text-sm text-dark-muted font-medium mt-1">
            {currentDateFormatted || 'Loading local date...'}
          </div>
        </div>
      </div>

      {/* Clock 2: Reverse Countdown to Midnight */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-flame-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-dark-muted text-xs font-semibold uppercase tracking-wider">
            <Hourglass className={`w-4 h-4 ${hoursLeft < 4 ? 'text-rose-400 animate-pulse' : 'text-flame-500'}`} />
            <span>Day Countdown</span>
          </div>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
            hoursLeft < 4 
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
              : 'bg-flame-500/10 text-flame-300 border-flame-500/30'
          }`}>
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
              ></div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-dark-muted font-mono mt-1">
              <span>Day Start (00:00)</span>
              <span>{Math.round(dayPercentage)}% Elapsed</span>
              <span>Midnight (24:00)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ReverseCountdownClock } from './ReverseCountdownClock';
