import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  updateGroup,
  updateMemberGroupPrivacy,
  makeGroupTask,
  removeGroupTask,
  inviteToGroup,
  GroupDetail,
  GroupLeaderboardEntry,
  GroupNoteItem,
  GroupJoinRequestItem,
} from '../api/groups';
import { completeTask, updateTask } from '../api/tasks';
import { sendFriendRequest, fetchFriendsList, FriendUser } from '../api/friends';
import { toggleStudyNoteReaction, EmojiType } from '../api/reactions';
import { useToast } from '../context/ToastContext';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { TaskCompletionModal } from '../components/TaskCompletionModal';
import { triggerStreakCelebration } from '../components/StreakCelebration';
import { triggerPostCompletionNudge } from '../components/PostCompletionNudge';
import { useBodyScrollLock } from '../utils/scrollLock';
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
  ThumbsUp,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  X,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const GroupDetailPage: React.FC = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'task' | 'leaderboard' | 'notes' | 'admin'>('task');

  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
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

  // Feedback, Confirmation & Copy State
  const toast = useToast();
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmPromoteUserId, setConfirmPromoteUserId] = useState<string | null>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Edit Group Modal State
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editScheduledDays, setEditScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Invite Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [friendsList, setFriendsList] = useState<FriendUser[]>([]);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Group & Task Privacy Modal State
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [ownerGroupHiddenFrom, setOwnerGroupHiddenFrom] = useState<string[]>([]);
  const [ownerGroupHideInput, setOwnerGroupHideInput] = useState('');
  const [ownerGroupSuggestionsOpen, setOwnerGroupSuggestionsOpen] = useState(false);

  const [memberPrivacyHiddenFrom, setMemberPrivacyHiddenFrom] = useState<string[]>([]);
  const [memberPrivacyHideInput, setMemberPrivacyHideInput] = useState('');
  const [memberPrivacySuggestionsOpen, setMemberPrivacySuggestionsOpen] = useState(false);

  const [privacyHiddenFrom, setPrivacyHiddenFrom] = useState<string[]>([]);
  const [privacyVisibleOnlyTo, setPrivacyVisibleOnlyTo] = useState<string[]>([]);
  const [privacyHideInput, setPrivacyHideInput] = useState('');
  const [privacyShowInput, setPrivacyShowInput] = useState('');
  const [taskPrivacyHideSuggestionsOpen, setTaskPrivacyHideSuggestionsOpen] = useState(false);
  const [taskPrivacyShowSuggestionsOpen, setTaskPrivacyShowSuggestionsOpen] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Task toggle loading
  const [isTogglingTask, setIsTogglingTask] = useState(false);

  useBodyScrollLock(isCompletionModalOpen || isEditGroupOpen || isInviteOpen || isPrivacyModalOpen);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(text);
    } else {
      toast.info(text);
    }
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openEditGroup = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditScheduledDays(group.scheduledDays || [0, 1, 2, 3, 4, 5, 6]);
    setIsEditGroupOpen(true);
  };

  const toggleEditDay = (day: number) => {
    if (editScheduledDays.includes(day)) {
      if (editScheduledDays.length <= 1) {
        showFeedback('At least one day must be scheduled', 'error');
        return;
      }
      setEditScheduledDays(editScheduledDays.filter((d) => d !== day));
    } else {
      setEditScheduledDays([...editScheduledDays, day].sort((a, b) => a - b));
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !editName.trim()) return;
    if (editScheduledDays.length === 0) {
      showFeedback('Select at least one active day for this group', 'error');
      return;
    }
    setIsSavingGroup(true);
    try {
      const res = await updateGroup(groupId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        scheduledDays: editScheduledDays,
      });
      if (res.success) {
        setIsEditGroupOpen(false);
        showFeedback('Group updated successfully!');
        loadGroupDetails(true);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to update group.'), 'error');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleMakeGroupTask = async () => {
    if (!groupId) return;
    setIsTogglingTask(true);
    try {
      const res = await makeGroupTask(groupId);
      if (res.success) {
        showFeedback(res.message || 'Group task is now active on your dashboard!');
        loadGroupDetails(true);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to add group task to dashboard.'), 'error');
    } finally {
      setIsTogglingTask(false);
    }
  };

  const handleRemoveFromDashboard = async () => {
    if (!groupId) return;
    setIsTogglingTask(true);
    try {
      const res = await removeGroupTask(groupId);
      if (res.success) {
        showFeedback(res.message || 'Group task removed from your dashboard.');
        loadGroupDetails(true);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to remove group task.'), 'error');
    } finally {
      setIsTogglingTask(false);
    }
  };

  const openInviteModal = () => {
    setIsInviteOpen(true);
    fetchFriendsList()
      .then((res) => {
        if (res.success && res.friends) {
          setFriendsList(res.friends);
        }
      })
      .catch(() => {});
  };

  const handleSendInvite = async (target: { userId?: string; username?: string }) => {
    if (!groupId) return;
    setIsSendingInvite(true);
    try {
      const res = await inviteToGroup(groupId, {
        inviteeUserId: target.userId,
        inviteeUsername: target.username,
      });
      if (res.success) {
        showFeedback(res.message || 'Invitation sent successfully!');
        if (target.userId) {
          setInvitedUserIds((prev) => new Set([...prev, target.userId!]));
        }
        setInviteInput('');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to send group invitation.'), 'error');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const openPrivacyModal = () => {
    if (!group) return;
    setOwnerGroupHiddenFrom(group.groupHiddenFrom || []);
    setMemberPrivacyHiddenFrom(group.memberHiddenFrom || []);
    setPrivacyHiddenFrom(group.userTask?.hiddenFrom || []);
    setPrivacyVisibleOnlyTo(group.userTask?.visibleOnlyTo || []);
    setOwnerGroupHideInput('');
    setMemberPrivacyHideInput('');
    setPrivacyHideInput('');
    setPrivacyShowInput('');
    setIsPrivacyModalOpen(true);
    fetchFriendsList()
      .then((res) => {
        if (res.success && res.friends) {
          setFriendsList(res.friends);
        }
      })
      .catch(() => {});
  };

  const addOwnerGroupHide = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!ownerGroupHiddenFrom.includes(clean)) {
      setOwnerGroupHiddenFrom([...ownerGroupHiddenFrom, clean]);
    }
    setOwnerGroupHideInput('');
  };

  const removeOwnerGroupHide = (name: string) => {
    setOwnerGroupHiddenFrom(ownerGroupHiddenFrom.filter((h) => h !== name));
  };

  const addMemberPrivacyHide = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!memberPrivacyHiddenFrom.includes(clean)) {
      setMemberPrivacyHiddenFrom([...memberPrivacyHiddenFrom, clean]);
    }
    setMemberPrivacyHideInput('');
  };

  const removeMemberPrivacyHide = (name: string) => {
    setMemberPrivacyHiddenFrom(memberPrivacyHiddenFrom.filter((h) => h !== name));
  };

  const addPrivacyHideFrom = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!privacyHiddenFrom.includes(clean)) {
      setPrivacyHiddenFrom([...privacyHiddenFrom, clean]);
    }
    setPrivacyHideInput('');
  };

  const removePrivacyHideFrom = (name: string) => {
    setPrivacyHiddenFrom(privacyHiddenFrom.filter((h) => h !== name));
  };

  const addPrivacyVisibleOnlyTo = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    if (!privacyVisibleOnlyTo.includes(clean)) {
      setPrivacyVisibleOnlyTo([...privacyVisibleOnlyTo, clean]);
    }
    setPrivacyShowInput('');
  };

  const removePrivacyVisibleOnlyTo = (name: string) => {
    setPrivacyVisibleOnlyTo(privacyVisibleOnlyTo.filter((v) => v !== name));
  };

  // Autocomplete suggestion memos
  const filteredOwnerGroupSuggestions = useMemo(() => {
    const q = ownerGroupHideInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; isAll?: boolean; image?: string | null }> = [];
    if ('all'.startsWith(q) || 'everyone'.startsWith(q)) {
      list.push({ id: 'all', label: 'all', sublabel: 'Hide group & tasks from everyone', isAll: true });
    }
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !ownerGroupHiddenFrom.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [ownerGroupHideInput, friendsList, ownerGroupHiddenFrom]);

  const filteredMemberPrivacySuggestions = useMemo(() => {
    const q = memberPrivacyHideInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; image?: string | null }> = [];
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !memberPrivacyHiddenFrom.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [memberPrivacyHideInput, friendsList, memberPrivacyHiddenFrom]);

  const filteredTaskHideSuggestions = useMemo(() => {
    const q = privacyHideInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; isAll?: boolean; image?: string | null }> = [];
    if ('all'.startsWith(q) || 'everyone'.startsWith(q)) {
      list.push({ id: 'all', label: 'all', sublabel: 'Hide from everyone', isAll: true });
    }
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !privacyHiddenFrom.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [privacyHideInput, friendsList, privacyHiddenFrom]);

  const filteredTaskShowSuggestions = useMemo(() => {
    const q = privacyShowInput.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    const list: Array<{ id: string; label: string; sublabel?: string; image?: string | null }> = [];
    friendsList.forEach((f) => {
      const u = f.username.toLowerCase();
      const n = (f.name || '').toLowerCase();
      if ((u.includes(q) || n.includes(q)) && !privacyVisibleOnlyTo.includes(u)) {
        list.push({ id: f.id, label: f.username, sublabel: f.name, image: f.profileImage });
      }
    });
    return list.slice(0, 6);
  }, [privacyShowInput, friendsList, privacyVisibleOnlyTo]);

  const handleSavePrivacy = async () => {
    if (!groupId) return;
    setIsSavingPrivacy(true);
    try {
      if (isOwner) {
        await updateGroup(groupId, { hiddenFrom: ownerGroupHiddenFrom });
      }
      await updateMemberGroupPrivacy(groupId, memberPrivacyHiddenFrom);
      if (group?.userTask?.id) {
        await updateTask(group.userTask.id, {
          hiddenFrom: privacyHiddenFrom,
          visibleOnlyTo: privacyVisibleOnlyTo,
        });
      }
      setIsPrivacyModalOpen(false);
      showFeedback('Privacy settings updated successfully!');
      loadGroupDetails(true);
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to update privacy settings.'), 'error');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const loadGroupDetails = useCallback(async (isSilent = false) => {
    if (!groupId) return;
    if (!isSilent) setIsLoadingGroup(true);
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
      const res = await fetchGroupLeaderboard(groupId, 'streak');
      if (res.success) {
        setLeaderboard(res.leaderboard || []);
      }
    } catch (err: any) {
      console.error('Failed to load group leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [groupId]);

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
  }, [activeMainTab, loadLeaderboard, loadNotes, loadJoinRequests, group?.isAdmin]);

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

        // 1. Duolingo/LeetCode inspired streak celebration animation
        triggerStreakCelebration({
          newStreak: res.streak?.currentStreak,
        });

        // 2. Compact friend accountability nudge reminder
        triggerPostCompletionNudge({
          taskId: group.userTask.id,
          taskTitle: group.userTask.title,
        });

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
    const prevStatus = leaderboard.find((entry) => entry.userId === targetUserId)?.friendshipStatus;
    // Optimistic update
    setLeaderboard((prev) =>
      prev.map((entry) =>
        entry.userId === targetUserId ? { ...entry, friendshipStatus: 'REQUEST_SENT' } : entry
      )
    );
    toast.info('Request sent');

    try {
      const res = await sendFriendRequest(targetUserId);
      if (!res.success) throw new Error(res.message || 'Failed to send friend request.');
    } catch (err: any) {
      // Rollback
      setLeaderboard((prev) =>
        prev.map((entry) =>
          entry.userId === targetUserId ? { ...entry, friendshipStatus: prevStatus || 'NONE' } : entry
        )
      );
      toast.error(extractErrorMessage(err, 'Failed to send friend request.'));
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
      toast.error(extractErrorMessage(err, 'Failed to toggle reaction.'));
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    if (!groupId) return;
    setActionLoadingId(requestId);
    try {
      const res = await respondToJoinRequest(groupId, requestId, action);
      if (res.success) {
        toast.info(res.message);
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        loadGroupDetails();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to respond to request.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const executePromoteToAdmin = async (targetUserId: string) => {
    if (!groupId) return;
    setActionLoadingId(targetUserId);
    setConfirmPromoteUserId(null);
    try {
      const res = await promoteMemberToAdmin(groupId, targetUserId);
      if (res.success) {
        toast.info(res.message || 'Member promoted to Admin.');
        loadGroupDetails();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to promote member.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const executeRemoveMember = async (targetUserId: string) => {
    if (!groupId) return;
    setActionLoadingId(targetUserId);
    setConfirmRemoveUserId(null);
    try {
      const res = await removeMemberFromGroup(groupId, targetUserId);
      if (res.success) {
        toast.info(res.message || 'Member removed from group.');
        loadGroupDetails();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to remove member.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const executeLeaveGroup = async () => {
    if (!group || !groupId) return;
    setIsLeaving(true);
    setConfirmLeaveOpen(false);
    try {
      const res = await leaveGroup(groupId);
      if (res.success) {
        toast.info(`Left "${group.name}".`);
        navigate('/groups');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to leave group.'));
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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-flame-400 font-bold px-2.5 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
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

              {/* Group Code Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/80 text-xs">
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span className="font-mono font-bold text-zinc-200 tracking-wider text-[11px]">
                  {group.joinCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy code"
                  className="text-zinc-400 hover:text-white ml-0.5 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
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

          {/* Action Area: Invite, Edit Group (if Owner), Leave */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={openInviteModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Invite</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={openEditGroup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-flame-400" />
                <span>Edit Group</span>
              </button>
            )}

            {confirmLeaveOpen ? (
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                <span className="text-rose-200 text-[11px] font-medium px-1">
                  Leave group?
                </span>
                <button
                  type="button"
                  onClick={executeLeaveGroup}
                  disabled={isLeaving}
                  className="px-2.5 py-1 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  {isLeaving ? '...' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLeaveOpen(false)}
                  className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            )}
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
          <span>Task Notes & Likes</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-dark-border/60">
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

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Dashboard Task Link Status / Toggle */}
                  {group.hasActiveDashboardTask ? (
                    <div className="inline-flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/80 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-200 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Active on Dashboard</span>
                      <button
                        type="button"
                        onClick={handleRemoveFromDashboard}
                        disabled={isTogglingTask}
                        className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors ml-1 font-mono cursor-pointer"
                        title="Remove from dashboard without leaving group"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMakeGroupTask}
                      disabled={isTogglingTask}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Make this group as task</span>
                    </button>
                  )}

                  {/* Task & Group Privacy Config */}
                  <button
                    type="button"
                    onClick={openPrivacyModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/80 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    title="Privacy & Visibility Settings"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Privacy</span>
                  </button>

                  {/* Freeze Status Badge */}
                  {userTask && (
                    <div
                      title={
                        userTask.freezeBalance > 0
                          ? '1 Freeze available for this group task'
                          : `Recharge: ${userTask.freezeRechargeDays}/7 qualifying days`
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${
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
                Ranked by active consecutive group task streaks
              </p>
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
                    <th className="pb-3 text-center">Current Streak</th>
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

                        {/* Current Streak */}
                        <td className="py-3.5 text-center">
                          <span className="font-mono font-bold text-flame-400 inline-flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-flame-500" />
                            <span>{entry.currentStreak}d</span>
                          </span>
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
                const hasLiked = note.userReactions?.includes('LIKE') || (note.userReactions && note.userReactions.length > 0);
                const likeCount = (note.reactionCounts?.LIKE || 0) +
                  (note.reactionCounts?.FIRE || 0) +
                  (note.reactionCounts?.STRONG || 0) +
                  (note.reactionCounts?.CLAP || 0) +
                  (note.reactionCounts?.CELEBRATE || 0);

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

                    {/* Reactions Bar - Like Only (No Emoji, No Dislike) */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-dark-border/40">
                      <button
                        type="button"
                        onClick={() => handleReaction(note.id, 'LIKE')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 touch-manipulation select-none ${
                          hasLiked
                            ? 'bg-flame-500/15 border border-flame-500/40 text-flame-400 shadow-sm shadow-flame-500/10'
                            : 'bg-dark-surface border border-dark-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                        title={hasLiked ? 'Unlike' : 'Like'}
                        aria-label={hasLiked ? 'Unlike note' : 'Like note'}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-flame-400 text-flame-400' : 'text-zinc-400'}`} />
                        <span>Like</span>
                        {likeCount > 0 && (
                          <span className={`text-[11px] font-mono font-bold ${hasLiked ? 'text-flame-400' : 'text-zinc-400'}`}>
                            {likeCount}
                          </span>
                        )}
                      </button>
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
                        confirmPromoteUserId === member.id ? (
                          <div className="flex items-center gap-1.5 p-1 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs">
                            <span className="text-purple-300 text-[11px] px-1 font-medium">Promote?</span>
                            <button
                              type="button"
                              onClick={() => executePromoteToAdmin(member.id)}
                              disabled={actionLoadingId === member.id}
                              className="px-2 py-0.5 bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold rounded-lg text-xs"
                            >
                              {actionLoadingId === member.id ? '...' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmPromoteUserId(null)}
                              className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmPromoteUserId(member.id)}
                            disabled={actionLoadingId === member.id}
                            className="px-3 py-1 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs text-zinc-300 hover:text-white rounded-xl"
                          >
                            Promote to Admin
                          </button>
                        )
                      )}

                      {/* Remove Member: Strictly Owner Only! */}
                      {isOwner && !isTargetOwner && (
                        confirmRemoveUserId === member.id ? (
                          <div className="flex items-center gap-1.5 p-1 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs">
                            <span className="text-rose-300 text-[11px] px-1 font-medium">Remove {member.name}?</span>
                            <button
                              type="button"
                              onClick={() => executeRemoveMember(member.id)}
                              disabled={actionLoadingId === member.id}
                              className="px-2 py-0.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs"
                            >
                              {actionLoadingId === member.id ? '...' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveUserId(null)}
                              className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveUserId(member.id)}
                            disabled={actionLoadingId === member.id}
                            className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl"
                          >
                            Remove
                          </button>
                        )
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

      {/* Edit Group Modal (Owner only) */}
      {isEditGroupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-flame-500/10 border border-flame-500/20 flex items-center justify-center text-flame-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100">Edit Group Details</h2>
                  <p className="text-xs text-dark-muted">Modify name, description, and habit frequency</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditGroupOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-dark-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Group Name <span className="text-flame-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Group Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={300}
                  className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Day Frequency <span className="text-flame-400">*</span>
                </label>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {[
                    { day: 0, label: 'Sun' },
                    { day: 1, label: 'Mon' },
                    { day: 2, label: 'Tue' },
                    { day: 3, label: 'Wed' },
                    { day: 4, label: 'Thu' },
                    { day: 5, label: 'Fri' },
                    { day: 6, label: 'Sat' },
                  ].map((w) => {
                    const isSelected = editScheduledDays.includes(w.day);
                    return (
                      <button
                        key={w.day}
                        type="button"
                        onClick={() => toggleEditDay(w.day)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-flame-500/15 border-flame-500/40 text-flame-300'
                            : 'bg-dark-surface border-dark-border text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-dark-muted">
                  <span>
                    Selected: <strong className="text-zinc-200">{editScheduledDays.length} day{editScheduledDays.length === 1 ? '' : 's'}/week</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditScheduledDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-flame-400 hover:underline cursor-pointer"
                    >
                      Every day
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScheduledDays([1, 2, 3, 4, 5])}
                      className="text-flame-400 hover:underline cursor-pointer"
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScheduledDays([1])}
                      className="text-flame-400 hover:underline cursor-pointer"
                    >
                      Monday only
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setIsEditGroupOpen(false)}
                  disabled={isSavingGroup}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGroup}
                  className="px-5 py-2 text-sm bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold rounded-xl shadow-md shadow-flame-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingGroup ? 'Saving...' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Friends to Group Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100">Invite to {group.name}</h2>
                  <p className="text-xs text-dark-muted">Invite friends or search by username</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-dark-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Username Input Invite */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Invite by Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter username (e.g. alex)"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (inviteInput.trim()) {
                          handleSendInvite({ username: inviteInput.trim() });
                        }
                      }
                    }}
                    className="flex-1 px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (inviteInput.trim()) {
                        handleSendInvite({ username: inviteInput.trim() });
                      }
                    }}
                    disabled={isSendingInvite || !inviteInput.trim()}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Friends List Suggestions */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Invite from Friends
                </label>
                {friendsList.length === 0 ? (
                  <p className="text-xs text-dark-muted italic p-3 bg-dark-surface rounded-xl border border-dark-border text-center">
                    No friends found to invite. Use username above!
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {friendsList.map((f) => {
                      const isAlreadyMember = group.members.some((m) => m.id === f.id);
                      const isAlreadyInvited = invitedUserIds.has(f.id);

                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-dark-surface border border-dark-border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <InitialsAvatar name={f.name || f.username} size="sm" />
                            <div className="truncate">
                              <span className="text-xs font-bold text-zinc-200 block truncate">{f.name}</span>
                              <span className="text-[10px] text-zinc-400 font-mono">@{f.username}</span>
                            </div>
                          </div>

                          {isAlreadyMember ? (
                            <span className="text-[10px] text-zinc-500 font-medium px-2 py-1 bg-zinc-800 rounded-lg">
                              Member
                            </span>
                          ) : isAlreadyInvited ? (
                            <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg">
                              Invited ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendInvite({ userId: f.id })}
                              disabled={isSendingInvite}
                              className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Invite
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dark-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 font-medium rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group & Task Privacy Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between shrink-0 bg-dark-surface/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100">Privacy & Visibility</h2>
                  <p className="text-xs text-dark-muted">Control group discovery, member anonymity, and task sharing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-dark-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* TIER 1: Owner Control — Hide Entire Group & Group Tasks */}
              {isOwner && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Hide Group & All Tasks From</span>
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                      Owner Only
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Users added here cannot find or view this group, and cannot see ANY tasks created from this group by any member. Type username or <strong className="text-amber-400">"all"</strong>.
                  </p>

                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type username or 'all'..."
                        value={ownerGroupHideInput}
                        onChange={(e) => {
                          setOwnerGroupHideInput(e.target.value);
                          setOwnerGroupSuggestionsOpen(true);
                        }}
                        onFocus={() => setOwnerGroupSuggestionsOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addOwnerGroupHide(ownerGroupHideInput);
                            setOwnerGroupSuggestionsOpen(false);
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addOwnerGroupHide(ownerGroupHideInput);
                          setOwnerGroupSuggestionsOpen(false);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        Add
                      </button>
                    </div>

                    {ownerGroupSuggestionsOpen && filteredOwnerGroupSuggestions.length > 0 && (
                      <div className="absolute z-20 top-full mt-1.5 left-0 right-0 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-1 divide-y divide-zinc-800/60">
                        {filteredOwnerGroupSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              addOwnerGroupHide(s.label);
                              setOwnerGroupSuggestionsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {s.isAll ? (
                                <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold text-[10px]">
                                  ALL
                                </div>
                              ) : (
                                <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                              )}
                              <div className="truncate">
                                <span className="font-semibold text-zinc-200 block truncate">
                                  {s.isAll ? '"all" (Hide from everyone)' : `@${s.label}`}
                                </span>
                                {s.sublabel && !s.isAll && (
                                  <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {ownerGroupHiddenFrom.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ownerGroupHiddenFrom.map((name) => (
                        <span
                          key={name}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium border ${
                            name === 'all'
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-bold'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <span>{name === 'all' ? '🛡️ Everyone ("all")' : `@${name}`}</span>
                          <button
                            type="button"
                            onClick={() => removeOwnerGroupHide(name)}
                            className="hover:text-white p-0.5 text-zinc-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TIER 2: Member Anonymity — Hide My Presence in this Group */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <EyeOff className="w-4 h-4 text-indigo-400" />
                    <span>Hide My Profile in this Group From</span>
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                    Member Privacy
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Selected members cannot see you in this group's member list or leaderboard. The group member count shown to them will also match.
                </p>

                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type username..."
                      value={memberPrivacyHideInput}
                      onChange={(e) => {
                        setMemberPrivacyHideInput(e.target.value);
                        setMemberPrivacySuggestionsOpen(true);
                      }}
                      onFocus={() => setMemberPrivacySuggestionsOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMemberPrivacyHide(memberPrivacyHideInput);
                          setMemberPrivacySuggestionsOpen(false);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addMemberPrivacyHide(memberPrivacyHideInput);
                        setMemberPrivacySuggestionsOpen(false);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      Add
                    </button>
                  </div>

                  {memberPrivacySuggestionsOpen && filteredMemberPrivacySuggestions.length > 0 && (
                    <div className="absolute z-20 top-full mt-1.5 left-0 right-0 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-1 divide-y divide-zinc-800/60">
                      {filteredMemberPrivacySuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            addMemberPrivacyHide(s.label);
                            setMemberPrivacySuggestionsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                            <div className="truncate">
                              <span className="font-semibold text-zinc-200 block truncate">@{s.label}</span>
                              {s.sublabel && (
                                <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {memberPrivacyHiddenFrom.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {memberPrivacyHiddenFrom.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium bg-zinc-800 border border-zinc-700 text-zinc-300"
                      >
                        <span>@{name}</span>
                        <button
                          type="button"
                          onClick={() => removeMemberPrivacyHide(name)}
                          className="hover:text-white p-0.5 text-zinc-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* TIER 3: Task Activity Sharing (Only if user has active group task) */}
              {(group.hasActiveDashboardTask || group.userTask) && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>Task Activity & Notes Sharing</span>
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-semibold">
                      Friends Feed
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Control who among your friends can see your completion notes and study streaks for this group task.
                  </p>

                  {/* Hide Task Activity From */}
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                      Hide Task Activity From:
                    </label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type username or 'all'..."
                          value={privacyHideInput}
                          onChange={(e) => {
                            setPrivacyHideInput(e.target.value);
                            setTaskPrivacyHideSuggestionsOpen(true);
                          }}
                          onFocus={() => setTaskPrivacyHideSuggestionsOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addPrivacyHideFrom(privacyHideInput);
                              setTaskPrivacyHideSuggestionsOpen(false);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            addPrivacyHideFrom(privacyHideInput);
                            setTaskPrivacyHideSuggestionsOpen(false);
                          }}
                          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {taskPrivacyHideSuggestionsOpen && filteredTaskHideSuggestions.length > 0 && (
                        <div className="absolute z-20 top-full mt-1.5 left-0 right-0 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-1 divide-y divide-zinc-800/60">
                          {filteredTaskHideSuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                addPrivacyHideFrom(s.label);
                                setTaskPrivacyHideSuggestionsOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 truncate">
                                {s.isAll ? (
                                  <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold text-[10px]">
                                    ALL
                                  </div>
                                ) : (
                                  <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                                )}
                                <div className="truncate">
                                  <span className="font-semibold text-zinc-200 block truncate">
                                    {s.isAll ? '"all" (Hide from everyone)' : `@${s.label}`}
                                  </span>
                                  {s.sublabel && !s.isAll && (
                                    <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {privacyHiddenFrom.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {privacyHiddenFrom.map((name) => (
                          <span
                            key={name}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium border ${
                              name === 'all'
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-bold'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            }`}
                          >
                            <span>{name === 'all' ? '🛡️ Everyone ("all")' : `@${name}`}</span>
                            <button
                              type="button"
                              onClick={() => removePrivacyHideFrom(name)}
                              className="hover:text-white p-0.5 text-zinc-400 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Show Only To (Exclusive Whitelist) */}
                  <div className="pt-2 border-t border-zinc-800">
                    <label className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Show Only To:</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">Optional exclusive whitelist</span>
                    </label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type friend username..."
                          value={privacyShowInput}
                          onChange={(e) => {
                            setPrivacyShowInput(e.target.value);
                            setTaskPrivacyShowSuggestionsOpen(true);
                          }}
                          onFocus={() => setTaskPrivacyShowSuggestionsOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addPrivacyVisibleOnlyTo(privacyShowInput);
                              setTaskPrivacyShowSuggestionsOpen(false);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            addPrivacyVisibleOnlyTo(privacyShowInput);
                            setTaskPrivacyShowSuggestionsOpen(false);
                          }}
                          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {taskPrivacyShowSuggestionsOpen && filteredTaskShowSuggestions.length > 0 && (
                        <div className="absolute z-20 top-full mt-1.5 left-0 right-0 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-1 divide-y divide-zinc-800/60">
                          {filteredTaskShowSuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                addPrivacyVisibleOnlyTo(s.label);
                                setTaskPrivacyShowSuggestionsOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <InitialsAvatar name={s.sublabel || s.label} image={s.image} size="sm" />
                                <div className="truncate">
                                  <span className="font-semibold text-zinc-200 block truncate">@{s.label}</span>
                                  {s.sublabel && (
                                    <span className="text-[10px] text-zinc-400 block truncate">{s.sublabel}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {privacyVisibleOnlyTo.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {privacyVisibleOnlyTo.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                          >
                            <span>@{name}</span>
                            <button
                              type="button"
                              onClick={() => removePrivacyVisibleOnlyTo(name)}
                              className="hover:text-white p-0.5 text-emerald-400 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(false)}
                  disabled={isSavingPrivacy}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 font-medium rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrivacy}
                  disabled={isSavingPrivacy}
                  className="px-5 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingPrivacy ? 'Saving...' : 'Save Privacy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
