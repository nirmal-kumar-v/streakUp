import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchGroupDetails,
  fetchGroupLeaderboard,
  fetchGroupNotes,
  fetchGroupJoinRequests,
  respondToJoinRequest,
  promoteMemberToAdmin,
  removeMemberFromGroup,
  leaveGroup,
  GroupDetail,
  GroupLeaderboardEntry,
  GroupNoteItem,
  GroupJoinRequestItem,
} from '../api/groups';
import { completeTask } from '../api/tasks';
import { sendFriendRequest } from '../api/friends';
import { toggleStudyNoteReaction, EmojiType } from '../api/reactions';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { TaskCompletionModal } from '../components/TaskCompletionModal';
import {
  Users,
  Flame,
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
  Sparkles,
  Shield,
  Zap,
  UserPlus,
  UserCheck,
  Clock,
  MessageSquare,
  CheckSquare,
  ShieldAlert,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const GroupDetailPage: React.FC = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'task' | 'leaderboard' | 'notes' | 'admin'>('task');
  const [leaderboardType, setLeaderboardType] = useState<'streak' | 'weekly'>('streak');

  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [weekRange, setWeekRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [notes, setNotes] = useState<GroupNoteItem[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequestItem[]>([]);

  // Loading States
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Task Completion Modal
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Feedback & Copy State
  const [copiedCode, setCopiedCode] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingGroup(true);
    try {
      const res = await fetchGroupDetails(groupId);
      if (res.success && res.group) {
        setGroup(res.group);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to load group details.'), 'error');
    } finally {
      setIsLoadingGroup(false);
    }
  }, [groupId]);

  const loadLeaderboard = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingLeaderboard(true);
    try {
      const res = await fetchGroupLeaderboard(groupId, leaderboardType);
      if (res.success) {
        setLeaderboard(res.leaderboard || []);
        if (res.weekRange) setWeekRange(res.weekRange);
      }
    } catch (err: any) {
      console.error('Failed to load group leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [groupId, leaderboardType]);

  const loadNotes = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingNotes(true);
    try {
      const res = await fetchGroupNotes(groupId);
      if (res.success) {
        setNotes(res.notes || []);
      }
    } catch (err: any) {
      console.error('Failed to load group notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [groupId]);

  const loadJoinRequests = useCallback(async () => {
    if (!groupId || !group?.isAdmin) return;
    setIsLoadingRequests(true);
    try {
      const res = await fetchGroupJoinRequests(groupId);
      if (res.success) {
        setJoinRequests(res.requests || []);
      }
    } catch (err: any) {
      console.error('Failed to load join requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [groupId, group?.isAdmin]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  useEffect(() => {
    if (activeMainTab === 'leaderboard') {
      loadLeaderboard();
    } else if (activeMainTab === 'notes') {
      loadNotes();
    } else if (activeMainTab === 'admin' && group?.isAdmin) {
      loadJoinRequests();
    }
  }, [activeMainTab, leaderboardType, loadLeaderboard, loadNotes, loadJoinRequests, group?.isAdmin]);

  const handleCopyCode = () => {
    if (!group?.joinCode) return;
    navigator.clipboard.writeText(group.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCompleteTask = async (studyNote: string) => {
    if (!group?.userTask?.id) return;
    try {
      const res = await completeTask(group.userTask.id, studyNote);
      if (res.success) {
        showFeedback('Group task completed! Streak recorded.');
        loadGroupDetails();
        if (activeMainTab === 'notes') loadNotes();
        if (activeMainTab === 'leaderboard') loadLeaderboard();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to complete task.'), 'error');
      throw err;
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await sendFriendRequest(targetUserId);
      if (res.success) {
        showFeedback(res.message || 'Friend request sent!');
        setLeaderboard((prev) =>
          prev.map((entry) =>
            entry.userId === targetUserId ? { ...entry, friendshipStatus: 'REQUEST_SENT' } : entry
          )
        );
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to send friend request.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReaction = async (completionId: string, emoji: EmojiType) => {
    try {
      const res = await toggleStudyNoteReaction(completionId, emoji);
      if (res.success) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === completionId
              ? {
                  ...n,
                  reactionCounts: res.counts || res.reactions || n.reactionCounts,
                  userReactions: res.userReactions || [],
                }
              : n
          )
        );
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to toggle reaction.'), 'error');
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    if (!groupId) return;
    setActionLoadingId(requestId);
    try {
      const res = await respondToJoinRequest(groupId, requestId, action);
      if (res.success) {
        showFeedback(res.message);
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        loadGroupDetails();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to respond to request.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePromoteToAdmin = async (targetUserId: string) => {
    if (!groupId) return;
    if (!window.confirm('Promote this member to Group Admin?')) return;
    setActionLoadingId(targetUserId);
    try {
      const res = await promoteMemberToAdmin(groupId, targetUserId);
      if (res.success) {
        showFeedback(res.message || 'Member promoted to Admin.');
        loadGroupDetails();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to promote member.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!groupId) return;
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group? This action can only be performed by the Group Owner.`)) return;
    setActionLoadingId(targetUserId);
    try {
      const res = await removeMemberFromGroup(groupId, targetUserId);
      if (res.success) {
        showFeedback(res.message || 'Member removed from group.');
        loadGroupDetails();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to remove member.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group || !groupId) return;
    const isOwner = group.userRole === 'OWNER';
    const hasOtherMembers = (group.memberCount || 1) > 1;

    let confirmMsg = `Are you sure you want to leave "${group.name}"?`;
    if (isOwner && hasOtherMembers) {
      confirmMsg += '\n\nSince you are the owner, group ownership will automatically transfer to the next earliest Admin or member.';
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

  const formatSchedule = (days?: number[]) => {
    const d = days || [0, 1, 2, 3, 4, 5, 6];
    if (d.length === 7) return 'Every day';
    if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Weekdays';
    if (d.length === 2 && [0, 6].every((x) => d.includes(x))) return 'Weekends';
    return d.map((x) => DAY_LABELS[x]).join(', ');
  };

  if (isLoadingGroup) {
    return (
      <div className="py-24 text-center text-xs text-dark-muted">
        <div className="inline-flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          Loading group and shared habit...
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-panel">
          <Users className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
          <h2 className="text-lg font-bold text-zinc-100">Group Not Accessible</h2>
          <p className="text-xs text-dark-muted mt-1">
            You must be an accepted member of this group to view its shared task, leaderboard, and study notes.
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

  const userTask = group.userTask;
  const isOwner = group.userRole === 'OWNER';
  const isAdmin = group.userRole === 'OWNER' || group.userRole === 'ADMIN';

  return (
    <div className="space-y-6 pb-20">
      {/* Back Link */}
      <Link
        to="/groups"
        className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Groups
      </Link>

      {/* Header Banner Card */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-flame-400 font-bold px-2 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
                Shared Group Habit
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  isOwner
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : isAdmin
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {isOwner ? <Crown className="w-2.5 h-2.5" /> : isAdmin ? <Shield className="w-2.5 h-2.5" /> : null}
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

            <div className="flex items-center gap-4 text-xs text-dark-muted font-mono pt-1 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{group.memberCount} members</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-flame-400" />
                <span>Schedule: {formatSchedule(group.scheduledDays)}</span>
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
                title="Copy group unique code"
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('task')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeMainTab === 'task'
              ? 'bg-dark-card text-flame-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Shared Task</span>
        </button>

        <button
          onClick={() => setActiveMainTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeMainTab === 'leaderboard'
              ? 'bg-dark-card text-flame-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Leaderboards</span>
        </button>

        <button
          onClick={() => setActiveMainTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeMainTab === 'notes'
              ? 'bg-dark-card text-flame-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Task Notes & Reactions</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveMainTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeMainTab === 'admin'
                ? 'bg-dark-card text-amber-400 border border-dark-border shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Manage & Requests</span>
            {(group.pendingRequestsCount ?? 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold">
                {group.pendingRequestsCount}
              </span>
            )}
          </button>
        )}
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

      {/* TAB 1: SHARED TASK VIEW */}
      {activeMainTab === 'task' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Shared Task Card */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/25">
                      <Users className="w-3 h-3 text-indigo-400" />
                      <span>Group Task</span>
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      (0 pts · Streak & completion only)
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-zinc-100">{group.name}</h2>
                </div>

                {/* Freeze Status Badge */}
                {userTask && (
                  <div
                    title={
                      userTask.freezeBalance > 0
                        ? '1 Freeze available for this group task'
                        : `Recharge: ${userTask.freezeRechargeDays}/7 qualifying days`
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                      userTask.freezeBalance > 0
                        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {userTask.freezeBalance > 0 ? (
                      <>
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        <span>1 Freeze Ready</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Recharge: {userTask.freezeRechargeDays}/7d</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Individual Streak Callout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">
                <div className="p-3.5 rounded-2xl bg-dark-surface/70 border border-dark-border">
                  <span className="text-[11px] text-dark-muted font-medium block">Your Group Streak</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xl font-black text-flame-400">
                    <Flame className="w-5 h-5 fill-flame-500 text-flame-500" />
                    <span>{userTask?.currentStreak ?? 0} days</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-dark-surface/70 border border-dark-border">
                  <span className="text-[11px] text-dark-muted font-medium block">Longest Streak</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xl font-black text-zinc-200">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span>{userTask?.longestStreak ?? 0} days</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-dark-surface/70 border border-dark-border col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-dark-muted font-medium block">Schedule</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-bold text-zinc-300 truncate">
                    <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{formatSchedule(group.scheduledDays)}</span>
                  </div>
                </div>
              </div>

              {/* Completion Action Box */}
              <div className="p-5 rounded-2xl bg-dark-surface border border-dark-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-flame-400" />
                      <span>Today's Completion</span>
                    </h3>
                    <p className="text-xs text-dark-muted mt-0.5">
                      Mark the shared task complete and submit a study note for group members.
                    </p>
                  </div>

                  {userTask?.completedToday ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Completed Today</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCompletionModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-xs rounded-xl shadow-md shadow-flame-500/20 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Mark Complete</span>
                    </button>
                  )}
                </div>

                {userTask?.todayStudyNote && (
                  <div className="mt-4 pt-3 border-t border-dark-border/80">
                    <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">
                      Your note today:
                    </span>
                    <p className="text-xs text-zinc-300 italic bg-dark-card/60 p-3 rounded-xl border border-dark-border">
                      "{userTask.todayStudyNote}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Roster Sidebar */}
          <div className="space-y-4">
            <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-panel">
              <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-flame-400" />
                  <span>Members ({group.members.length})</span>
                </span>
                <button
                  onClick={() => setActiveMainTab('leaderboard')}
                  className="text-xs font-mono text-flame-400 hover:text-flame-300"
                >
                  Leaderboard →
                </button>
              </h3>

              <div className="space-y-3">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 bg-dark-surface/50 border border-dark-border rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InitialsAvatar name={member.name} image={member.profileImage} size="sm" />
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

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-flame-400 flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-flame-500" />
                        <span>{member.currentStreak}d</span>
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEADERBOARD VIEW */}
      {activeMainTab === 'leaderboard' && (
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Group Leaderboard</span>
              </h2>
              <p className="text-xs text-dark-muted mt-0.5">
                {leaderboardType === 'streak'
                  ? 'Ranked by active consecutive group task streaks'
                  : `Ranked by qualifying completions this week (${weekRange?.startDate} to ${weekRange?.endDate})`}
              </p>
            </div>

            {/* Toggle: Streak vs Weekly */}
            <div className="flex bg-dark-surface border border-dark-border p-1 rounded-xl self-start sm:self-center">
              <button
                onClick={() => setLeaderboardType('streak')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  leaderboardType === 'streak'
                    ? 'bg-flame-500 text-zinc-950 shadow-sm shadow-flame-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Streak Rank</span>
              </button>
              <button
                onClick={() => setLeaderboardType('weekly')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  leaderboardType === 'weekly'
                    ? 'bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Weekly Rank</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoadingLeaderboard ? (
            <div className="py-20 text-center text-xs text-dark-muted">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                Loading rankings...
              </div>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-xs text-dark-muted">
              No leaderboard entries yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border text-[11px] font-bold text-dark-muted uppercase tracking-wider font-mono">
                    <th className="pb-3 pl-2 w-12">#</th>
                    <th className="pb-3">Member</th>
                    <th className="pb-3 text-center">
                      {leaderboardType === 'streak' ? 'Current Streak' : 'This Week Completions'}
                    </th>
                    <th className="pb-3 text-center">Best Streak</th>
                    <th className="pb-3 text-right pr-2">Friend Action</th>
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

                    const isFriendLoading = actionLoadingId === entry.userId;

                    return (
                      <tr
                        key={entry.userId}
                        className={`hover:bg-dark-surface/40 transition-colors ${
                          entry.isCurrentUser ? 'bg-flame-500/5' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 pl-2 font-mono font-bold">
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

                        {/* Member Name & Avatar */}
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar name={entry.name} image={entry.profileImage} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Link
                                  to={`/profile/${entry.username}`}
                                  className="font-bold text-zinc-100 hover:text-flame-400 transition-colors"
                                >
                                  {entry.name}
                                </Link>
                                {entry.isCurrentUser && (
                                  <span className="text-[10px] text-flame-400 font-bold px-1.5 py-0.2 bg-flame-500/10 rounded-full">
                                    You
                                  </span>
                                )}
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

                        {/* Streak or Weekly Count */}
                        <td className="py-3.5 text-center">
                          {leaderboardType === 'streak' ? (
                            <span className="font-mono font-bold text-flame-400 inline-flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 fill-flame-500" />
                              <span>{entry.currentStreak}d</span>
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{entry.weeklyCompletions} days</span>
                            </span>
                          )}
                        </td>

                        {/* Best Streak */}
                        <td className="py-3.5 text-center font-mono text-zinc-300">
                          {entry.longestStreak}d
                        </td>

                        {/* Friend Request Action */}
                        <td className="py-3.5 text-right pr-2">
                          {entry.friendshipStatus === 'SELF' ? (
                            <span className="text-zinc-500 text-[11px] font-mono">--</span>
                          ) : entry.friendshipStatus === 'FRIENDS' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded-lg">
                              <UserCheck className="w-3 h-3" /> Friends
                            </span>
                          ) : entry.friendshipStatus === 'REQUEST_SENT' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium px-2 py-0.5 bg-amber-500/10 rounded-lg">
                              <Clock className="w-3 h-3" /> Requested
                            </span>
                          ) : entry.friendshipStatus === 'REQUEST_RECEIVED' ? (
                            <Link
                              to="/friends"
                              className="inline-flex items-center gap-1 text-[11px] text-flame-400 hover:underline"
                            >
                              Respond in Friends
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendFriendRequest(entry.userId)}
                              disabled={isFriendLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-surface hover:bg-dark-hover border border-dark-border hover:border-flame-500/50 text-zinc-200 hover:text-flame-400 rounded-lg text-xs font-semibold transition-all"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>{isFriendLoading ? '...' : 'Add Friend'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NOTES & REACTIONS */}
      {activeMainTab === 'notes' && (
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-flame-400" />
                <span>Group Completion Notes</span>
              </h2>
              <p className="text-xs text-dark-muted mt-0.5">
                Real study notes submitted by group members when completing "{group.name}"
              </p>
            </div>
          </div>

          {isLoadingNotes ? (
            <div className="py-20 text-center text-xs text-dark-muted">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                Loading notes...
              </div>
            </div>
          ) : notes.length === 0 ? (
            <div className="py-16 text-center text-xs text-dark-muted max-w-sm mx-auto">
              <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="font-semibold text-zinc-300">No study notes recorded yet.</p>
              <p className="mt-1">
                Complete the shared task and add a note to start the group discussion!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => {
                const EMOJIS: { key: EmojiType; icon: string }[] = [
                  { key: 'FIRE', icon: '🔥' },
                  { key: 'STRONG', icon: '💪' },
                  { key: 'CLAP', icon: '👏' },
                  { key: 'CELEBRATE', icon: '🎉' },
                ];

                return (
                  <div
                    key={note.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      note.isOwnNote
                        ? 'bg-flame-500/5 border-flame-500/20'
                        : 'bg-dark-surface/60 border-dark-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={note.user.name} image={note.user.profileImage} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-zinc-200">{note.user.name}</span>
                            {note.isOwnNote && (
                              <span className="text-[10px] text-flame-400 font-bold px-1.5 py-0.2 bg-flame-500/10 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-dark-muted font-mono">
                            {note.completionDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-200 mt-2 leading-relaxed bg-dark-bg/60 p-3 rounded-xl border border-dark-border/60">
                      "{note.studyNote}"
                    </p>

                    {/* Reactions Bar */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-dark-border/40">
                      {EMOJIS.map(({ key, icon }) => {
                        const count = note.reactionCounts?.[key] || 0;
                        const hasReacted = note.userReactions?.includes(key);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleReaction(note.id, key)}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                              hasReacted
                                ? 'bg-flame-500/20 border border-flame-500/40 text-flame-300 scale-105'
                                : 'bg-dark-surface border border-dark-border text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span>{icon}</span>
                            {count > 0 && <span>{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ADMIN & REQUESTS (Owner and Admin Only) */}
      {isAdmin && activeMainTab === 'admin' && (
        <div className="space-y-6">
          {/* Join Requests Card */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel">
            <h2 className="text-base font-bold text-zinc-100 mb-1 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Pending Join Requests ({joinRequests.length})</span>
            </h2>
            <p className="text-xs text-dark-muted mb-4">
              Accepting an applicant automatically adds the shared task to their checklist.
            </p>

            {isLoadingRequests ? (
              <div className="py-12 text-center text-xs text-dark-muted">
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                Loading requests...
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-dark-muted bg-dark-surface/40 rounded-2xl border border-dark-border">
                No pending join requests.
              </div>
            ) : (
              <div className="space-y-3">
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 bg-dark-surface/60 border border-dark-border rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InitialsAvatar name={req.user.name} image={req.user.profileImage} size="sm" />
                      <div>
                        <span className="text-xs font-bold text-zinc-200 block truncate">
                          {req.user.name}
                        </span>
                        <span className="text-[10px] text-dark-muted font-mono">
                          @{req.user.username} · {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRespondRequest(req.id, 'REJECT')}
                        disabled={actionLoadingId === req.id}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleRespondRequest(req.id, 'ACCEPT')}
                        disabled={actionLoadingId === req.id}
                        className="px-3.5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl shadow-sm"
                      >
                        Accept Member
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Member Management Roster */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel">
            <h2 className="text-base font-bold text-zinc-100 mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-flame-400" />
              <span>Member Roles & Permissions</span>
            </h2>
            <p className="text-xs text-dark-muted mb-4">
              Owner can promote or remove members. Admins can promote members but cannot remove members.
            </p>

            <div className="space-y-3">
              {group.members.map((member) => {
                const isTargetOwner = member.role === 'OWNER';
                const isTargetAdmin = member.role === 'ADMIN';

                return (
                  <div
                    key={member.id}
                    className="p-3.5 bg-dark-surface/60 border border-dark-border rounded-2xl flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <InitialsAvatar name={member.name} image={member.profileImage} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-200">{member.name}</span>
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.2 rounded-full border ${
                              isTargetOwner
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : isTargetAdmin
                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-dark-muted font-mono">
                          @{member.username} · Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Promote to Admin (Owner or Admin can promote normal members) */}
                      {!isTargetOwner && !isTargetAdmin && (
                        <button
                          type="button"
                          onClick={() => handlePromoteToAdmin(member.id)}
                          disabled={actionLoadingId === member.id}
                          className="px-3 py-1 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs text-zinc-300 hover:text-white rounded-xl"
                        >
                          Promote to Admin
                        </button>
                      )}

                      {/* Remove Member: Strictly Owner Only! */}
                      {isOwner && !isTargetOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          disabled={actionLoadingId === member.id}
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Task Completion Modal */}
      {userTask && (
        <TaskCompletionModal
          task={{
            id: userTask.id,
            userId: '',
            title: userTask.title,
            description: userTask.description,
            category: 'Group Task',
            priority: 'HIGH',
            recurrence: 'DAILY',
            scheduledDays: userTask.scheduledDays,
            dueTime: null,
            status: 'ACTIVE',
            completedToday: userTask.completedToday,
            todayStudyNote: userTask.todayStudyNote,
            currentStreak: userTask.currentStreak,
            longestStreak: userTask.longestStreak,
            freezeBalance: userTask.freezeBalance,
            freezeRechargeDays: userTask.freezeRechargeDays,
            groupId: group.id,
            isGroupTask: true,
            createdAt: group.createdAt,
            updatedAt: group.createdAt,
          }}
          isOpen={isCompletionModalOpen}
          onClose={() => setIsCompletionModalOpen(false)}
          onComplete={handleCompleteTask}
        />
      )}
    </div>
  );
};
