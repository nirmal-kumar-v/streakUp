import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  ShieldAlert,
  Shield,
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { ConfirmModal } from '../components/ConfirmModal';
import { extractErrorMessage } from '../utils/error';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();
  const { decrementFriendRequests } = useBadges();
  const toast = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [captureBlockedFlash, setCaptureBlockedFlash] = useState(false);

  const isSelf = profile?.relationshipStatus === 'SELF';
  const isFriendView = Boolean(profile && !isSelf);

  // Anti-screenshot and privacy protection for friend's profile view
  useEffect(() => {
    if (!isFriendView) {
      setIsWindowBlurred(false);
      setCaptureBlockedFlash(false);
      return;
    }

    const triggerBlock = (msg?: string) => {
      setCaptureBlockedFlash(true);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(
          '⚠️ Screenshot restricted: Friend profile details on StreakUp are protected for member privacy.'
        ).catch(() => {});
      }
      toast.error(msg || 'Screen captures are restricted on friend profiles for privacy.');
      setTimeout(() => setCaptureBlockedFlash(false), 2500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        triggerBlock('Screenshot attempt blocked: Friend profiles are protected.');
        return;
      }
      // Win+Shift+S, Ctrl+Shift+S, or Cmd+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        triggerBlock('Screen capture shortcut blocked: Friend profiles are protected.');
        return;
      }
      // Print shortcut Ctrl+P or Cmd+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        triggerBlock('Printing friend profiles is disabled.');
        return;
      }
    };

    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setTimeout(() => {
        setIsWindowBlurred(false);
      }, 150);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsWindowBlurred(true);
      } else {
        setTimeout(() => setIsWindowBlurred(false), 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isFriendView, toast]);

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
    // 1. Optimistic UI: immediately set friends & decrement navbar badge
    setProfile({ ...profile, relationshipStatus: 'FRIENDS' });
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
    setProfile({ ...profile, relationshipStatus: 'NONE' });
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
    <div
      onContextMenu={
        isFriendView
          ? (e) => {
              e.preventDefault();
              toast.info('Right-click is disabled on friend profiles for privacy.');
            }
          : undefined
      }
      className={`max-w-2xl mx-auto space-y-6 pb-20 ${isFriendView ? 'select-none' : ''}`}
    >
      {/* Scoped Anti-Print Style */}
      {isFriendView && (
        <style>{`
          @media print {
            body * {
              display: none !important;
            }
            #friend-profile-print-curtain {
              display: flex !important;
              position: fixed !important;
              inset: 0 !important;
              background: #09090b !important;
              color: #f43f5e !important;
              align-items: center !important;
              justify-content: center !important;
              font-size: 20px !important;
              font-weight: 900 !important;
              text-align: center !important;
              padding: 24px !important;
              z-index: 99999999 !important;
            }
          }
        `}</style>
      )}

      {/* Print restriction notice */}
      <div id="friend-profile-print-curtain" className="hidden">
        ⚠️ Screen captures and printing are restricted on friend profiles for privacy.
      </div>

      {/* Floating Screenshot Blocked Banner */}
      {isFriendView && captureBlockedFlash && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-rose-600/95 text-white text-xs font-black rounded-2xl shadow-2xl flex items-center gap-2 border border-rose-400/40 animate-bounce">
          <ShieldAlert className="w-4 h-4 text-white" />
          <span>Screenshot Blocked: Friend profile details are protected</span>
        </div>
      )}

      {/* Header with Back Link & Protected Badge */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/leaderboard/friends"
          className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaderboard
        </Link>

        {isFriendView && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-full text-[11px] font-mono">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Screenshot Protected</span>
          </div>
        )}
      </div>

      {/* Protected Content Container */}
      <div className="relative">
        {/* Privacy Curtain when window is blurred / Snipping Tool active */}
        {isFriendView && isWindowBlurred && (
          <div className="absolute inset-0 bg-dark-bg/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center text-center p-6 rounded-3xl border border-amber-500/30 select-none">
            <ShieldAlert className="w-12 h-12 text-amber-400 mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-zinc-100">Screen Capture Protection Active</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm">
              Friend profile details are protected and hidden while screen capture tools are active or the window is out of focus.
            </p>
            <span className="text-[11px] text-amber-400/80 font-mono mt-3">Click window to resume viewing</span>
          </div>
        )}

        <div className={`space-y-6 ${isFriendView && isWindowBlurred ? 'filter blur-lg select-none pointer-events-none' : ''}`}>
          {/* Profile Card */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              {/* Avatar */}
              <InitialsAvatar
                name={profile.name}
                image={profile.profileImage}
                size="2xl"
                className="border-2 border-flame-500/40 shadow-lg shadow-flame-500/10 shrink-0 select-none pointer-events-none"
              />

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-zinc-100 tracking-tight truncate">
                  {profile.name}
                </h1>
                <p className="text-sm text-flame-400 font-mono mt-0.5">@{profile.username}</p>

                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-dark-muted mt-2 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-dark-muted" />
                  <span>Joined {formattedDate}</span>
                </div>

                {/* Friend Action Button */}
                <div className="mt-5">
                  {profile.relationshipStatus === 'SELF' ? (
                    <Link
                      to="/settings"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border text-xs font-semibold text-zinc-300 rounded-xl hover:text-zinc-100"
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

          {/* Stats Cards (Requirement 9) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Current Streak */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
                <Flame className="w-4 h-4 text-flame-500" />
                <span>Current Streak</span>
              </div>
              <div className="text-3xl font-black font-mono text-flame-400">
                {profile.currentStreak}
                <span className="text-xs font-normal text-dark-muted ml-1">days</span>
              </div>
            </div>

            {/* Longest Streak */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-dark-muted font-semibold uppercase tracking-wider mb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Best Streak</span>
              </div>
              <div className="text-3xl font-black font-mono text-zinc-100">
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
          </div>
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
