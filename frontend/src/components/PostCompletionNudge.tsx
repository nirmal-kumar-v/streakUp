import React, { useState, useEffect, useCallback } from 'react';
import { fetchFriendsList, nudgeFriend, FriendUser } from '../api/friends';
import { InitialsAvatar } from './InitialsAvatar';
import { Flame, Check, X, BellRing, Sparkles, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface PostCompletionNudgeDetail {
  taskId?: string;
  taskTitle?: string;
}

export function triggerPostCompletionNudge(detail?: PostCompletionNudgeDetail) {
  window.dispatchEvent(new CustomEvent('task-completed-nudge', { detail }));
}

export const PostCompletionNudge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNudgingAll, setIsNudgingAll] = useState(false);
  const [nudgedFriendIds, setNudgedFriendIds] = useState<Record<string, string>>({}); // friendId -> status label

  // Load friends list from backend
  const refreshFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchFriendsList();
      if (res.success && Array.isArray(res.friends)) {
        setFriends(res.friends);
      }
    } catch (err) {
      console.error('Failed to load friends for nudging:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for task completion event
  useEffect(() => {
    const handleTaskCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<PostCompletionNudgeDetail>;
      const detail = customEvent.detail || {};
      setTaskTitle(detail.taskTitle || 'Your habit');
      setIsOpen(true);
      // Refresh friends list to evaluate live day-boundary completion status
      refreshFriends();
    };

    window.addEventListener('task-completed-nudge', handleTaskCompleted);
    return () => {
      window.removeEventListener('task-completed-nudge', handleTaskCompleted);
    };
  }, [refreshFriends]);

  if (!isOpen) return null;

  // Filter friends who have NOT completed any task today (tasksCompletedToday === 0)
  const eligibleFriends = friends.filter((f) => (f.tasksCompletedToday ?? 0) === 0);
  const completedFriendsCount = friends.length - eligibleFriends.length;

  // Friends among eligible who haven't been nudged in this session
  const unNudgedEligible = eligibleFriends.filter((f) => !nudgedFriendIds[f.id]);

  // Handle single friend nudge
  const handleNudgeSingle = async (friend: FriendUser) => {
    if (nudgedFriendIds[friend.id]) return;

    // Optimistically show nudged immediately
    setNudgedFriendIds((prev) => ({ ...prev, [friend.id]: 'Nudged ✓' }));

    try {
      const res = await nudgeFriend(friend.id);
      if (!res.success) {
        throw new Error(res.message || 'Failed');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setNudgedFriendIds((prev) => ({ ...prev, [friend.id]: 'Nudged recently' }));
      } else {
        const errorMsg = err?.response?.data?.error || 'Failed';
        setNudgedFriendIds((prev) => ({ ...prev, [friend.id]: errorMsg }));
      }
    }
  };

  // Handle Nudge All
  const handleNudgeAll = async () => {
    if (isNudgingAll || unNudgedEligible.length === 0) return;

    // Optimistically update all immediately
    const optimisticMap: Record<string, string> = {};
    unNudgedEligible.forEach((f) => {
      optimisticMap[f.id] = 'Nudged ✓';
    });
    setNudgedFriendIds((prev) => ({ ...prev, ...optimisticMap }));

    setIsNudgingAll(true);
    try {
      await Promise.allSettled(
        unNudgedEligible.map(async (friend) => {
          try {
            await nudgeFriend(friend.id);
          } catch (err: any) {
            if (err?.response?.status === 429) {
              setNudgedFriendIds((prev) => ({ ...prev, [friend.id]: 'Nudged recently' }));
            }
          }
        })
      );
    } finally {
      setIsNudgingAll(false);
    }
  };

  return (
    <aside
      role="complementary"
      aria-label="Friend habit reminders"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-40 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-4 shadow-2xl shadow-zinc-950/80 space-y-3 transition-all animate-fadeIn"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-flame-500/15 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
            <Flame className="w-4 h-4 fill-flame-500" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
              <span>Remind Friends</span>
              {eligibleFriends.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-flame-500/20 text-flame-400 border border-flame-500/30 rounded-full">
                  {eligibleFriends.length}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-zinc-400 truncate max-w-[210px]">
              Completed: <span className="text-zinc-200 font-medium">{taskTitle}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close friend reminders"
          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          <span>Checking friends' habit status...</span>
        </div>
      ) : friends.length === 0 ? (
        /* User has no friends yet */
        <div className="py-2 text-center space-y-2">
          <p className="text-xs text-zinc-400">
            Stay accountable together! Connect with friends to view their progress and exchange streak nudges.
          </p>
          <Link
            to="/friends"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 rounded-xl transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-flame-400" />
            <span>Find Friends</span>
          </Link>
        </div>
      ) : eligibleFriends.length === 0 ? (
        /* All friends have completed tasks today */
        <div className="py-2 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>All friends completed habits today!</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {completedFriendsCount > 1
              ? `All ${completedFriendsCount} of your friends crushed their goals today. No nudges needed!`
              : 'Your friend crushed their habit today. No nudges needed!'}
          </p>
        </div>
      ) : (
        /* List of friends who have not completed any task today */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Haven't completed habits today:</span>
            {eligibleFriends.length > 1 && (
              <button
                onClick={handleNudgeAll}
                disabled={isNudgingAll || unNudgedEligible.length === 0}
                className="inline-flex items-center gap-1 font-bold text-flame-400 hover:text-flame-300 disabled:opacity-40 disabled:hover:text-flame-400 transition-colors"
              >
                <BellRing className="w-3 h-3" />
                <span>{isNudgingAll ? 'Nudging all...' : 'Nudge All'}</span>
              </button>
            )}
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
            {eligibleFriends.map((friend) => {
              const isNudged = Boolean(nudgedFriendIds[friend.id]);
              const statusText = nudgedFriendIds[friend.id];

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <InitialsAvatar
                      name={friend.name}
                      image={friend.profileImage}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-zinc-200 truncate leading-tight">
                        {friend.name}
                      </h5>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                        <Flame className="w-2.5 h-2.5 text-flame-500 fill-flame-500" />
                        <span>{friend.currentStreak}d streak</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleNudgeSingle(friend)}
                    disabled={isNudged || isNudgingAll}
                    title={isNudged ? statusText : `Nudge @${friend.username} to complete today's habits`}
                    className={`shrink-0 ml-2 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      isNudged
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 cursor-default'
                        : 'bg-flame-500/15 hover:bg-flame-500/25 active:scale-95 text-flame-400 border border-flame-500/30'
                    } disabled:opacity-75`}
                  >
                    {isNudged ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <Flame className="w-3 h-3 fill-flame-500" />
                    )}
                    <span>{isNudged ? statusText : 'Nudge'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer / Dismiss */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span>In-app notifications sent</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs font-bold text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
};
