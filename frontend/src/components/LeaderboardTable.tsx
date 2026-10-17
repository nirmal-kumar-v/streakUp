import React, { useState } from 'react';
import { LeaderboardEntry } from '../api/leaderboard';
import { Link } from 'react-router-dom';
import { Flame, Trophy, Crown, Search, CheckCircle2, User as UserIcon } from 'lucide-react';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  title: string;
  subtitle?: string;
  currentUserRankInfo?: LeaderboardEntry | null;
  isLoading?: boolean;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  title,
  subtitle,
  currentUserRankInfo,
  isLoading = false,
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

          {/* Search Filter */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder="Search by username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-all"
            />
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

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-flame-400">
                <Flame className="w-4 h-4 fill-flame-500/30" />
                <span className="font-bold">{currentUserRankInfo.currentStreak}d Streak</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <Trophy className="w-3.5 h-3.5" />
                <span>Best: {currentUserRankInfo.longestStreak}d</span>
              </div>
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
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center overflow-hidden mb-2 group-hover:border-zinc-400 transition-colors">
                {entries[1].profileImage ? (
                  <img src={entries[1].profileImage} alt={entries[1].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-zinc-300">{entries[1].name.charAt(0)}</span>
                )}
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
              <div className="w-18 h-18 rounded-2xl bg-zinc-800 border-2 border-flame-500 flex items-center justify-center overflow-hidden mb-2 shadow-md shadow-flame-500/20 group-hover:scale-105 transition-transform">
                {entries[0].profileImage ? (
                  <img src={entries[0].profileImage} alt={entries[0].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-flame-400">{entries[0].name.charAt(0)}</span>
                )}
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
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 border-2 border-amber-800/60 flex items-center justify-center overflow-hidden mb-2 group-hover:border-amber-700 transition-colors">
                {entries[2].profileImage ? (
                  <img src={entries[2].profileImage} alt={entries[2].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-amber-600">{entries[2].name.charAt(0)}</span>
                )}
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
              <tr className="border-b border-dark-border bg-dark-surface/60 text-[11px] font-bold text-dark-muted uppercase tracking-wider">
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4 text-center">Current Streak</th>
                <th className="py-3.5 px-4 text-center">Longest Streak</th>
                <th className="py-3.5 px-4 text-center">Tasks Today</th>
                <th className="py-3.5 px-4 text-center">Total Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/60 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-dark-muted">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                      Loading rankings...
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-dark-muted">
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
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:border-flame-500 transition-colors">
                          {entry.profileImage ? (
                            <img src={entry.profileImage} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
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
