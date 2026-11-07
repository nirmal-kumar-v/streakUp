import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { fetchPublicProfile, PublicProfile } from '../api/user';
import { sendFriendRequest, acceptFriendRequest, removeFriend } from '../api/friends';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgeContext';
import { useToast } from '../context/ToastContext';
import {
  Flame,
  Trophy,
  CheckCircle2,
  Calendar,
  UserPlus,
  Check,
  Clock,
  ArrowLeft,
  User as UserIcon,
  Award,
  UserMinus,
  Users,
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { ConfirmModal } from '../components/ConfirmModal';
import { extractErrorMessage } from '../utils/error';
import { PremiumStreakMedal } from '../components/PremiumStreakMedal';
import {
  getStreakMilestones,
  isMilestoneUnlocked,
  openStreakMilestoneModal,
} from '../utils/streakMilestones';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { decrementFriendRequests } = useBadges();
  const toast = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const loadProfile = async () => {
    if (!username) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetchPublicProfile(username);
      if (res.success && res.profile) {
        setProfile(res.profile);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, `User @${username} was not found.`));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  // Open modal if user arrived via a badge share link (?badge=50)
  useEffect(() => {
    if (profile) {
      const badgeParam = searchParams.get('badge') || searchParams.get('milestone');
      if (badgeParam) {
        const days = parseInt(badgeParam, 10);
        if (!isNaN(days) && days > 0) {
          openStreakMilestoneModal({
            currentStreak: profile.currentStreak,
            longestStreak: profile.longestStreak,
            userName: profile.name,
            userHandle: profile.username,
            targetMilestoneDays: days,
            isOwner: profile.relationshipStatus === 'SELF',
          });
        }
      }
    }
  }, [profile, searchParams]);

  // Compute profile milestones
  const allMilestones = useMemo(() => {
    if (!profile) return [];
    return getStreakMilestones(Math.max(profile.currentStreak || 0, profile.longestStreak || 0));
  }, [profile]);

  const unlockedBadgesCount = useMemo(() => {
    if (!profile) return 0;
    return allMilestones.filter((m) =>
      isMilestoneUnlocked(m.days, profile.currentStreak || 0, profile.longestStreak || 0)
    ).length;
  }, [allMilestones, profile]);

  const handleAddFriend = async () => {
    if (!profile || isActionPending) return;
    setIsActionPending(true);

    const prevStatus = profile.relationshipStatus;
    // 1. Optimistic UI: immediately set status
    setProfile({ ...profile, relationshipStatus: 'REQUEST_SENT' });
    toast.success('Friend request sent');

    try {
      const res = await sendFriendRequest(profile.id);
      if (!res.success) throw new Error(res.message);
    } catch (err: any) {
      setProfile({ ...profile, relationshipStatus: prevStatus });
      toast.error(extractErrorMessage(err, 'Failed to send friend request. Please try again.'));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile || !profile.requestId || isActionPending) return;
    setIsActionPending(true);

    const prevStatus = profile.relationshipStatus;
    const prevCount = profile.connectionsCount ?? 0;
    // 1. Optimistic UI: immediately set friends, increment connections count & decrement navbar badge
    setProfile({
      ...profile,
      relationshipStatus: 'FRIENDS',
      connectionsCount: prevCount + 1,
    });
    decrementFriendRequests();
    toast.success(`You're now friends with @${profile.username}`);

    try {
      const res = await acceptFriendRequest(profile.requestId);
      if (!res.success) throw new Error(res.message);
    } catch (err: any) {
      setProfile({ ...profile, relationshipStatus: prevStatus });
      toast.error(extractErrorMessage(err, 'Failed to accept friend request. Please try again.'));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!profile) return;
    setShowRemoveConfirm(false);
    setIsActionPending(true);
    const prevStatus = profile.relationshipStatus;
    const prevCount = profile.connectionsCount ?? 0;
    setProfile({
      ...profile,
      relationshipStatus: 'NONE',
      connectionsCount: Math.max(0, prevCount - 1),
    });
    toast.info(`Removed @${profile.username} from friends`);

    try {
      const res = await removeFriend(profile.id);
      if (!res.success) throw new Error(res.message || 'Failed to remove friend');
    } catch (err: any) {
      setProfile({ ...profile, relationshipStatus: prevStatus });
      toast.error(extractErrorMessage(err, 'Failed to remove friend. Please try again.'));
    } finally {
      setIsActionPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-dark-muted">
        <div className="inline-flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          Loading user profile...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel">
          <UserIcon className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
          <h2 className="text-lg font-bold text-zinc-100">User Not Found</h2>
          <p className="text-xs text-dark-muted mt-1">{error || 'This user does not exist.'}</p>
          <Link
            to="/leaderboard/friends"
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-flame-400 hover:text-flame-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(profile.memberSince).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Back Link */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/leaderboard/friends"
          className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaderboard
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar */}
          <InitialsAvatar
            name={profile.name}
            image={profile.profileImage}
            size="2xl"
            className="border-2 border-flame-500/40 shadow-lg shadow-flame-500/10 shrink-0"
          />

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight truncate">
              {profile.name}
            </h1>
            <p className="text-sm text-flame-400 font-mono mt-0.5">@{profile.username}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-dark-muted mt-2 font-mono">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-dark-muted" />
                <span>Joined {formattedDate}</span>
              </div>
              <span className="text-zinc-700 hidden sm:inline">•</span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 font-semibold shadow-sm">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {profile.connectionsCount ?? 0}{' '}
                  {profile.connectionsCount === 1 ? 'Connection' : 'Connections'}
                </span>
              </div>
            </div>

            {/* Friend Action Button */}
            <div className="mt-5">
              {profile.relationshipStatus === 'SELF' ? (
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border text-xs font-semibold text-zinc-300 rounded-xl hover:text-zinc-100 hover:border-zinc-700 transition-colors"
                >
                  Edit Your Profile
                </Link>
              ) : profile.relationshipStatus === 'FRIENDS' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                    <Check className="w-3.5 h-3.5 stroke-[3]" /> Friends with {profile.name.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    disabled={isActionPending}
                    title="Remove friend"
                    aria-label={`Remove ${profile.name} from friends`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/20 rounded-xl transition-all disabled:opacity-50"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ) : profile.relationshipStatus === 'REQUEST_SENT' ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-surface text-zinc-400 border border-dark-border rounded-xl text-xs font-medium">
                  <Clock className="w-4 h-4 text-amber-400" /> Friend Request Pending
                </span>
              ) : profile.relationshipStatus === 'REQUEST_RECEIVED' ? (
                <button
                  onClick={handleAcceptRequest}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl shadow-sm"
                >
                  <Check className="w-4 h-4 stroke-[3]" /> Accept Friend Request
                </button>
              ) : isAuthenticated ? (
                <button
                  onClick={handleAddFriend}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow-md shadow-flame-500/20 active:scale-95 transition-all"
                >
                  <UserPlus className="w-4 h-4" /> Add Friend
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-flame-500/10 text-flame-400 border border-flame-500/30 rounded-xl text-xs font-bold"
                >
                  Log in to Connect
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards (Requirement 9 + Connections Count) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Current Streak */}
        <div
          onClick={() =>
            openStreakMilestoneModal({
              currentStreak: profile.currentStreak,
              longestStreak: profile.longestStreak,
              userName: profile.name,
              userHandle: profile.username,
              isOwner: profile.relationshipStatus === 'SELF',
            })
          }
          className="bg-dark-card border border-dark-border hover:border-flame-500/50 transition-all rounded-2xl p-5 shadow-panel text-center cursor-pointer group"
          title="Click to view streak badges & achievements"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
            <Flame className="w-4 h-4 text-flame-500 group-hover:scale-110 transition-transform" />
            <span className="group-hover:text-flame-400 transition-colors">Current Streak</span>
          </div>
          <div className="text-3xl font-black font-mono text-flame-400 group-hover:scale-105 transition-transform inline-block">
            {profile.currentStreak}
            <span className="text-xs font-normal text-dark-muted ml-1">days</span>
          </div>
        </div>

        {/* Longest Streak */}
        <div
          onClick={() =>
            openStreakMilestoneModal({
              currentStreak: profile.currentStreak,
              longestStreak: profile.longestStreak,
              userName: profile.name,
              userHandle: profile.username,
              isOwner: profile.relationshipStatus === 'SELF',
            })
          }
          className="bg-dark-card border border-dark-border hover:border-amber-500/50 transition-all rounded-2xl p-5 shadow-panel text-center cursor-pointer group"
          title="Click to view streak badges & achievements"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
            <Trophy className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="group-hover:text-amber-300 transition-colors">Best Streak</span>
          </div>
          <div className="text-3xl font-black font-mono text-zinc-100 group-hover:text-amber-200 transition-colors">
            {profile.longestStreak}
            <span className="text-xs font-normal text-dark-muted ml-1">days</span>
          </div>
        </div>

        {/* Accountability Points */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Total Points</span>
          </div>
          <div
            className={`text-3xl font-black font-mono ${
              (profile.points ?? 0) > 0
                ? 'text-emerald-400'
                : (profile.points ?? 0) < 0
                ? 'text-rose-400'
                : 'text-zinc-100'
            }`}
          >
            {(profile.points ?? 0) > 0 ? `+${profile.points}` : (profile.points ?? 0)}
            <span className="text-xs font-normal text-dark-muted ml-1">pts</span>
          </div>
        </div>

        {/* Total Tasks Done */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Tasks Done</span>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400">
            {profile.totalCompletedTasks}
          </div>
        </div>

        {/* Connections Count */}
        <div className="bg-dark-card border border-dark-border hover:border-cyan-500/30 transition-all rounded-2xl p-5 shadow-panel text-center col-span-2 sm:col-span-1">
          <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Connections</span>
          </div>
          <div className="text-3xl font-black font-mono text-cyan-400">
            {profile.connectionsCount ?? 0}
            <span className="text-xs font-normal text-dark-muted ml-1">
              {profile.connectionsCount === 1 ? 'friend' : 'friends'}
            </span>
          </div>
        </div>
      </div>

      {/* Streak Badges & Milestones Showcase (Requirement: seen by friends on profile page) */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-flame-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Streak Badges & Milestones</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Official
                </span>
              </h3>
              <p className="text-xs text-dark-muted">
                Official milestone badges unlocked for unbroken consistency. Click any badge to view card & share.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
              {unlockedBadgesCount} / {allMilestones.length} Badges Unlocked
            </span>
          </div>
        </div>

        {/* Milestone Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3.5 pt-1">
          {allMilestones.map((milestone) => {
            const unlocked = isMilestoneUnlocked(milestone.days, profile.currentStreak, profile.longestStreak);
            const isActive = profile.currentStreak >= milestone.days;

            return (
              <button
                key={milestone.days}
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (!unlocked) return;
                  openStreakMilestoneModal({
                    currentStreak: profile.currentStreak,
                    longestStreak: profile.longestStreak,
                    userName: profile.name,
                    userHandle: profile.username,
                    targetMilestoneDays: milestone.days,
                    isOwner: profile.relationshipStatus === 'SELF',
                  });
                }}
                className={`relative p-4 rounded-2xl border text-center flex flex-col items-center justify-between gap-3 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/40 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 hover:scale-[1.03] cursor-pointer group'
                    : unlocked
                    ? 'bg-dark-surface/80 border-dark-border hover:border-amber-500/40 hover:scale-[1.03] cursor-pointer group'
                    : 'bg-dark-bg/40 border-dark-border/40 opacity-50 cursor-not-allowed select-none'
                }`}
              >
                {/* 3D Medal */}
                <div className="py-1">
                  <PremiumStreakMedal
                    days={milestone.days}
                    tier={milestone.tier}
                    size="md"
                    isLocked={!unlocked}
                  />
                </div>

                {/* Details */}
                <div className="space-y-1 w-full">
                  <span className="text-xs font-bold text-zinc-100 block truncate group-hover:text-amber-300 transition-colors">
                    {milestone.title}
                  </span>

                  <div className="flex items-center justify-center">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <Flame className="w-2.5 h-2.5 fill-emerald-400" />
                        <span>Active Flame</span>
                      </span>
                    ) : unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <Check className="w-2.5 h-2.5 text-amber-400" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 rounded-full">
                        <span>{milestone.days}d goal</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* In-app Friend Removal Confirmation Dialog */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        title="Remove Friend"
        message={`Are you sure you want to remove ${profile.name} (@${profile.username}) from your friends list? They will no longer appear on your friends leaderboard.`}
        confirmText="Remove Friend"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleRemoveFriend}
        onClose={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
};
