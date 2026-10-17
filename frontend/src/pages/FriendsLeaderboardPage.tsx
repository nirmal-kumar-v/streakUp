import React, { useState, useEffect } from 'react';
import { fetchFriendsLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

export const FriendsLeaderboardPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'streak' | 'points'>('streak');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFriendsLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetchFriendsLeaderboard({ type: activeType });
        if (res.success) {
          setEntries(res.leaderboard);
          setCurrentUserEntry(res.currentUserEntry);
        }
      } catch (err) {
        console.error('Failed to load friends leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadFriendsLeaderboard();
  }, [activeType]);

  return (
    <div className="space-y-6 pb-20">
      <LeaderboardTable
        entries={entries}
        title="Friends Leaderboard"
        subtitle={
          activeType === 'streak'
            ? 'Exclusive rankings between you and your accepted friends by streaks'
            : 'Exclusive rankings between you and your accepted friends by accountability points'
        }
        currentUserRankInfo={currentUserEntry}
        isLoading={isLoading}
        activeType={activeType}
        onTypeChange={setActiveType}
      />

      {/* If only current user is in leaderboard */}
      {!isLoading && entries.length <= 1 && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 text-center max-w-xl mx-auto shadow-panel">
          <UserPlus className="w-10 h-10 text-flame-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-100">Invite and Add Friends</h3>
          <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
            You're currently the only one here! Connect with friends to see how your streaks compare.
          </p>
          <Link
            to="/friends"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-flame-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Find Friends by Username</span>
          </Link>
        </div>
      )}
    </div>
  );
};
