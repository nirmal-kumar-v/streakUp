import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicProfile, PublicProfile } from '../api/user';
import { sendFriendRequest, acceptFriendRequest } from '../api/friends';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { extractErrorMessage } from '../utils/error';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

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
    if (!profile) return;
    try {
      const res = await sendFriendRequest(profile.id);
      if (res.success) {
        setActionFeedback('Friend request sent!');
        setProfile({ ...profile, relationshipStatus: 'REQUEST_SENT' });
      }
    } catch (err: any) {
      setActionFeedback(err.response?.data?.error || 'Failed to send friend request.');
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile || !profile.requestId) return;
    try {
      const res = await acceptFriendRequest(profile.requestId);
      if (res.success) {
        setActionFeedback('Friend request accepted!');
        setProfile({ ...profile, relationshipStatus: 'FRIENDS' });
      }
    } catch (err: any) {
      setActionFeedback(err.response?.data?.error || 'Failed to accept friend request.');
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
            to="/leaderboard/global"
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
      <Link
        to="/leaderboard/global"
        className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaderboard
      </Link>

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
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                  <Check className="w-4 h-4 stroke-[3]" /> Friends with {profile.name.split(' ')[0]}
                </span>
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

              {actionFeedback && (
                <p className="text-xs text-amber-300 mt-2 font-medium">{actionFeedback}</p>
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
  );
};
