import React, { useState, useEffect } from 'react';
import { fetchGlobalLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { LeaderboardNav } from '../components/LeaderboardNav';
import { Globe } from 'lucide-react';

export const GlobalLeaderboardPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'streak' | 'points'>('streak');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadGlobalLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetchGlobalLeaderboard({ limit: 10, type: activeType });
        if (!isCancelled && res.success) {
          // Strictly display only the Top 10 users
          setEntries((res.leaderboard || []).slice(0, 10));
          setCurrentUserRankInfo(res.currentUserRankInfo);
        }
      } catch (err) {
        console.error('Failed to load global top 10:', err);
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

      {/* Top 10 Indicator Badge */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-dark-surface border border-dark-border rounded-xl w-fit text-xs font-semibold text-zinc-300">
        <Globe className="w-3.5 h-3.5 text-flame-400" />
        <span>Official Top 10 Hall of Fame</span>
      </div>

      <LeaderboardTable
        entries={entries}
        title={activeType === 'streak' ? 'Global Top 10 — Streak Rank' : 'Global Top 10 — Points Table'}
        subtitle={
          activeType === 'streak'
            ? 'Top 10 highest continuous streaks across StreakUp worldwide'
            : 'Top 10 highest accountability points earned across StreakUp worldwide'
        }
        currentUserRankInfo={currentUserRankInfo}
        isLoading={isLoading}
        activeType={activeType}
        onTypeChange={setActiveType}
      />
    </div>
  );
};
