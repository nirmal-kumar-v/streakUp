import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  NotificationItem,
  NotificationCategory,
} from '../api/notifications';
import { InitialsAvatar } from '../components/InitialsAvatar';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Flame,
  Zap,
  Users2,
  Trophy,
  Info,
  ArrowRight,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'reminders' | 'friends' | 'milestones'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const loadNotifications = useCallback(async (targetPage = 1, filter = activeFilter) => {
    setIsLoading(true);
    try {
      let statusParam: 'all' | 'unread' | undefined = undefined;
      let categoryParam: NotificationCategory | undefined = undefined;

      if (filter === 'unread') {
        statusParam = 'unread';
      }

      const res = await fetchNotifications({
        category: categoryParam,
        status: statusParam,
        page: targetPage,
        limit: 20,
      });

      if (res.success) {
        let filteredList = res.notifications;
        if (filter === 'reminders') {
          filteredList = filteredList.filter(
            (n) => n.category === 'OVERALL_REMINDER' || n.category === 'TASK_REMINDER'
          );
        } else if (filter === 'friends') {
          filteredList = filteredList.filter(
            (n) => n.category === 'FRIEND_OVERALL_ACTIVITY' || n.category === 'FRIEND_TASK_ACTIVITY'
          );
        } else if (filter === 'milestones') {
          filteredList = filteredList.filter(
            (n) =>
              n.category === 'FRIEND_OVERALL_MILESTONE' ||
              n.category === 'FRIEND_TASK_MILESTONE' ||
              n.category === 'MY_MILESTONE'
          );
        }

        setNotifications(filteredList);
        setUnreadCount(res.unreadCount);
        setTotalCount(res.totalCount);
        setPage(res.page);
        setTotalPages(res.totalPages);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadNotifications(1, activeFilter);
  }, [loadNotifications, activeFilter]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await markNotificationRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to mark as read'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await markAllNotificationsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        showFeedback('All notifications marked as read.');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to mark all as read'));
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await dismissNotification(id);
      if (res.success) {
        const dismissed = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (dismissed && !dismissed.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        showFeedback('Notification dismissed.');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to dismiss notification'));
    }
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'OVERALL_REMINDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-flame-500/15 text-flame-400 border border-flame-500/30">
            <Flame className="w-3 h-3 fill-flame-500" /> Overall Reminder
          </span>
        );
      case 'TASK_REMINDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Zap className="w-3 h-3 fill-amber-400" /> Task Reminder
          </span>
        );
      case 'FRIEND_OVERALL_ACTIVITY':
      case 'FRIEND_TASK_ACTIVITY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Users2 className="w-3 h-3" /> Friend Alert
          </span>
        );
      case 'FRIEND_OVERALL_MILESTONE':
      case 'FRIEND_TASK_MILESTONE':
      case 'MY_MILESTONE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Trophy className="w-3 h-3 text-purple-400" /> Milestone
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-700/30 text-zinc-300 border border-zinc-700">
            <Info className="w-3 h-3" /> System
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Bell className="w-7 h-7 text-flame-500" />
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-black bg-flame-500 text-zinc-950 rounded-full shadow-sm shadow-flame-500/30 animate-pulse">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-dark-muted mt-1">
            Stay on top of reminders, friend streak activity, and milestone celebrations
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3.5 py-2 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-bold text-zinc-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              Mark all read
            </button>
          )}

          <Link
            to="/settings/notifications"
            className="px-3.5 py-2 bg-flame-500/15 hover:bg-flame-500/25 border border-flame-500/30 text-xs font-bold text-flame-400 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4 text-flame-400" />
            Preferences
          </Link>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className="p-3 bg-flame-500/10 border border-flame-500/30 rounded-xl text-xs font-bold text-flame-300">
          {feedback}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex bg-dark-card p-1.5 rounded-2xl border border-dark-border gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
            activeFilter === 'all'
              ? 'bg-flame-500 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All ({totalCount})
        </button>

        <button
          onClick={() => setActiveFilter('unread')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'unread'
              ? 'bg-flame-500 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeFilter === 'unread'
                  ? 'bg-zinc-950 text-flame-400'
                  : 'bg-flame-500/20 text-flame-400 border border-flame-500/30'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveFilter('reminders')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'reminders'
              ? 'bg-flame-500 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Reminders
        </button>

        <button
          onClick={() => setActiveFilter('friends')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'friends'
              ? 'bg-flame-500 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users2 className="w-3.5 h-3.5" />
          Friend Alerts
        </button>

        <button
          onClick={() => setActiveFilter('milestones')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'milestones'
              ? 'bg-flame-500 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Milestones
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-24 text-center text-xs text-dark-muted">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
              Loading notifications...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-dark-card border border-dashed border-dark-border rounded-3xl p-12 text-center">
            <Bell className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-30" />
            <h3 className="text-base font-bold text-zinc-200">No notifications found</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
              {activeFilter === 'unread'
                ? "You're completely caught up! No unread notifications."
                : 'When you receive reminders, friend updates, or reach milestones, they will appear here.'}
            </p>
            <div className="mt-5">
              <Link
                to="/settings/notifications"
                className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
              >
                Configure Reminder Times
              </Link>
            </div>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                !item.isRead
                  ? 'bg-dark-card border-flame-500/30 shadow-panel relative ring-1 ring-flame-500/20'
                  : 'bg-dark-card/60 border-dark-border hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Avatar or Category Icon */}
                  {item.friend ? (
                    <InitialsAvatar
                      name={item.friend.name}
                      image={item.friend.profileImage}
                      size="md"
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center shrink-0 text-flame-400 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getCategoryBadge(item.category)}
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-flame-500 shrink-0" title="Unread" />
                      )}
                      <span className="text-[11px] text-dark-muted font-mono">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-zinc-100 mb-1">{item.title}</h4>
                    <p className="text-xs text-zinc-300 leading-relaxed">{item.message}</p>

                    {item.task && (
                      <div className="mt-2 text-[11px] text-dark-muted font-mono">
                        Habit: <span className="text-zinc-200 font-semibold">"{item.task.title}"</span>
                      </div>
                    )}

                    {/* Navigation Action */}
                    {item.actionUrl && (
                      <div className="mt-3">
                        <Link
                          to={item.actionUrl}
                          onClick={() => {
                            if (!item.isRead) handleMarkAsRead(item.id);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-flame-400 hover:text-flame-300 group"
                        >
                          <span>Open details</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {!item.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-dark-hover rounded-lg transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(item.id)}
                    title="Dismiss notification"
                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-dark-hover rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-dark-border text-xs text-dark-muted font-mono">
          <button
            disabled={page <= 1}
            onClick={() => loadNotifications(page - 1)}
            className="px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => loadNotifications(page + 1)}
            className="px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
