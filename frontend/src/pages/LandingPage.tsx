import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGlobalLeaderboard, LeaderboardEntry } from '../api/leaderboard';
import { useAuth } from '../context/AuthContext';
import {
  Flame,
  Hourglass,
  Users2,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean>(true);

  useEffect(() => {
    const loadTopLeaderboard = async () => {
      try {
        const res = await fetchGlobalLeaderboard({ limit: 5 });
        if (res.success) {
          setTopUsers(res.leaderboard);
          if ((res as any).isDbConnected === false) {
            setDbConnected(false);
          } else {
            setDbConnected(true);
          }
        }
      } catch (err) {
        console.warn('Could not load landing preview:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTopLeaderboard();
  }, []);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-8 sm:pt-20 sm:pb-16 text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-flame-500/10 border border-flame-500/25 text-flame-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-flame-500" />
          <span>The Modern Daily Task & Streak Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-zinc-100 tracking-tight leading-tight sm:leading-none">
          Turn your daily habits into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-flame-500 to-amber-300">
            unbreakable streaks.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-dark-muted max-w-2xl mx-auto leading-relaxed">
          StreakUp brings together daily task management, consecutive-day streak tracking, timezone-aware midnight countdowns, and friendly leaderboard competition.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-glow-flame flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Go to Your Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-3.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-glow-flame flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Start Tracking Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/leaderboard/global"
                className="w-full sm:w-auto px-7 py-3.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-zinc-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <span>View Global Ranks</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </Link>
            </>
          )}
        </div>

        {!dbConnected && (
          <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 max-w-xl mx-auto text-left shadow-sm">
            <div className="font-bold text-amber-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              PostgreSQL Setup Reminder
            </div>
            <p className="mt-1 text-zinc-300 leading-relaxed">
              To persist users, tasks, and streaks in PostgreSQL, update <code className="text-flame-400 font-mono bg-dark-surface px-1.5 py-0.5 rounded border border-dark-border">DATABASE_URL</code> in <code className="text-flame-400 font-mono bg-dark-surface px-1.5 py-0.5 rounded border border-dark-border">backend/.env</code>, then run: <code className="text-emerald-400 font-mono bg-dark-surface px-1.5 py-0.5 rounded border border-dark-border">cd backend && npx prisma db push</code>.
            </p>
          </div>
        )}
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
          <div className="w-12 h-12 rounded-xl bg-flame-500/10 border border-flame-500/25 flex items-center justify-center text-flame-400 mb-5">
            <Flame className="w-6 h-6 fill-flame-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-2">Consecutive Streaks</h3>
          <p className="text-sm text-dark-muted leading-relaxed">
            Streaks calculate purely on the backend from real completion history. Ticking or unticking updates your streak dynamically without client-side spoofing.
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-5">
            <Hourglass className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-2">Live Dual Clocks</h3>
          <p className="text-sm text-dark-muted leading-relaxed">
            Stay on schedule with high-precision local time and a reverse countdown timer showing the exact hours, minutes, and seconds until local midnight.
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-5">
            <Users2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-2">Friends & Leaderboards</h3>
          <p className="text-sm text-dark-muted leading-relaxed">
            Search users, send requests, and compete on both a public global leaderboard and an exclusive friends-only leaderboard.
          </p>
        </div>
      </section>

      {/* Global Leaderboard Preview Section */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl font-extrabold text-zinc-100">Live Leaderboard Preview</h2>
              </div>
              <p className="text-xs text-dark-muted mt-1">
                Real productivity rankings based on active consecutive streaks.
              </p>
            </div>
            <Link
              to="/leaderboard/global"
              className="text-xs font-bold text-flame-400 hover:text-flame-300 flex items-center gap-1 font-mono"
            >
              <span>Full Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-dark-border/70">
            {loading ? (
              <div className="py-8 text-center text-xs text-dark-muted">Loading live leaderboard...</div>
            ) : topUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-dark-muted">
                No users ranked yet. Register and complete your first task to claim Rank #1!
              </div>
            ) : (
              topUsers.map((u) => (
                <div key={u.id} className="py-3.5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-mono font-bold text-xs text-zinc-400">
                      #{u.rank}
                    </span>
                    <InitialsAvatar
                      name={u.name}
                      image={u.profileImage}
                      size="md"
                    />
                    <div>
                      <Link to={`/profile/${u.username}`} className="text-sm font-semibold text-zinc-100 hover:text-flame-400 transition-colors">
                        {u.name}
                      </Link>
                      <div className="text-[11px] text-dark-muted font-mono">@{u.username}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-flame-500/10 px-2.5 py-1 rounded-full border border-flame-500/20 text-flame-400 font-mono text-xs font-bold">
                      <Flame className="w-3.5 h-3.5 fill-flame-500/30" />
                      <span>{u.currentStreak}d</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-xs text-dark-muted font-mono">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Best: {u.longestStreak}d</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
