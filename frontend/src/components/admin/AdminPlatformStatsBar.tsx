import React, { useEffect, useState } from 'react';
import { Users, Compass, CheckCircle2, MessageSquare, Flame, RefreshCw } from 'lucide-react';
import { adminGetPlatformStats } from '../../api/admin';

export const AdminPlatformStatsBar: React.FC = () => {
  const [stats, setStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    totalGroups: number;
    totalTasks: number;
    completionsToday: number;
    pendingFeedbackRequests: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await adminGetPlatformStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to fetch platform stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!stats && !loading) return null;

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Live Platform Telemetry & Overview
          </span>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 transition-colors"
          title="Refresh Telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-flame-400' : ''}`} />
          <span className="text-[11px]">Sync</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Total Users</span>
          </div>
          <p className="text-lg font-black text-zinc-100 font-mono">
            {stats ? stats.totalUsers.toLocaleString() : '...'}
          </p>
        </div>

        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Users</span>
          </div>
          <p className="text-lg font-black text-emerald-400 font-mono">
            {stats ? stats.activeUsers.toLocaleString() : '...'}
          </p>
        </div>

        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Total Groups</span>
          </div>
          <p className="text-lg font-black text-zinc-100 font-mono">
            {stats ? stats.totalGroups.toLocaleString() : '...'}
          </p>
        </div>

        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <Flame className="w-3.5 h-3.5 text-flame-400" />
            <span>Active Tasks</span>
          </div>
          <p className="text-lg font-black text-zinc-100 font-mono">
            {stats ? stats.totalTasks.toLocaleString() : '...'}
          </p>
        </div>

        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Today's Checks</span>
          </div>
          <p className="text-lg font-black text-amber-400 font-mono">
            {stats ? stats.completionsToday.toLocaleString() : '...'}
          </p>
        </div>

        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
            <span>Pending Inquiries</span>
          </div>
          <p className="text-lg font-black text-rose-400 font-mono">
            {stats ? stats.pendingFeedbackRequests.toLocaleString() : '...'}
          </p>
        </div>
      </div>
    </div>
  );
};
