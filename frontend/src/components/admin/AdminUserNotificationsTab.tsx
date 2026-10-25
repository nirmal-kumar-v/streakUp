import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  adminGetUserNotifications,
  adminDeleteNotification,
  adminClearUserNotifications,
  adminMarkAllNotificationsRead,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';

interface AdminUserNotificationsTabProps {
  userId: string;
  username: string;
  onRequirePin: (title: string, description: string, action: (pin: string) => Promise<void>) => void;
}

export const AdminUserNotificationsTab: React.FC<AdminUserNotificationsTabProps> = ({
  userId,
  username,
  onRequirePin,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await adminGetUserNotifications(userId);
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadNotifications();
    }
  }, [userId]);

  const handleMarkAllRead = async () => {
    try {
      const res = await adminMarkAllNotificationsRead(userId);
      if (res.success) {
        toast.success(res.message);
        loadNotifications();
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDeleteOne = async (notificationId: string) => {
    try {
      const res = await adminDeleteNotification(notificationId);
      if (res.success) {
        toast.success(res.message);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleClearAll = () => {
    onRequirePin(
      'Clear All Notifications',
      `Permanently purge all ${notifications.length} notification(s) for @${username}? This action is irreversible.`,
      async (pin) => {
        const res = await adminClearUserNotifications(userId, {
          reason: `Admin purged all notifications for @${username}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Bell className="w-4 h-4 text-flame-400" />
            <span>User Notifications Hub (@{username})</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Total {notifications.length} notification(s) ({unreadCount} unread). Inspect in-app alerts or clean up inbox.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border text-zinc-300 border border-dark-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-flame-400' : ''}`} />
            <span>Sync</span>
          </button>

          {notifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
        {loading && notifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-flame-400" />
            <span>Fetching user notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-8 text-center">
            No notifications found in @{username}'s inbox.
          </p>
        ) : (
          <div className="divide-y divide-dark-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`py-3.5 flex items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? 'bg-flame-500/[0.03] -mx-2 px-2 rounded-xl' : ''
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-100 text-xs">{n.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-border text-zinc-400 font-bold">
                      {n.type || 'SYSTEM'}
                    </span>
                    {!n.isRead && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Unread
                      </span>
                    )}
                    {n.isStarred && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        ★ Starred
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-zinc-500 font-mono block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteOne(n.id)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                  title="Delete Notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
