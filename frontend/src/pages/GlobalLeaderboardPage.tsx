import React, { useState, useEffect } from 'react';
import { fetchGlobalLeaderboard, getCachedGlobalLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { LeaderboardNav } from '../components/LeaderboardNav';
import { Globe } from 'lucide-react';

export const GlobalLeaderboardPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'streak' | 'points'>('streak');
  const cached = getCachedGlobalLeaderboard(activeType);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    cached?.leaderboard ? (cached.leaderboard || []).slice(0, cached.userLeaderboardLimit || cached.pagination?.limit || 10) : []
  );
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState<LeaderboardEntry | null>(cached?.currentUserRankInfo || null);
  const [displayLimit, setDisplayLimit] = useState<number>(cached?.userLeaderboardLimit || cached?.pagination?.limit || 10);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    let isCancelled = false;

    const currentCached = getCachedGlobalLeaderboard(activeType);
    if (currentCached) {
      const limit = currentCached.userLeaderboardLimit || currentCached.pagination?.limit || 10;
      setDisplayLimit(limit);
      setEntries((currentCached.leaderboard || []).slice(0, limit));
      setCurrentUserRankInfo(currentCached.currentUserRankInfo);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const loadGlobalLeaderboard = async () => {
      try {
        const res = await fetchGlobalLeaderboard({ type: activeType });
        if (!isCancelled && res.success) {
          const limit = res.userLeaderboardLimit || res.pagination?.limit || 10;
          setDisplayLimit(limit);
          setEntries((res.leaderboard || []).slice(0, limit));
          setCurrentUserRankInfo(res.currentUserRankInfo);
        }
      } catch (err) {
        console.error('Failed to load global leaderboard:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadGlobalLeaderboard();

    return () => {
      isCancelled = true;
    };
  }, [activeType]);

  return (
    <div className="space-y-6 pb-20">
      {/* Leaderboard Top Navigation Bar */}
      <LeaderboardNav />

      {/* Dynamic Indicator Badge */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-dark-surface border border-dark-border rounded-xl w-fit text-xs font-semibold text-zinc-300">
        <Globe className="w-3.5 h-3.5 text-flame-400" />
        <span>Official Top {displayLimit} Hall of Fame</span>
      </div>

      <LeaderboardTable
        entries={entries}
        title={activeType === 'streak' ? `Global Top ${displayLimit} — Streak Rank` : `Global Top ${displayLimit} — Points Table`}
        subtitle={
          activeType === 'streak'
            ? `Top ${displayLimit} highest continuous streaks across StreakUp worldwide`
            : `Top ${displayLimit} highest accountability points earned across StreakUp worldwide`
        }
        currentUserRankInfo={currentUserRankInfo}
        isLoading={isLoading}
        activeType={activeType}
        onTypeChange={setActiveType}
      />
    </div>
  );
};
