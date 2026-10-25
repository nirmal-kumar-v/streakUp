import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminSystemHealth,
  adminFlushAllCaches,
  adminTriggerStreakReconciliation,
  fetchAdminAnnouncement,
  updateAdminAnnouncement,
  adminBatchGrantFreeze,
  exportAdminUsersCsv,
  exportAdminAuditLogsCsv,
  AdminSystemHealth,
  PlatformAnnouncementData,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';
import {
  Activity,
  Server,
  Database,
  RefreshCw,
  Bell,
  Download,
  Snowflake,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Flame,
  Zap,
  Cpu,
  Layers,
  Clock,
  Lock,
} from 'lucide-react';

export const AdminSystemTab: React.FC = () => {
  const toast = useToast();

  // ------------------------------------------
  // System Health State
  // ------------------------------------------
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // ------------------------------------------
  // Announcement State
  // ------------------------------------------
  const [announcement, setAnnouncement] = useState<PlatformAnnouncementData>({
    id: 'default',
    active: false,
    message: '',
    type: 'info',
    link: '',
    linkText: '',
    dismissible: true,
    createdAt: '',
    updatedAt: '',
  });

  // ------------------------------------------
  // Sensitive Action Modal State
  // ------------------------------------------
  const [sensitiveModalAction, setSensitiveModalAction] = useState<
    'flush_cache' | 'reconcile_streaks' | 'batch_freeze' | 'save_announcement' | null
  >(null);
  const [sensitivePin, setSensitivePin] = useState('');
  const [batchFreezeAmount, setBatchFreezeAmount] = useState(1);
  const [batchFreezeReason, setBatchFreezeReason] = useState('Platform-wide administrative freeze grant');
  const [isActionRunning, setIsActionRunning] = useState(false);

  // ------------------------------------------
  // Fetch Health
  // ------------------------------------------
  const loadHealth = useCallback(async () => {
    setIsPinging(true);
    try {
      const res = await fetchAdminSystemHealth();
      if (res.success) {
        setHealth(res.health);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to ping system health.'));
    } finally {
      setIsPinging(false);
    }
  }, [toast]);

  // ------------------------------------------
  // Fetch Announcement
  // ------------------------------------------
  const loadAnnouncement = useCallback(async () => {
    try {
      const res = await fetchAdminAnnouncement();
      if (res.success && res.announcement) {
        setAnnouncement(res.announcement);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to fetch platform announcement.'));
    }
  }, [toast]);

  useEffect(() => {
    loadHealth();
    loadAnnouncement();
  }, [loadHealth, loadAnnouncement]);

  // ------------------------------------------
  // Format Uptime
  // ------------------------------------------
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds % 60}s`;
  };

  // ------------------------------------------
  // Action Handlers
  // ------------------------------------------
  const handleExecuteSensitiveAction = async () => {
    if (!sensitivePin.trim()) {
      toast.error('Secondary Admin PIN is required.');
      return;
    }

    setIsActionRunning(true);
    try {
      if (sensitiveModalAction === 'flush_cache') {
        const res = await adminFlushAllCaches(sensitivePin);
        if (res.success) {
          toast.success(res.message);
          setSensitiveModalAction(null);
          setSensitivePin('');
          loadHealth();
        }
      } else if (sensitiveModalAction === 'reconcile_streaks') {
        const res = await adminTriggerStreakReconciliation(sensitivePin);
        if (res.success) {
          toast.success(res.message);
          setSensitiveModalAction(null);
          setSensitivePin('');
          loadHealth();
        }
      } else if (sensitiveModalAction === 'batch_freeze') {
        const res = await adminBatchGrantFreeze({
          amount: batchFreezeAmount,
          reason: batchFreezeReason,
          sensitivePin,
        });
        if (res.success) {
          toast.success(res.message);
          setSensitiveModalAction(null);
          setSensitivePin('');
          loadHealth();
        }
      } else if (sensitiveModalAction === 'save_announcement') {
        const res = await updateAdminAnnouncement({
          ...announcement,
          sensitivePin,
        });
        if (res.success) {
          toast.success(res.message);
          setAnnouncement(res.announcement);
          setSensitiveModalAction(null);
          setSensitivePin('');
        }
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Action failed. Please verify your Admin PIN.'));
    } finally {
      setIsActionRunning(false);
    }
  };

  // ------------------------------------------
  // Export Handlers
  // ------------------------------------------
  const handleExportUsers = async () => {
    try {
      const blob = await exportAdminUsersCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streakup_users_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Users CSV export downloaded.');
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to export users CSV.'));
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      const blob = await exportAdminAuditLogsCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streakup_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Audit logs CSV export downloaded.');
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to export audit logs CSV.'));
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-dark-surface/80 border border-dark-border rounded-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">System Diagnostics & Platform Powers</h2>
              <p className="text-xs text-dark-muted">
                Live performance metrics, instant cache management, global announcements, and emergency batch tools
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHealth}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-dark-bg border border-dark-border hover:border-cyan-500/40 text-xs font-semibold text-zinc-200 rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Ping Database</span>
          </button>
        </div>
      </div>

      {/* 1. Live Health Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DB Latency Card */}
        <div className="p-4 bg-dark-surface/90 border border-dark-border rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-dark-muted flex items-center gap-1 mb-1">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Database Query Latency</span>
            </div>
            <div className="text-2xl font-black text-zinc-100 flex items-baseline gap-1.5">
              <span>{health ? `${health.dbLatencyMs} ms` : '—'}</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {health && health.dbLatencyMs < 50 ? 'Optimal' : 'Normal'}
              </span>
            </div>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        </div>

        {/* Server Uptime Card */}
        <div className="p-4 bg-dark-surface/90 border border-dark-border rounded-xl">
          <div className="text-xs text-dark-muted flex items-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Server Uptime</span>
          </div>
          <div className="text-xl font-black text-zinc-100">
            {health ? formatUptime(health.uptimeSeconds) : '—'}
          </div>
          <div className="text-[10px] text-dark-muted mt-1">Node {health?.nodeVersion || 'v20+'}</div>
        </div>

        {/* Memory Footprint Card */}
        <div className="p-4 bg-dark-surface/90 border border-dark-border rounded-xl">
          <div className="text-xs text-dark-muted flex items-center gap-1 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Memory (Heap / RSS)</span>
          </div>
          <div className="text-xl font-black text-zinc-100">
            {health ? `${health.memory.heapUsedMb} MB` : '—'}
          </div>
          <div className="text-[10px] text-dark-muted mt-1">
            RSS: {health ? `${health.memory.rssMb} MB` : '—'} | Heap Max: {health ? `${health.memory.heapTotalMb} MB` : '—'}
          </div>
        </div>

        {/* Platform Environment */}
        <div className="p-4 bg-dark-surface/90 border border-dark-border rounded-xl">
          <div className="text-xs text-dark-muted flex items-center gap-1 mb-1">
            <Server className="w-3.5 h-3.5 text-flame-400" />
            <span>Environment</span>
          </div>
          <div className="text-xl font-black text-zinc-100 capitalize">
            {health?.environment.replace('-', ' ') || 'Production'}
          </div>
          <div className="text-[10px] text-dark-muted mt-1">Platform: {health?.platform || 'Node Linux/Win'}</div>
        </div>
      </div>

      {/* 2. Platform Database Tables Breakdown */}
      {health?.tableCounts && (
        <div className="p-5 bg-dark-surface/80 border border-dark-border rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-dark-muted mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Platform Database Record Footprint</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.users.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Users</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.tasks.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Habits / Tasks</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.taskCompletions.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Completions</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.groups.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Groups</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.friendships.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Friendships</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.notifications.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Notifications</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.freezeLogs.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Freeze Logs</div>
            </div>
            <div className="p-3 bg-dark-bg/60 border border-dark-border/60 rounded-xl">
              <div className="text-lg font-bold text-zinc-100">{health.tableCounts.auditLogs.toLocaleString()}</div>
              <div className="text-[11px] text-dark-muted">Audit Logs</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Platform Broadcast Announcement Manager */}
      <div className="p-6 bg-dark-surface/80 border border-dark-border rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-flame-500/10 border border-flame-500/20 rounded-xl text-flame-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Global Announcement Broadcast Banner</h3>
              <p className="text-xs text-dark-muted">
                Push instant announcements or maintenance alerts displayed to all users across the platform
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-semibold text-zinc-300">
              {announcement.active ? 'Active & Visible' : 'Inactive (Hidden)'}
            </span>
            <input
              type="checkbox"
              checked={announcement.active}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, active: e.target.checked }))}
              className="w-5 h-5 accent-flame-500 rounded cursor-pointer"
            />
          </label>
        </div>

        {/* Live Preview Box */}
        {announcement.active && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-dark-muted">
              Live Preview for Users:
            </span>
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                announcement.type === 'alert'
                  ? 'bg-red-500/10 border-red-500/30 text-red-200'
                  : announcement.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : announcement.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {announcement.type === 'alert' && <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />}
                {announcement.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                {announcement.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {announcement.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
                <span>{announcement.message || 'Announcement message preview will appear here...'}</span>
                {announcement.link && (
                  <span className="underline font-semibold ml-1 cursor-pointer">
                    {announcement.linkText || 'Learn more'}
                  </span>
                )}
              </div>
              {announcement.dismissible && (
                <span className="text-dark-muted text-[10px] px-1.5 py-0.5 rounded bg-dark-bg/40">
                  Dismissible
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Banner Type */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Banner Severity</label>
            <select
              value={announcement.type}
              onChange={(e) =>
                setAnnouncement((prev) => ({
                  ...prev,
                  type: e.target.value as any,
                }))
              }
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500"
            >
              <option value="info">Info (Cyan / Neutral)</option>
              <option value="warning">Warning (Amber / Caution)</option>
              <option value="success">Success (Emerald / Celebration)</option>
              <option value="alert">Alert (Red / Urgent Maintenance)</option>
            </select>
          </div>

          {/* Action Link (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Action Link URL (Optional)</label>
            <input
              type="text"
              placeholder="e.g. /groups or https://..."
              value={announcement.link || ''}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, link: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500"
            />
          </div>

          {/* Action Link Text */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Link Text (Optional)</label>
            <input
              type="text"
              placeholder="e.g. View Details"
              value={announcement.linkText || ''}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, linkText: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500"
            />
          </div>
        </div>

        {/* Message Textarea */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Broadcast Message</label>
          <textarea
            rows={2}
            placeholder="Type platform announcement message..."
            value={announcement.message}
            onChange={(e) => setAnnouncement((prev) => ({ ...prev, message: e.target.value }))}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-dark-muted">
            <input
              type="checkbox"
              checked={announcement.dismissible}
              onChange={(e) => setAnnouncement((prev) => ({ ...prev, dismissible: e.target.checked }))}
              className="accent-flame-500"
            />
            <span>Allow users to dismiss this banner</span>
          </label>

          <button
            onClick={() => setSensitiveModalAction('save_announcement')}
            className="px-4 py-2 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-flame-500/20"
          >
            Save Announcement
          </button>
        </div>
      </div>

      {/* 4. Platform Super-Power Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Flush Caches Action */}
        <div className="p-5 bg-dark-surface/80 border border-dark-border rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="text-sm font-bold text-zinc-100">Flush All Caches</h4>
            </div>
            <p className="text-xs text-dark-muted mb-4">
              Instantly purges all backend in-memory leaderboard caches, stats buffers, and user admin configurations to force immediate fresh database synchronization.
            </p>
          </div>
          <button
            onClick={() => setSensitiveModalAction('flush_cache')}
            className="w-full py-2.5 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs rounded-xl transition"
          >
            Flush System Caches
          </button>
        </div>

        {/* Global Streak Reconcile */}
        <div className="p-5 bg-dark-surface/80 border border-dark-border rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Flame className="w-4 h-4" />
              <h4 className="text-sm font-bold text-zinc-100">Global Streak Reconcile</h4>
            </div>
            <p className="text-xs text-dark-muted mb-4">
              Executes a full reconciliation pass across every user and daily task to correct stale streaks for inactive accounts whose deadlines passed.
            </p>
          </div>
          <button
            onClick={() => setSensitiveModalAction('reconcile_streaks')}
            className="w-full py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs rounded-xl transition"
          >
            Run Global Reconcile
          </button>
        </div>

        {/* Emergency Batch Freezes */}
        <div className="p-5 bg-dark-surface/80 border border-dark-border rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Snowflake className="w-4 h-4" />
              <h4 className="text-sm font-bold text-zinc-100">Emergency Batch Freezes</h4>
            </div>
            <p className="text-xs text-dark-muted mb-4">
              Grants +1 Freeze protection credit to all active platform users at once (used for planned maintenance windows or festive holidays).
            </p>
          </div>
          <button
            onClick={() => setSensitiveModalAction('batch_freeze')}
            className="w-full py-2.5 px-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-semibold text-xs rounded-xl transition"
          >
            Batch Grant Freezes
          </button>
        </div>
      </div>

      {/* 5. Data Portability & Reporting Center */}
      <div className="p-5 bg-dark-surface/80 border border-dark-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Platform Data Portability & Export</span>
          </h4>
          <p className="text-xs text-dark-muted">
            Download comprehensive platform reports as CSV files for compliance, backups, or external analytics
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportUsers}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-bg border border-dark-border hover:border-emerald-500/40 text-xs font-semibold text-zinc-200 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Users (CSV)</span>
          </button>
          <button
            onClick={handleExportAuditLogs}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-bg border border-dark-border hover:border-cyan-500/40 text-xs font-semibold text-zinc-200 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Audit Trail (CSV)</span>
          </button>
        </div>
      </div>

      {/* Sensitive Action PIN Confirmation Modal */}
      {sensitiveModalAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-dark-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-flame-500/10 border border-flame-500/20 text-flame-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  {sensitiveModalAction === 'flush_cache' && 'Confirm Cache Flush'}
                  {sensitiveModalAction === 'reconcile_streaks' && 'Confirm Global Reconcile'}
                  {sensitiveModalAction === 'batch_freeze' && 'Confirm Batch Freezes'}
                  {sensitiveModalAction === 'save_announcement' && 'Confirm Broadcast Update'}
                </h3>
                <p className="text-xs text-dark-muted">
                  Requires secondary Sensitive Admin PIN confirmation
                </p>
              </div>
            </div>

            {sensitiveModalAction === 'batch_freeze' && (
              <div className="space-y-3 p-3 bg-dark-bg/60 border border-dark-border rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Freezes to Grant per User:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={batchFreezeAmount}
                    onChange={(e) => setBatchFreezeAmount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Administrative Reason:
                  </label>
                  <input
                    type="text"
                    value={batchFreezeReason}
                    onChange={(e) => setBatchFreezeReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Enter Secondary Sensitive PIN
              </label>
              <input
                type="password"
                placeholder="6-digit Admin PIN"
                value={sensitivePin}
                onChange={(e) => setSensitivePin(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 font-mono tracking-widest"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSensitiveModalAction(null);
                  setSensitivePin('');
                }}
                disabled={isActionRunning}
                className="px-4 py-2 bg-dark-bg hover:bg-dark-border/40 text-xs font-semibold text-zinc-300 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSensitiveAction}
                disabled={isActionRunning || !sensitivePin.trim()}
                className="px-5 py-2 bg-flame-500 hover:bg-flame-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-flame-500/20"
              >
                {isActionRunning ? 'Processing...' : 'Confirm & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
