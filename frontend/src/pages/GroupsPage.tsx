import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchUserGroups,
  createGroup,
  searchGroups,
  requestToJoinGroup,
  cancelJoinRequest,
  fetchAllOwnerJoinRequests,
  fetchUserGroupInvitations,
  respondToGroupInvitation,
  respondToJoinRequest,
  GroupItem,
  GroupSearchResult,
  OwnerJoinRequestItem,
  GroupInvitationItem,
} from '../api/groups';
import {
  Users,
  Plus,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Crown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Search,
  Calendar,
  Flame,
  Send,
  XCircle,
  X,
  Inbox,
  Mail,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';
import { useBodyScrollLock } from '../utils/scrollLock';
import { InitialsAvatar } from '../components/InitialsAvatar';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const GroupsPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'my' | 'discover' | 'requests'>('my');

  // My Groups State
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  // Group Requests & Invitations State
  const [ownerRequests, setOwnerRequests] = useState<OwnerJoinRequestItem[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitationItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Discover & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupSearchResult[]>([]);
  const [isTopFive, setIsTopFive] = useState(true);
  const [discoverLimit, setDiscoverLimit] = useState(5);
  const [isSearching, setIsSearching] = useState(false);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createScheduledDays, setCreateScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isCreating, setIsCreating] = useState(false);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useBodyScrollLock(isCreateOpen || isJoinOpen);

  // General feedback
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(text);
    } else {
      toast.info(text);
    }
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadMyGroups = async () => {
    if (groups.length === 0) {
      setIsLoadingGroups(true);
    }
    try {
      const res = await fetchUserGroups();
      if (res.success) {
        setGroups(res.groups || []);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to load your groups.'), 'error');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSearch = async (queryToSearch?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : searchQuery;
    setIsSearching(true);
    try {
      const res = await searchGroups(q.trim());
      if (res.success) {
        setSearchResults(res.groups || []);
        setIsTopFive(res.isTopFive ?? !q.trim());
        if ((res as any).discoverLimit) {
          setDiscoverLimit((res as any).discoverLimit);
        }
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to search groups.'), 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const loadRequestsAndInvitations = async () => {
    setIsLoadingRequests(true);
    try {
      const [reqRes, invRes] = await Promise.all([
        fetchAllOwnerJoinRequests().catch(() => ({ success: true, requests: [] })),
        fetchUserGroupInvitations().catch(() => ({ success: true, invitations: [] })),
      ]);
      if (reqRes.success) setOwnerRequests(reqRes.requests || []);
      if (invRes.success) setInvitations(invRes.invitations || []);
    } catch (err: any) {
      // silent catch
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadMyGroups();
    loadRequestsAndInvitations();
  }, []);

  // When switching to Discover or Requests tab
  useEffect(() => {
    if (activeTab === 'discover') {
      if (!searchQuery.trim()) {
        handleSearch('');
      }
    } else if (activeTab === 'requests') {
      loadRequestsAndInvitations();
    }
  }, [activeTab]);

  const handleRespondOwnerRequest = async (groupId: string, requestId: string, action: 'ACCEPT' | 'REJECT') => {
    const prevRequests = [...ownerRequests];
    // 0ms optimistic removal
    setOwnerRequests((prev) => prev.filter((r) => r.id !== requestId));
    showFeedback(action === 'ACCEPT' ? 'Applicant accepted!' : 'Request rejected.');

    try {
      const res = await respondToJoinRequest(groupId, requestId, action);
      if (!res.success) throw new Error(res.message || 'Failed to process request.');
      loadMyGroups();
    } catch (err: any) {
      setOwnerRequests(prevRequests);
      showFeedback(extractErrorMessage(err, 'Failed to process request.'), 'error');
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'ACCEPT' | 'REJECT') => {
    const prevInvitations = [...invitations];
    // 0ms optimistic removal
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    showFeedback(action === 'ACCEPT' ? 'Joined group!' : 'Invitation declined.');

    try {
      const res = await respondToGroupInvitation(invitationId, action);
      if (!res.success) throw new Error(res.message || 'Failed to respond to invitation.');
      if (action === 'ACCEPT') {
        loadMyGroups();
      }
    } catch (err: any) {
      setInvitations(prevInvitations);
      showFeedback(extractErrorMessage(err, 'Failed to respond to invitation.'), 'error');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    if (createScheduledDays.length === 0) {
      showFeedback('Please select at least one active day for the shared habit.', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const res = await createGroup({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        scheduledDays: createScheduledDays,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setCreateName('');
        setCreateDescription('');
        setCreateScheduledDays([0, 1, 2, 3, 4, 5, 6]);
        showFeedback(res.message || 'Group created! The shared group task has been added to your checklist.');
        loadMyGroups();
        if (activeTab === 'discover') {
          handleSearch(searchQuery);
        }
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to create group.'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    try {
      const res = await requestToJoinGroup(joinCodeInput.trim().toUpperCase());
      if (res.success) {
        setIsJoinOpen(false);
        setJoinCodeInput('');
        showFeedback(res.message || 'Join request submitted for Owner/Admin approval.');
        loadMyGroups();
        if (activeTab === 'discover') {
          handleSearch(searchQuery);
        }
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to submit join request. Verify code and try again.'), 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleRequestToJoin = async (group: GroupSearchResult) => {
    // Optimistic update
    setSearchResults((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, myRequestStatus: 'PENDING' } : g))
    );
    showFeedback('Join request submitted.');

    try {
      const res = await requestToJoinGroup(group.id);
      if (!res.success) throw new Error(res.message || 'Failed to submit join request.');
    } catch (err: any) {
      // Rollback
      setSearchResults((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, myRequestStatus: null } : g))
      );
      showFeedback(extractErrorMessage(err, 'Failed to submit join request.'), 'error');
    }
  };

  const handleCancelRequest = async (groupId: string) => {
    // Optimistic update
    setSearchResults((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, myRequestStatus: null } : g))
    );
    showFeedback('Join request cancelled.');

    try {
      const res = await cancelJoinRequest(groupId);
      if (!res.success) throw new Error(res.message || 'Failed to cancel join request.');
    } catch (err: any) {
      // Rollback
      setSearchResults((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, myRequestStatus: 'PENDING' } : g))
      );
      showFeedback(extractErrorMessage(err, 'Failed to cancel join request.'), 'error');
    }
  };

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const formatSchedule = (days?: number[]) => {
    const d = days || [0, 1, 2, 3, 4, 5, 6];
    if (d.length === 7) return 'Every day';
    if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Weekdays';
    if (d.length === 2 && [0, 6].every((x) => d.includes(x))) return 'Weekends';
    return d.map((x) => DAY_LABELS[x]).join(', ');
  };

  const toggleDay = (day: number) => {
    setCreateScheduledDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-flame-500" />
            <span>Groups</span>
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted mt-1">
            Join or create a shared group task with friends. Share the habit schedule while maintaining independent streaks.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-card hover:bg-dark-surface border border-dark-border text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Join with Code</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-flame-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'my'
              ? 'bg-dark-card text-flame-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>My Groups</span>
          {groups.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-flame-500/10 text-flame-400 text-[10px] font-mono">
              {groups.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('discover')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'discover'
              ? 'bg-dark-card text-flame-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Discover & Search</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-dark-card text-amber-400 border border-dark-border shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Group Requests</span>
          {(ownerRequests.length + invitations.length) > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold">
              {ownerRequests.length + invitations.length}
            </span>
          )}
        </button>
      </div>

      {/* Feedback Alert */}
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

      {/* TAB 1: MY GROUPS */}
      {activeTab === 'my' && (
        <>
          {isLoadingGroups ? (
            <div className="py-24 text-center text-xs text-dark-muted">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                Loading your groups...
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-dark-card border border-dashed border-dark-border rounded-3xl p-12 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-flame-500/10 border border-flame-500/20 flex items-center justify-center text-flame-400 mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">You haven't joined any groups yet</h3>
              <p className="text-xs text-dark-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
                Create a shared group habit or search through open groups using a unique code or group name.
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 text-xs font-semibold rounded-xl"
                >
                  Discover Groups
                </button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 text-xs font-extrabold rounded-xl shadow-sm"
                >
                  Create a Group
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const role = group.role || group.userRole || 'MEMBER';
                const isOwner = role === 'OWNER';
                const isAdmin = role === 'ADMIN';

                return (
                  <div
                    key={group.id}
                    className="bg-dark-card border border-dark-border hover:border-zinc-700 rounded-2xl p-5 shadow-panel transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-bold text-zinc-100 group-hover:text-flame-400 transition-colors line-clamp-1">
                          {group.name}
                        </h3>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                            isOwner
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                              : isAdmin
                              ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {isOwner ? <Crown className="w-2.5 h-2.5" /> : isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : null}
                          <span>{role}</span>
                        </span>
                      </div>

                      {group.description ? (
                        <p className="text-xs text-dark-muted line-clamp-2 min-h-[2rem]">
                          {group.description}
                        </p>
                      ) : (
                        <p className="text-xs text-dark-muted/60 italic min-h-[2rem]">
                          Shared habit community.
                        </p>
                      )}

                      {/* Unique Code & Schedule Info */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-dark-surface/60 border border-dark-border">
                          <div className="flex items-center gap-1.5 text-xs text-dark-muted">
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-medium">Code:</span>
                            <span className="font-mono font-bold text-zinc-200 tracking-wider">
                              {group.joinCode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyJoinCode(group.joinCode)}
                            title="Copy group code"
                            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover rounded-lg transition-colors"
                          >
                            {copiedCode === group.joinCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-dark-muted px-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-flame-400" />
                            <span>{formatSchedule(group.scheduledDays)}</span>
                          </span>
                          <span className="flex items-center gap-1 font-mono font-bold text-flame-400">
                            <Flame className="w-3 h-3 fill-flame-500" />
                            <span>{group.currentStreak ?? 0}d streak</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-dark-border/60 flex items-center justify-between">
                      <div className="text-xs text-dark-muted flex items-center gap-2 font-mono">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{group.memberCount} members</span>
                        </span>
                        {isAdmin && (group.pendingRequestsCount ?? 0) > 0 && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {group.pendingRequestsCount} pending
                          </span>
                        )}
                      </div>

                      <Link
                        to={`/groups/${group.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-flame-400 group-hover:text-flame-300 transition-colors font-mono"
                      >
                        <span>View Group</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DISCOVER & SEARCH GROUPS */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by group name (e.g. GATE Preparation) or exact code (e.g. GATE-X7K2)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all shrink-0"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
            <p className="text-[11px] text-zinc-500 mt-2 px-1">
              Search by group name to explore circles with identical or similar topics, or type the exact unique code to find a private community.
            </p>
          </div>

          {/* Top 5 or Search Results Header */}
          {!isSearching && searchResults.length > 0 && (
            <div className="flex items-center justify-between text-xs px-1 text-zinc-400">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                {isTopFive ? (
                  <>
                    <Flame className="w-3.5 h-3.5 text-flame-400" />
                    <span>Top {discoverLimit} Active Groups</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-flame-400" />
                    <span>Search Results ({searchResults.length})</span>
                  </>
                )}
              </div>
              {isTopFive ? (
                <span className="text-[11px] text-zinc-500 font-normal">
                  Others can be searched using name or code
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    handleSearch('');
                  }}
                  className="text-[11px] text-flame-400 hover:text-flame-300 transition-colors font-medium"
                >
                  Clear search · Show Top {discoverLimit}
                </button>
              )}
            </div>
          )}

          {/* Search Results */}
          {isSearching ? (
            <div className="py-20 text-center text-xs text-dark-muted">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
                Searching groups...
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-10 text-center max-w-md mx-auto">
              <Search className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-200">No matching groups found</h3>
              <p className="text-xs text-dark-muted mt-1">
                Check the group name or code, or create a brand new group for your study habit.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((group) => {
                const isLoading = false;

                return (
                  <div
                    key={group.id}
                    className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-zinc-100 line-clamp-1">
                          {group.name}
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                          {group.joinCode}
                        </span>
                      </div>

                      {group.description ? (
                        <p className="text-xs text-dark-muted line-clamp-2 min-h-[2rem]">
                          {group.description}
                        </p>
                      ) : (
                        <p className="text-xs text-dark-muted/60 italic min-h-[2rem]">
                          Shared habit group.
                        </p>
                      )}

                      <div className="mt-3 p-2.5 rounded-xl bg-dark-surface/60 border border-dark-border space-y-1.5 text-xs text-dark-muted">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-flame-400" />
                            <span>Schedule:</span>
                          </span>
                          <span className="text-zinc-200 font-medium">
                            {formatSchedule(group.scheduledDays)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Members:</span>
                          </span>
                          <span className="font-mono text-zinc-200">{group.memberCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 mt-4 border-t border-dark-border/60 flex items-center justify-between">
                      {group.isMember ? (
                        <Link
                          to={`/groups/${group.id}`}
                          className="w-full text-center px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition-all"
                        >
                          Already Member · Open
                        </Link>
                      ) : group.myRequestStatus === 'PENDING' ? (
                        <div className="w-full flex items-center gap-2">
                          <span className="flex-1 text-center py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl">
                            Request Pending
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(group.id)}
                            disabled={isLoading}
                            title="Cancel join request"
                            className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-dark-border transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestToJoin(group)}
                          disabled={isLoading}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-sm transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isLoading ? 'Sending...' : 'Request to Join'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GROUP REQUESTS & INVITATIONS */}
      {activeTab === 'requests' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Sub-Section 1: Group Join Requests (For Groups You Own / Manage) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Join Requests (For Your Groups)</span>
                  {ownerRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                      {ownerRequests.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-dark-muted mt-0.5">
                  Review and accept requests to join groups you created or administer.
                </p>
              </div>
            </div>

            {isLoadingRequests ? (
              <div className="py-12 text-center text-xs text-dark-muted">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                Loading requests...
              </div>
            ) : ownerRequests.length === 0 ? (
              <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center max-w-lg mx-auto">
                <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No pending join requests across your groups.</p>
                <p className="text-[11px] text-dark-muted mt-1">When users request to join via search or code, they will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownerRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-dark-card border border-dark-border flex flex-col justify-between gap-3 shadow-panel"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Link
                          to={`/groups/${req.groupId}`}
                          className="text-xs font-bold text-flame-400 hover:text-flame-300 transition-colors flex items-center gap-1"
                        >
                          <span>{req.groupName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">({req.joinCode})</span>
                        </Link>
                        <span className="text-[10px] font-mono text-dark-muted">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-dark-surface/70 border border-dark-border">
                        <InitialsAvatar name={req.user.name || req.user.username} size="md" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-zinc-100 block truncate">
                            {req.user.name}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            @{req.user.username}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-dark-border">
                      <button
                        type="button"
                        onClick={() => handleRespondOwnerRequest(req.groupId, req.id, 'ACCEPT')}
                        className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                      >
                        Accept & Add
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondOwnerRequest(req.groupId, req.id, 'REJECT')}
                        className="py-1.5 px-3 bg-dark-surface hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-dark-border hover:border-rose-500/30 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Section 2: Group Invitations Received */}
          <div className="space-y-4 pt-4 border-t border-dark-border">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>Group Invitations Received</span>
                {invitations.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-bold">
                    {invitations.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-dark-muted mt-0.5">
                Invitations sent to you by friends to join their study habits.
              </p>
            </div>

            {isLoadingRequests ? (
              <div className="py-8 text-center text-xs text-dark-muted">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center max-w-lg mx-auto">
                <Mail className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No pending group invitations.</p>
                <p className="text-[11px] text-dark-muted mt-1">When friends invite you to join a habit group, they will show up here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-5 rounded-2xl bg-dark-card border border-dark-border flex flex-col justify-between gap-4 shadow-panel"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-zinc-100 line-clamp-1">
                          {inv.groupName}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
                          {inv.joinCode}
                        </span>
                      </div>

                      {inv.groupDescription ? (
                        <p className="text-xs text-dark-muted line-clamp-2 mb-3">
                          {inv.groupDescription}
                        </p>
                      ) : (
                        <p className="text-xs text-dark-muted/60 italic mb-3">
                          Shared habit group.
                        </p>
                      )}

                      <div className="p-2.5 rounded-xl bg-dark-surface/70 border border-dark-border flex items-center justify-between text-xs text-dark-muted mb-3">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{inv.memberCount} members</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                          <Calendar className="w-3.5 h-3.5 text-flame-400" />
                          <span>{formatSchedule(inv.scheduledDays)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-dark-muted">
                        <span>Invited by:</span>
                        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                          <InitialsAvatar name={inv.inviter.name || inv.inviter.username} size="xs" />
                          <span>{inv.inviter.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">(@{inv.inviter.username})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-dark-border">
                      <button
                        type="button"
                        onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer text-center"
                      >
                        Accept & Join Group
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondInvitation(inv.id, 'REJECT')}
                        className="py-2 px-3 bg-dark-surface hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-dark-border hover:border-rose-500/30 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Create Shared Group Task</h3>
                  <p className="text-xs text-dark-muted">Everyone who joins shares this task definition & schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Group Task Name <span className="text-flame-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. GATE Preparation, Daily DSA Practice"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Description <span className="text-zinc-500 text-[10px] lowercase font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={250}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Briefly describe the shared habit goals or rules..."
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 resize-none"
                />
              </div>

              {/* Scheduled Days Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Task Schedule Days <span className="text-flame-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateScheduledDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-[10px] font-semibold text-zinc-400 hover:text-flame-400 transition-colors"
                    >
                      Every day
                    </button>
                    <span className="text-zinc-600">·</span>
                    <button
                      type="button"
                      onClick={() => setCreateScheduledDays([1, 2, 3, 4, 5])}
                      className="text-[10px] font-semibold text-zinc-400 hover:text-flame-400 transition-colors"
                    >
                      Weekdays
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map((dayLabel, idx) => {
                    const isSelected = createScheduledDays.includes(idx);
                    return (
                      <button
                        key={dayLabel}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-flame-500 text-zinc-950 border-flame-500 shadow-sm shadow-flame-500/20'
                            : 'bg-dark-surface text-zinc-400 border-dark-border hover:border-zinc-700'
                        }`}
                      >
                        {dayLabel}
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>

              <div className="pt-3 border-t border-dark-border flex items-center justify-end gap-3 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createName.trim() || isCreating || createScheduledDays.length === 0}
                  className="px-5 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {isCreating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN GROUP WITH CODE MODAL */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Join with Code</h3>
                  <p className="text-xs text-dark-muted">Enter group code (e.g. GATE-X7K2)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsJoinOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickJoinByCode} className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Unique Group Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. GATE-X7K2"
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-dark-border flex items-center justify-end gap-3 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isJoining}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {isJoining ? 'Submitting...' : 'Request to Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
