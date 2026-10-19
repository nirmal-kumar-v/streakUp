import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useBadges } from '../context/BadgeContext';
import { useToast } from '../context/ToastContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Flame,
  Zap,
  Users2,
  Trophy,
  ArrowRight,
  Star,
  Reply,
  Send,
  RefreshCw,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';
import { toggleStarNotification } from '../api/notifications';
import { checkIfCurrentUserIsManager, replyToUserRequestAsManager } from '../api/userRequests';

export const NotificationsPage: React.FC = () => {
  const { decrementNotifications, clearNotifications, setUnreadNotificationsCount } = useBadges();
  const toast = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [allCount, setAllCount] = useState<number>(0);
  const [starredCount, setStarredCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'starred' | 'reminders' | 'friends' | 'milestones'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Manager state for request & feedback replies
  const [isManager, setIsManager] = useState<boolean>(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    checkIfCurrentUserIsManager()
      .then((res) => {
        if (isMounted) setIsManager(res);
      })
      .catch(() => {
        if (isMounted) setIsManager(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendReply = async (requestId: string) => {
    if (!replyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const res = await replyToUserRequestAsManager(requestId, replyText.trim());
      if (res.success) {
        toast.info('Reply sent to user');
        setActiveReplyId(null);
        setReplyText('');
      } else {
        toast.error(res.message || 'Failed to send reply');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to send reply'));
    } finally {
      setIsSendingReply(false);
    }
  };

  const hasLoadedRef = useRef(false);

  const loadNotifications = useCallback(async (targetPage = 1, filter = activeFilter) => {
    // Only set loading if we don't have notifications yet to avoid screen flash
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      let statusParam: 'all' | 'unread' | 'starred' | undefined = undefined;
      let categoryParam: NotificationCategory | undefined = undefined;

      if (filter === 'unread') {
        statusParam = 'unread';
      } else if (filter === 'starred') {
        statusParam = 'starred';
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
        if (typeof res.starredCount === 'number') {
          setStarredCount(res.starredCount);
        }
        if (typeof res.allCount === 'number') {
          setAllCount(res.allCount);
        } else if (filter === 'all') {
          setAllCount(res.totalCount);
        }
        setPage(res.page);
        setTotalPages(res.totalPages);
        setUnreadNotificationsCount(res.unreadCount);
        hasLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, setUnreadNotificationsCount]);

  useEffect(() => {
    loadNotifications(1, activeFilter);
  }, [activeFilter, loadNotifications]);

  const handleToggleStar = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    if (!target.isStarred && starredCount >= 15) {
      toast.error('Maximum 15 starred notifications allowed. Unstar an older notification first.');
      return;
    }

    const nextStarred = !target.isStarred;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isStarred: nextStarred } : n))
    );
    setStarredCount((c) => Math.max(0, Math.min(15, c + (nextStarred ? 1 : -1))));

    try {
      const res = await toggleStarNotification(id);
      if (!res.success) throw new Error('Failed to update star');
      if (nextStarred) {
        toast.info('Notification starred (saved permanently)');
      }
    } catch (err: any) {
      // Rollback
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isStarred: target.isStarred } : n))
      );
      setStarredCount((c) => Math.max(0, Math.min(15, c + (nextStarred ? -1 : 1))));
      toast.error(extractErrorMessage(err, 'Failed to update star status'));
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    decrementNotifications();

    try {
      const res = await markNotificationRead(id);
      if (!res.success) throw new Error('Failed to mark as read');
    } catch (err: any) {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      setUnreadCount((c) => c + 1);
      toast.error(extractErrorMessage(err, 'Failed to mark as read'));
    }
  };

  const handleMarkAllRead = async () => {
    const previousNotifications = [...notifications];
    const previousUnread = unreadCount;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    clearNotifications();

    try {
      const res = await markAllNotificationsRead();
      if (!res.success) throw new Error(res.message || 'Failed to mark all as read');
      toast.info('All caught up');
    } catch (err: any) {
      // Rollback
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
      toast.error(extractErrorMessage(err, 'Failed to mark all as read'));
    }
  };

  const handleDismiss = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    const previousNotifications = [...notifications];
    const previousUnread = unreadCount;
    const previousAllCount = allCount;

    // Optimistic remove
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setAllCount((c) => Math.max(0, c - 1));
    if (!target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      decrementNotifications();
    }

    try {
      const res = await dismissNotification(id);
      if (!res.success) throw new Error(res.message || 'Failed to dismiss notification');
    } catch (err: any) {
      // Rollback
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
      setAllCount(previousAllCount);
      toast.error(extractErrorMessage(err, 'Failed to dismiss notification'));
    }
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'OVERALL_REMINDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-flame-500/15 text-flame-400 border border-flame-500/30">
            <Flame className="w-3 h-3 fill-flame-500" /> Reminder
          </span>
        );
      case 'TASK_REMINDER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-dark-surface text-zinc-300 border border-dark-border">
            <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> Reminder
          </span>
        );
      case 'FRIEND_OVERALL_ACTIVITY':
      case 'FRIEND_TASK_ACTIVITY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-dark-surface text-zinc-300 border border-dark-border">
            <Users2 className="w-3 h-3 text-zinc-400" /> Friend
          </span>
        );
      case 'FRIEND_OVERALL_MILESTONE':
      case 'FRIEND_TASK_MILESTONE':
      case 'MY_MILESTONE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-dark-surface text-amber-300 border border-dark-border">
            <Trophy className="w-3 h-3 text-amber-400" /> Milestone
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-dark-surface text-zinc-400 border border-dark-border">
            <Bell className="w-3 h-3" /> Update
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-flame-500" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-flame-500 text-zinc-950 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mark all read</span>
            </button>
          )}

          <Link
            to="/settings/notifications"
            className="p-2 sm:px-3 sm:py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-300 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>


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
          All ({allCount})
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
          onClick={() => setActiveFilter('starred')}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeFilter === 'starred'
              ? 'bg-amber-400 text-zinc-950 font-black shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${activeFilter === 'starred' ? 'fill-zinc-950 text-zinc-950' : 'text-amber-400 fill-amber-400/30'}`} />
          Starred ({starredCount}/15)
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
          Friends
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

                    {/* Manager Reply Option — Exclusively for Requests & Feedback */}
                    {Boolean(isManager && item.eventKey?.startsWith('REQ_ALERT:')) && (() => {
                      const reqId = item.eventKey!.split(':')[1];
                      if (!reqId) return null;
                      const isOpen = activeReplyId === item.id;
                      return (
                        <div className="mt-3 pt-3 border-t border-dark-border/60">
                          {!isOpen ? (
                            <button
                              onClick={() => {
                                setActiveReplyId(item.id);
                                setReplyText('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-flame-500/10 text-flame-400 hover:bg-flame-500/20 border border-flame-500/20 transition-all shadow-sm"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              <span>Reply</span>
                            </button>
                          ) : (
                            <div className="space-y-2 bg-dark-surface/60 p-3 rounded-xl border border-dark-border">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-300">Reply to User (In-App)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReplyId(null);
                                    setReplyText('');
                                  }}
                                  className="text-dark-muted hover:text-zinc-200 text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write response to user..."
                                rows={2}
                                maxLength={1000}
                                className="w-full bg-dark-card border border-dark-border rounded-lg p-2.5 text-xs text-zinc-200 placeholder-dark-muted focus:outline-none focus:border-flame-500/50 resize-none transition-colors"
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-dark-muted font-mono">{replyText.length}/1000</span>
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(reqId)}
                                  disabled={!replyText.trim() || isSendingReply}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-flame-500 hover:bg-flame-400 text-zinc-950 disabled:opacity-40 transition-all shadow-sm"
                                >
                                  {isSendingReply ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  <span>Send Reply</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleStar(item.id)}
                    title={item.isStarred ? 'Unstar notification' : 'Star notification (kept permanently)'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.isStarred
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                        : 'text-zinc-500 hover:text-amber-400 hover:bg-dark-hover'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${item.isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
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
