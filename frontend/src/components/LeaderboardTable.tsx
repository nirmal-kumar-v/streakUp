import React, { useState } from 'react';
import { LeaderboardEntry } from '../api/leaderboard';
import { Link } from 'react-router-dom';
import { Flame, Trophy, Crown, Search, CheckCircle2, Award } from 'lucide-react';
import { InitialsAvatar } from './InitialsAvatar';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  title: string;
  subtitle?: string;
  currentUserRankInfo?: LeaderboardEntry | null;
  isLoading?: boolean;
  activeType?: 'streak' | 'points';
  onTypeChange?: (type: 'streak' | 'points') => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  title,
  subtitle,
  currentUserRankInfo,
  isLoading = false,
  activeType = 'streak',
  onTypeChange,
}) => {
  const [search, setSearch] = useState('');

  const filteredEntries = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.username.toLowerCase().includes(q) || e.name.toLowerCase().includes(q);
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 font-extrabold text-sm shadow-sm shadow-amber-500/30">
          <Crown className="w-4 h-4 fill-amber-400" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-zinc-300/15 border border-zinc-400/40 flex items-center justify-center text-zinc-200 font-bold text-sm">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/20 border border-amber-700/40 flex items-center justify-center text-amber-600 font-bold text-sm">
          3
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center text-dark-muted font-mono font-medium text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Search */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Flame className="w-6 h-6 text-flame-500 fill-flame-500/20" />
              {title}
            </h1>
            {subtitle && <p className="text-sm text-dark-muted mt-1">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Rank Type Tabs (Requirement 11) */}
            {onTypeChange && (
              <div className="flex bg-dark-surface border border-dark-border p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => onTypeChange('streak')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    activeType === 'streak'
                      ? 'bg-flame-500 text-zinc-950 shadow-sm shadow-flame-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Streak Rank</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTypeChange('points')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    activeType === 'points'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Points Rank</span>
                </button>
              </div>
            )}

            {/* Search Filter */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="text"
                placeholder="Search by username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Current User Standings Card (if authenticated and available) */}
        {currentUserRankInfo && (
          <div className="mt-5 p-4 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flame-500 text-zinc-950 font-black flex items-center justify-center font-mono text-base shadow-sm shadow-flame-500/30">
                #{currentUserRankInfo.rank}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">Your Current Standing</span>
                  <span className="text-[10px] bg-flame-500/20 text-flame-300 px-2 py-0.5 rounded-full font-semibold border border-flame-500/30">
                    YOU
                  </span>
                </div>
                <div className="text-xs text-dark-muted font-mono">@{currentUserRankInfo.username}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
              <div className="flex items-center gap-1.5 text-flame-400">
                <Flame className="w-4 h-4 fill-flame-500/30" />
                <span className="font-bold">{currentUserRankInfo.currentStreak}d Streak</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <Trophy className="w-3.5 h-3.5" />
                <span>Best: {currentUserRankInfo.longestStreak}d</span>
              </div>
              {currentUserRankInfo.points !== undefined && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    {currentUserRankInfo.points > 0
                      ? `+${currentUserRankInfo.points}`
                      : currentUserRankInfo.points}{' '}
                    pts
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Podium for Top 3 (if at least 3 entries exist and no active search) */}
      {!search && entries.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 pb-4">
          {/* Rank 2 */}
          <div className="order-2 md:order-1 bg-dark-card border border-dark-border/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between shadow-panel">
            <div className="w-8 h-8 rounded-full bg-zinc-300/10 border border-zinc-400/30 flex items-center justify-center text-zinc-300 font-bold text-sm mb-2">
              2nd
            </div>
            <Link to={`/profile/${entries[1].username}`} className="group flex flex-col items-center">
              <div className="mb-2 group-hover:scale-105 transition-transform">
                <InitialsAvatar
                  name={entries[1].name}
                  image={entries[1].profileImage}
                  size="xl"
                  className="border-2 border-zinc-600"
                />
              </div>
              <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors truncate max-w-[150px]">
                {entries[1].name}
              </h4>
              <p className="text-xs text-dark-muted font-mono">@{entries[1].username}</p>
            </Link>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-extrabold text-flame-400 font-mono">
              <Flame className="w-4 h-4 fill-flame-500/30" />
              {entries[1].currentStreak} days
            </div>
          </div>

          {/* Rank 1 (Champion) */}
          <div className="order-1 md:order-2 bg-dark-card border-2 border-flame-500/40 rounded-2xl p-6 text-center flex flex-col items-center justify-between shadow-glow-flame relative overflow-hidden -translate-y-1">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-flame-500 to-amber-300"></div>
            <div className="w-10 h-10 rounded-full bg-flame-500/20 border border-flame-500/50 flex items-center justify-center text-amber-400 mb-2">
              <Crown className="w-5 h-5 fill-amber-400" />
            </div>
            <Link to={`/profile/${entries[0].username}`} className="group flex flex-col items-center">
              <div className="mb-2 shadow-md shadow-flame-500/20 group-hover:scale-105 transition-transform">
                <InitialsAvatar
                  name={entries[0].name}
                  image={entries[0].profileImage}
                  size="2xl"
                  className="border-2 border-flame-500"
                />
              </div>
              <h4 className="text-base font-extrabold text-zinc-100 group-hover:text-flame-400 transition-colors truncate max-w-[180px]">
                {entries[0].name}
              </h4>
              <p className="text-xs text-flame-400 font-mono">@{entries[0].username}</p>
            </Link>
            <div className="mt-4 flex items-center gap-2 text-base font-black text-amber-300 font-mono bg-flame-500/20 px-3 py-1 rounded-full border border-flame-500/30">
              <Flame className="w-5 h-5 fill-amber-400" />
              {entries[0].currentStreak} days streak
            </div>
          </div>

          {/* Rank 3 */}
          <div className="order-3 bg-dark-card border border-dark-border/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between shadow-panel">
            <div className="w-8 h-8 rounded-full bg-amber-700/15 border border-amber-700/30 flex items-center justify-center text-amber-600 font-bold text-sm mb-2">
              3rd
            </div>
            <Link to={`/profile/${entries[2].username}`} className="group flex flex-col items-center">
              <div className="mb-2 group-hover:scale-105 transition-transform">
                <InitialsAvatar
                  name={entries[2].name}
                  image={entries[2].profileImage}
                  size="xl"
                  className="border-2 border-amber-800/60"
                />
              </div>
              <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors truncate max-w-[150px]">
                {entries[2].name}
              </h4>
              <p className="text-xs text-dark-muted font-mono">@{entries[2].username}</p>
            </Link>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-extrabold text-flame-400 font-mono">
              <Flame className="w-4 h-4 fill-flame-500/30" />
              {entries[2].currentStreak} days
            </div>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/60 text-[11px] font-bold text-dark-muted uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4 text-center">Current Streak</th>
                <th className="py-3.5 px-4 text-center">Longest Streak</th>
                <th className="py-3.5 px-4 text-center">Total Points</th>
                <th className="py-3.5 px-4 text-center">Tasks Today</th>
                <th className="py-3.5 px-4 text-center">Total Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/60 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-dark-muted">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                      Loading rankings...
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-dark-muted">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`transition-colors hover:bg-dark-hover/80 ${
                      entry.isCurrentUser ? 'bg-flame-500/5 ring-1 ring-inset ring-flame-500/30' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center">{getRankBadge(entry.rank)}</div>
                    </td>

                    {/* User */}
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/profile/${entry.username}`}
                        className="flex items-center gap-3 group focus:outline-none"
                      >
                        <InitialsAvatar
                          name={entry.name}
                          image={entry.profileImage}
                          size="md"
                          className="group-hover:border-flame-500 transition-colors"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-zinc-100 group-hover:text-flame-400 transition-colors">
                              {entry.name}
                            </span>
                            {entry.isCurrentUser && (
                              <span className="text-[10px] bg-flame-500/20 text-flame-300 font-bold px-1.5 py-0.2 rounded border border-flame-500/30">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-dark-muted font-mono">@{entry.username}</span>
                        </div>
                      </Link>
                    </td>

                    {/* Current Streak */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold font-mono text-flame-400 bg-flame-500/10 px-2.5 py-1 rounded-full border border-flame-500/20">
                        <Flame className="w-3.5 h-3.5 fill-flame-500/30" />
                        <span>{entry.currentStreak}d</span>
                      </div>
                    </td>

                    {/* Longest Streak */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-mono text-zinc-300">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>{entry.longestStreak}d</span>
                      </div>
                    </td>

                    {/* Total Points (Requirement 9 & 11) */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-mono font-bold text-xs ${
                          (entry.points ?? 0) > 0
                            ? 'text-emerald-400'
                            : (entry.points ?? 0) < 0
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {(entry.points ?? 0) > 0 ? `+${entry.points}` : (entry.points ?? 0)} pts
                      </span>
                    </td>

                    {/* Tasks Completed Today */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{entry.tasksCompletedToday}</span>
                      </div>
                    </td>

                    {/* Total Tasks */}
                    <td className="py-3.5 px-4 text-center text-xs font-mono text-dark-muted">
                      {entry.totalCompletedTasks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
