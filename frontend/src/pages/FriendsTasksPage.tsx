import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchFriendsTasks,
  fetchFriendsStudyActivity,
  FriendTaskGroup,
  StudyActivityItem,
} from '../api/friends';
import { toggleStudyNoteReaction } from '../api/reactions';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { TaskDetailModal } from '../components/TaskDetailModal';
import {
  Users2,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  Activity,
  Heart,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';

const FRIENDS_TASKS_CACHE_KEY = 'streakup_friends_tasks_cache';

function getCachedFriendsTasks(): { tasks: FriendTaskGroup[]; activity: StudyActivityItem[] } | null {
  try {
    const raw = sessionStorage.getItem(FRIENDS_TASKS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < 3 * 60 * 1000) {
      return parsed.data;
    }
  } catch (e) {}
  return null;
}

function setCachedFriendsTasks(data: { tasks: FriendTaskGroup[]; activity: StudyActivityItem[] }) {
  try {
    sessionStorage.setItem(
      FRIENDS_TASKS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch (e) {}
}

export const FriendsTasksPage: React.FC = () => {
  const [cachedInitial] = useState(() => getCachedFriendsTasks());
  const [activeTab, setActiveTab] = useState<'tasks' | 'activity'>('tasks');
  const [friendsTasks, setFriendsTasks] = useState<FriendTaskGroup[]>(() => cachedInitial?.tasks || []);
  const [activity, setActivity] = useState<StudyActivityItem[]>(() => cachedInitial?.activity || []);
  const [isLoading, setIsLoading] = useState(() => !cachedInitial);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filter state for Study Activity Feed
  const [activityPage, setActivityPage] = useState<number>(1);
  const [activityTotalPages, setActivityTotalPages] = useState<number>(1);
  const [activityTotal, setActivityTotal] = useState<number>(0);
  const [activityDays, setActivityDays] = useState<number | undefined>(undefined); // undefined = all time

  const inFlightLikesRef = useRef<Set<string>>(new Set());

  // Detail Modal for viewing task leaderboard
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadActivity = useCallback(async (targetPage = 1, targetDays = activityDays) => {
    setIsLoadingActivity(true);
    try {
      const actRes = await fetchFriendsStudyActivity(targetPage, 15, targetDays);
      if (actRes.success) {
        setActivity(actRes.activity || []);
        if (actRes.pagination) {
          setActivityPage(actRes.pagination.page);
          setActivityTotalPages(actRes.pagination.totalPages || 1);
          setActivityTotal(actRes.pagination.total);
        }
      }
    } catch (err: any) {
      console.error('Failed to load study activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [activityDays]);

  const loadData = async () => {
    if (friendsTasks.length === 0 && activity.length === 0) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const [tasksRes, actRes] = await Promise.all([
        fetchFriendsTasks(),
        fetchFriendsStudyActivity(1, 15, activityDays),
      ]);
      const newTasks = tasksRes.success ? (tasksRes.friendsTasks || []) : friendsTasks;
      const newActivity = actRes.success ? (actRes.activity || []) : activity;

      if (tasksRes.success) setFriendsTasks(newTasks);
      if (actRes.success) {
        setActivity(newActivity);
        if (actRes.pagination) {
          setActivityPage(actRes.pagination.page);
          setActivityTotalPages(actRes.pagination.totalPages || 1);
          setActivityTotal(actRes.pagination.total);
        }
      }
      if (tasksRes.success || actRes.success) {
        setCachedFriendsTasks({ tasks: newTasks, activity: newActivity });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load friends tasks and activity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTimeframeChange = (days?: number) => {
    setActivityDays(days);
    setActivityPage(1);
    loadActivity(1, days);
  };

  // Instant optimistic like toggle (0ms latency, eliminates flicker)
  const handleLikeNote = async (completionId: string) => {
    if (inFlightLikesRef.current.has(completionId)) return;
    inFlightLikesRef.current.add(completionId);

    const targetItem = activity.find((a) => a.id === completionId);
    if (!targetItem) {
      inFlightLikesRef.current.delete(completionId);
      return;
    }

    const previousItem = { ...targetItem };
    const hadLiked =
      targetItem.userReactions?.includes('LIKE') ||
      (targetItem.userReactions && targetItem.userReactions.length > 0);

    const currentLikes =
      (targetItem.reactionCounts?.LIKE || 0) +
      (targetItem.reactionCounts?.FIRE || 0) +
      (targetItem.reactionCounts?.STRONG || 0) +
      (targetItem.reactionCounts?.CLAP || 0) +
      (targetItem.reactionCounts?.CELEBRATE || 0);

    const nextLikes = hadLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    const nextUserReactions = hadLiked ? [] : ['LIKE'];

    // 1. Instant optimistic state update
    const cleanReactions = {
      FIRE: 0,
      STRONG: 0,
      CLAP: 0,
      CELEBRATE: 0,
      LIKE: nextLikes,
    };

    setActivity((prev) =>
      prev.map((item) => {
        if (item.id !== completionId) return item;
        return {
          ...item,
          reactionCounts: cleanReactions,
          reactions: cleanReactions,
          userReactions: nextUserReactions,
          totalReactions: nextLikes,
        };
      })
    );

    // 2. Perform background sync
    try {
      const res = await toggleStudyNoteReaction(completionId, 'LIKE');
      if (res.success) {
        const nextCounts = res.counts || {
          FIRE: 0,
          STRONG: 0,
          CLAP: 0,
          CELEBRATE: 0,
          LIKE: res.totalCount ?? ((res.counts as any)?.LIKE || 0),
        };
        setActivity((prev) =>
          prev.map((item) => {
            if (item.id !== completionId) return item;
            return {
              ...item,
              reactionCounts: nextCounts,
              reactions: nextCounts,
              userReactions: res.userReactions || [],
              totalReactions: res.totalCount ?? nextLikes,
            };
          })
        );
      }
    } catch (err) {
      // Rollback on network failure
      setActivity((prev) =>
        prev.map((item) => (item.id === completionId ? previousItem : item))
      );
    } finally {
      inFlightLikesRef.current.delete(completionId);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
            Friends' Tasks & Study Activity
          </h1>
          <p className="text-xs text-dark-muted mt-1">
            Browse your accepted friends' visible recurring habits, streaks, and study logs.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-dark-card border border-dark-border p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-flame-500 text-zinc-950 shadow-sm shadow-flame-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users2 className="w-3.5 h-3.5" />
            <span>Habits by Friend</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'bg-flame-500 text-zinc-950 shadow-sm shadow-flame-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Study Feed</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-zinc-400 space-y-3">
          <div className="w-7 h-7 border-2 border-flame-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono">Loading friends' habits and study logs...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center rounded-xl">
          {error}
        </div>
      ) : activeTab === 'tasks' ? (
        /* TAB 1: HABITS ORGANIZED BY FRIEND */
        <div className="space-y-6">
          {friendsTasks.length === 0 ? (
            <div className="py-20 text-center bg-dark-card border border-dashed border-dark-border rounded-2xl p-8 space-y-2">
              <Users2 className="w-12 h-12 text-dark-muted mx-auto opacity-50" />
              <h3 className="text-base font-bold text-zinc-200">No Friends Tasks to Display</h3>
              <p className="text-xs text-dark-muted max-w-sm mx-auto">
                Connect with study buddies in the Friends section to view their daily habits and compare streaks!
              </p>
            </div>
          ) : (
            friendsTasks.map((group) => (
              <div
                key={group.friend.id}
                className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-5"
              >
                {/* Friend Header */}
                <div className="flex items-center justify-between pb-4 border-b border-dark-border">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar
                      name={group.friend.name}
                      image={group.friend.profileImage}
                      size="lg"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-zinc-100">{group.friend.name}</h2>
                        <span className="text-xs text-zinc-500 font-mono">
                          @{group.friend.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                        <span className="flex items-center gap-1 text-flame-400 font-bold">
                          <Flame className="w-3.5 h-3.5 fill-flame-500" />
                          <span>{group.friend.currentStreak}d overall</span>
                        </span>
                        <span className="text-zinc-500">
                          Best: {group.friend.longestStreak}d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Friend's Tasks List */}
                {group.tasks.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-2">
                    This friend hasn't created any active habits yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 bg-dark-surface border border-dark-border rounded-xl space-y-3 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                                {task.category}
                              </span>
                              {task.completedToday ? (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Done Today
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-zinc-100">{task.title}</h3>
                          </div>

                          <button
                            onClick={() => setSelectedTaskId(task.id)}
                            title="View Friends Leaderboard"
                            className="p-1.5 text-zinc-400 hover:text-flame-400 hover:bg-dark-hover rounded-lg transition-colors"
                          >
                            <Trophy className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Task Streak & Freeze Badges */}
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="flex items-center gap-1 font-bold text-flame-400">
                            <Flame className="w-3.5 h-3.5 fill-flame-500" />
                            <span>{task.currentStreak}d task streak</span>
                          </span>
                          <span className="text-zinc-500">
                            Best: {task.longestStreak}d
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                              task.freezeBalance > 0
                                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                            }`}
                          >
                            {task.freezeBalance > 0
                              ? '🧊 1 Freeze'
                              : `⚡ ${task.freezeRechargeDays}/7 recharge`}
                          </span>
                        </div>

                        {/* Today's Study Note (if any) */}
                        {task.todayStudyNote && (
                          <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 italic flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-flame-400 shrink-0 mt-0.5" />
                            <span>"{task.todayStudyNote}"</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* TAB 2: FRIENDS-ONLY STUDY ACTIVITY FEED */
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Timeframe & Feed Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-dark-card border border-dark-border rounded-2xl">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-flame-400" />
              <span className="text-xs font-bold text-zinc-200">Study Logs History</span>
              {activityTotal > 0 && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({activityTotal} {activityTotal === 1 ? 'entry' : 'entries'})
                </span>
              )}
            </div>

            {/* Timeframe Quick Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: 'All', days: undefined },
                { label: '30 Days', days: 30 },
                { label: '14 Days', days: 14 },
                { label: '7 Days', days: 7 },
              ].map((tf) => {
                const isSelected = activityDays === tf.days;
                return (
                  <button
                    key={tf.label}
                    type="button"
                    onClick={() => handleTimeframeChange(tf.days)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-flame-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-dark-surface hover:bg-dark-hover text-zinc-400 hover:text-zinc-200 border border-dark-border/60'
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoadingActivity ? (
            <div className="py-16 text-center text-zinc-400 space-y-2">
              <div className="w-6 h-6 border-2 border-flame-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono">Loading notes...</p>
            </div>
          ) : activity.length === 0 ? (
            <div className="py-20 text-center bg-dark-card border border-dashed border-dark-border rounded-2xl p-8 space-y-2">
              <Activity className="w-12 h-12 text-dark-muted mx-auto opacity-50" />
              <h3 className="text-base font-bold text-zinc-200">No Study Logs Yet</h3>
              <p className="text-xs text-dark-muted max-w-sm mx-auto">
                When you and your accepted friends complete tasks and add study notes, they will appear here in your private activity feed.
              </p>
            </div>
          ) : (
            <>
              {activity.map((item) => {
                const hasLiked =
                  item.userReactions?.includes('LIKE') ||
                  (item.userReactions && item.userReactions.length > 0);

                const totalLikes =
                  (item.reactionCounts?.LIKE || 0) +
                  (item.reactionCounts?.FIRE || 0) +
                  (item.reactionCounts?.STRONG || 0) +
                  (item.reactionCounts?.CLAP || 0) +
                  (item.reactionCounts?.CELEBRATE || 0);

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-dark-card border border-dark-border rounded-2xl shadow-panel hover:border-zinc-700 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={item.user.name}
                          image={item.user.profileImage}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100">{item.user.name}</span>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              @{item.user.username}
                            </span>
                            {item.isCurrentUser && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-flame-500 text-zinc-950 font-black rounded-full">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-zinc-200 font-medium">"{item.task.title}"</span>
                            <span>•</span>
                            <span className="text-flame-400 font-mono font-bold flex items-center gap-0.5">
                              <Flame className="w-3 h-3 fill-flame-500" />
                              <span>{item.task.currentStreak}d</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-zinc-500 font-mono">
                        {item.completionDate}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200 italic flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-flame-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">"{item.studyNote}"</span>
                    </div>

                    {/* Single Premium Heart / Like Icon Bar */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLikeNote(item.id)}
                        title={hasLiked ? 'Unlike note' : 'Like note'}
                        aria-label={hasLiked ? 'Unlike note' : 'Like note'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 touch-manipulation select-none cursor-pointer border ${
                          hasLiked
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-sm shadow-rose-500/10'
                            : 'bg-dark-surface/60 border-dark-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-transform ${
                            hasLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-zinc-400'
                          }`}
                        />
                        {totalLikes > 0 && (
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              hasLiked ? 'text-rose-400' : 'text-zinc-400'
                            }`}
                          >
                            {totalLikes}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Multi-Page Pagination Bar */}
              {activityTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 pb-1 border-t border-dark-border/60">
                  <button
                    type="button"
                    disabled={activityPage <= 1 || isLoadingActivity}
                    onClick={() => loadActivity(activityPage - 1, activityDays)}
                    className="px-3.5 py-2 bg-dark-card hover:bg-dark-surface border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs text-zinc-400 font-medium">
                    Page <strong className="text-zinc-100">{activityPage}</strong> of{' '}
                    <strong className="text-zinc-100">{activityTotalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={activityPage >= activityTotalPages || isLoadingActivity}
                    onClick={() => loadActivity(activityPage + 1, activityDays)}
                    className="px-3.5 py-2 bg-dark-card hover:bg-dark-surface border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail & Leaderboard Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
};
