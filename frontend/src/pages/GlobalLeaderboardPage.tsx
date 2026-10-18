import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchGlobalLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';

export const GlobalLeaderboardPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'streak' | 'points'>('streak');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetchGlobalLeaderboard({ limit: 50, type: activeType });
        if (res.success) {
          setEntries(res.leaderboard);
          setCurrentUserRankInfo(res.currentUserRankInfo);
        }
      } catch (err) {
        console.error('Failed to load global leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLeaderboard();
  }, [activeType]);

  return (
    <div className="space-y-6 pb-20">
      {/* Scope Navigation Tabs */}
      <div className="flex items-center gap-2">
        <Link
          to="/leaderboard/friends"
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover transition-all"
        >
          Friends Leaderboard
        </Link>
        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-dark-surface text-flame-400 border border-dark-border shadow-sm">
          Global Standings
        </span>
      </div>

      <LeaderboardTable
        entries={entries}
        title="Global Leaderboard"
        subtitle={
          activeType === 'streak'
            ? 'Live worldwide rankings ordered by consecutive daily streaks'
            : 'Live worldwide rankings ordered by task accountability points'
        }
        currentUserRankInfo={currentUserRankInfo}
        isLoading={isLoading}
        activeType={activeType}
        onTypeChange={setActiveType}
      />
    </div>
  );
};
