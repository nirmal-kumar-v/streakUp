import React, { useState, useEffect } from 'react';
import {
  fetchFriendsTasks,
  fetchFriendsStudyActivity,
  FriendTaskGroup,
  StudyActivityItem,
} from '../api/friends';
import { toggleStudyNoteReaction, ReactionType } from '../api/reactions';
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
  Lock,
} from 'lucide-react';

export const FriendsTasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'activity'>('tasks');
  const [friendsTasks, setFriendsTasks] = useState<FriendTaskGroup[]>([]);
  const [activity, setActivity] = useState<StudyActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal for viewing task leaderboard
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksRes, actRes] = await Promise.all([
        fetchFriendsTasks(),
        fetchFriendsStudyActivity(1, 40),
      ]);
      if (tasksRes.success) setFriendsTasks(tasksRes.friendsTasks || []);
      if (actRes.success) setActivity(actRes.activity || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load friends tasks and activity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const REACTION_CONFIG: Array<{ type: ReactionType; emoji: string; label: string }> = [
    { type: 'FIRE', emoji: '🔥', label: 'Fire' },
    { type: 'STRONG', emoji: '💪', label: 'Strong' },
    { type: 'CLAP', emoji: '👏', label: 'Clap' },
    { type: 'CELEBRATE', emoji: '🎉', label: 'Celebrate' },
  ];

  const handleToggleReaction = async (completionId: string, reactionType: ReactionType) => {
    // Optimistic UI update
    setActivity((prev) =>
      prev.map((item) => {
        if (item.id !== completionId) return item;
        const currentReactions = { ...(item.reactions || {}) };
        const currentUserReactions = [...(item.userReactions || [])];
        const hasReacted = currentUserReactions.includes(reactionType);

        if (hasReacted) {
          currentReactions[reactionType] = Math.max(0, (currentReactions[reactionType] || 1) - 1);
          const nextUserReactions = currentUserReactions.filter((r) => r !== reactionType);
          return {
            ...item,
            reactions: currentReactions,
            userReactions: nextUserReactions,
          };
        } else {
          currentReactions[reactionType] = (currentReactions[reactionType] || 0) + 1;
          currentUserReactions.push(reactionType);
          return {
            ...item,
            reactions: currentReactions,
            userReactions: currentUserReactions,
          };
        }
      })
    );

    try {
      const res = await toggleStudyNoteReaction(completionId, reactionType);
      if (res.success) {
        const nextCounts = res.reactions || res.counts;
        setActivity((prev) =>
          prev.map((item) => {
            if (item.id !== completionId) return item;
            return {
              ...item,
              reactions: nextCounts,
              userReactions: res.userReactions || [],
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
      loadData();
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-flame-400 font-bold px-2 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
              Friends Circle
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Friends-Only Access
            </span>
          </div>
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
        <div className="space-y-3 max-w-3xl mx-auto">
          {activity.length === 0 ? (
            <div className="py-20 text-center bg-dark-card border border-dashed border-dark-border rounded-2xl p-8 space-y-2">
              <Activity className="w-12 h-12 text-dark-muted mx-auto opacity-50" />
              <h3 className="text-base font-bold text-zinc-200">No Study Logs Yet</h3>
              <p className="text-xs text-dark-muted max-w-sm mx-auto">
                When you and your accepted friends complete tasks and add study notes, they will appear here in your private activity feed.
              </p>
            </div>
          ) : (
            activity.map((item) => (
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

                {/* Study Note Reactions (Requirement 6) */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {REACTION_CONFIG.map(({ type, emoji, label }) => {
                    const count = item.reactions?.[type] || 0;
                    const hasReacted = item.userReactions?.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleToggleReaction(item.id, type)}
                        title={`${label} (${count})`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95 border ${
                          hasReacted
                            ? 'bg-flame-500/20 border-flame-500/50 text-flame-300 font-bold shadow-sm'
                            : 'bg-dark-surface/60 border-dark-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-sm">{emoji}</span>
                        {count > 0 && <span className="font-mono text-[11px] font-bold">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
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
