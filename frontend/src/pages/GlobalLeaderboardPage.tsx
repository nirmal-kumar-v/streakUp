import React, { useState, useEffect } from 'react';
import { fetchGlobalLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';

export const GlobalLeaderboardPage: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const res = await fetchGlobalLeaderboard({ limit: 50 });
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
  }, []);

  return (
    <div className="pb-20">
      <LeaderboardTable
        entries={entries}
        title="Global Leaderboard"
        subtitle="Live worldwide rankings ordered by consecutive daily streaks"
        currentUserRankInfo={currentUserRankInfo}
        isLoading={isLoading}
      />
    </div>
  );
};
