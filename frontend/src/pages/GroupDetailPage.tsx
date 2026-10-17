import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchGroupDetails,
  fetchGroupLeaderboards,
  leaveGroup,
  GroupDetail,
  GroupMember,
  GroupLeaderboardEntry,
} from '../api/groups';
import { InitialsAvatar } from '../components/InitialsAvatar';
import {
  Users,
  Flame,
  Award,
  KeyRound,
  Copy,
  Check,
  ArrowLeft,
  Crown,
  LogOut,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const GroupDetailPage: React.FC = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'streak' | 'points'>('streak');
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingGroup(true);
    setError(null);
    try {
      const res = await fetchGroupDetails(groupId);
      if (res.success && res.group) {
        setGroup(res.group);
        setMembers(res.group.members || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load group details.'));
    } finally {
      setIsLoadingGroup(false);
    }
  }, [groupId]);

  const loadLeaderboard = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingLeaderboard(true);
    try {
      const res = await fetchGroupLeaderboards(groupId, activeLeaderboardTab);
      if (res.success) {
        setLeaderboard(res.leaderboard || []);
      }
    } catch (err: any) {
      console.error('Failed to load group leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [groupId, activeLeaderboardTab]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleCopyCode = () => {
    if (!group?.joinCode) return;
    navigator.clipboard.writeText(group.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleLeaveGroup = async () => {
    if (!group || !groupId) return;
    const isOwner = group.userRole === 'OWNER';
    const hasOtherMembers = (group.memberCount || 1) > 1;

    let confirmMsg = `Are you sure you want to leave "${group.name}"?`;
    if (isOwner && hasOtherMembers) {
      confirmMsg += '\n\nSince you are the owner, group ownership will be automatically transferred to the next earliest member.';
    } else if (isOwner && !hasOtherMembers) {
      confirmMsg += '\n\nYou are the only member in this group. Leaving will permanently remove the group.';
    }

    if (!window.confirm(confirmMsg)) return;

    setIsLeaving(true);
    try {
      const res = await leaveGroup(groupId);
      if (res.success) {
        navigate('/groups');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to leave group.'), 'error');
      setIsLeaving(false);
    }
  };

  if (isLoadingGroup) {
    return (
      <div className="py-24 text-center text-xs text-dark-muted">
        <div className="inline-flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          Loading group details...
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel">
          <Users className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
          <h2 className="text-lg font-bold text-zinc-100">Group Not Accessible</h2>
          <p className="text-xs text-dark-muted mt-1">
            {error || 'You must be a member of this group to view its details and leaderboard.'}
          </p>
          <Link
            to="/groups"
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-flame-400 hover:text-flame-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Groups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Back Link */}
      <Link
        to="/groups"
        className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Groups
      </Link>

      {/* Group Header Card */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-flame-400 font-bold px-2 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
                Community
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  group.userRole === 'OWNER'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : group.userRole === 'ADMIN'
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {group.userRole === 'OWNER' ? <Crown className="w-2.5 h-2.5" /> : null}
                <span>{group.userRole}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              {group.name}
            </h1>

            {group.description && (
              <p className="text-xs sm:text-sm text-dark-muted max-w-2xl leading-relaxed">
                {group.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-dark-muted font-mono pt-1">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{group.memberCount} members</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
              </span>
            </div>
          </div>

          {/* Action Area: Join Code & Leave */}
          <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-dark-surface border border-dark-border">
              <div className="flex items-center gap-1.5 text-xs text-dark-muted pl-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Code:</span>
                <span className="font-mono font-bold text-zinc-100 tracking-wider">
                  {group.joinCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy join code"
                className="px-2 py-1 bg-dark-hover hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleLeaveGroup}
              disabled={isLeaving}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isLeaving ? 'Leaving...' : 'Leave Group'}</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Grid: Leaderboard & Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Group Leaderboard (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-panel">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Group Leaderboard</span>
                </h2>
                <p className="text-xs text-dark-muted mt-0.5">
                  Real-time ranking among members of "{group.name}"
                </p>
              </div>

              {/* Leaderboard View Tabs */}
              <div className="flex bg-dark-surface border border-dark-border p-1 rounded-xl self-start sm:self-center">
                <button
                  onClick={() => setActiveLeaderboardTab('streak')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    activeLeaderboardTab === 'streak'
                      ? 'bg-flame-500 text-zinc-950 shadow-sm shadow-flame-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Streak Rank</span>
                </button>
                <button
                  onClick={() => setActiveLeaderboardTab('points')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    activeLeaderboardTab === 'points'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Points Rank</span>
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            {isLoadingLeaderboard ? (
              <div className="py-16 text-center text-xs text-dark-muted">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                  Loading leaderboard...
                </div>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-xs text-dark-muted">
                No active leaderboard entries yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-dark-border text-[11px] font-bold text-dark-muted uppercase tracking-wider font-mono">
                      <th className="pb-3 pl-2 w-12">#</th>
                      <th className="pb-3">Member</th>
                      <th className="pb-3 text-center">Current Streak</th>
                      <th className="pb-3 text-center">Best Streak</th>
                      <th className="pb-3 text-right pr-2">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/60 text-xs">
                    {leaderboard.map((entry) => {
                      const isTop3 = entry.rank <= 3;
                      const medalColor =
                        entry.rank === 1
                          ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                          : entry.rank === 2
                          ? 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30'
                          : entry.rank === 3
                          ? 'text-amber-600 bg-amber-600/10 border-amber-600/30'
                          : 'text-zinc-500';

                      return (
                        <tr
                          key={entry.userId}
                          className="hover:bg-dark-surface/40 transition-colors"
                        >
                          {/* Rank */}
                          <td className="py-3 pl-2 font-mono font-bold">
                            {isTop3 ? (
                              <span
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black ${medalColor}`}
                              >
                                {entry.rank}
                              </span>
                            ) : (
                              <span className="text-zinc-500 pl-1">{entry.rank}</span>
                            )}
                          </td>

                          {/* Member */}
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <InitialsAvatar
                                name={entry.name}
                                image={entry.profileImage}
                                size="sm"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to={`/profile/${entry.username}`}
                                    className="font-bold text-zinc-100 hover:text-flame-400 transition-colors"
                                  >
                                    {entry.name}
                                  </Link>
                                  {entry.role === 'OWNER' && (
                                    <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                  )}
                                </div>
                                <span className="text-[11px] text-dark-muted font-mono">
                                  @{entry.username}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Current Streak */}
                          <td className="py-3 text-center">
                            <span className="font-mono font-bold text-flame-400 inline-flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 fill-flame-500" />
                              <span>{entry.currentStreak}d</span>
                            </span>
                          </td>

                          {/* Best Streak */}
                          <td className="py-3 text-center font-mono text-zinc-300">
                            {entry.longestStreak}d
                          </td>

                          {/* Total Points */}
                          <td className="py-3 text-right pr-2">
                            <span
                              className={`font-mono font-bold ${
                                entry.points > 0
                                  ? 'text-emerald-400'
                                  : entry.points < 0
                                  ? 'text-rose-400'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {entry.points > 0 ? `+${entry.points}` : entry.points} pts
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Members List */}
        <div className="space-y-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-panel">
            <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-flame-400" />
              <span>Members ({members.length})</span>
            </h3>

            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 bg-dark-surface/50 border border-dark-border rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <InitialsAvatar
                      name={member.name}
                      image={member.profileImage}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${member.username}`}
                        className="text-xs font-bold text-zinc-100 hover:text-flame-400 transition-colors truncate block"
                      >
                        {member.name}
                      </Link>
                      <p className="text-[10px] text-dark-muted font-mono truncate">
                        @{member.username}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      member.role === 'OWNER'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : member.role === 'ADMIN'
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
