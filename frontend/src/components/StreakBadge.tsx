import React from 'react';
import { Flame, Trophy } from 'lucide-react';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  size?: 'sm' | 'md' | 'lg';
  showLongest?: boolean;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({
  currentStreak,
  longestStreak,
  size = 'md',
  showLongest = false,
}) => {
  const isZero = currentStreak === 0;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`inline-flex items-center font-bold rounded-full border transition-all ${sizeClasses} ${
          isZero
            ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
            : 'bg-flame-500/10 text-flame-400 border-flame-500/30 shadow-sm shadow-flame-500/10'
        }`}
      >
        <Flame
          className={`${iconSizes} ${
            isZero ? 'text-zinc-500' : 'text-flame-500 fill-flame-500/30 animate-pulse'
          }`}
        />
        <span className="font-mono tracking-tight">
          {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
        </span>
      </div>

      {showLongest && longestStreak !== undefined && longestStreak > 0 && (
        <div className="inline-flex items-center text-xs text-dark-muted font-mono bg-dark-surface px-2.5 py-0.5 rounded-full border border-dark-border gap-1">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span>Best: {longestStreak}d</span>
        </div>
      )}
    </div>
  );
};
