import React, { useState, useEffect } from 'react';
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
    <div className="pb-20">
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
