import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchFriendsList,
  fetchFriendRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  FriendUser,
  FriendRequestItem,
} from '../api/friends';
import {
  Users2,
  Search,
  UserPlus,
  Inbox,
  Flame,
  Check,
  X,
  UserMinus,
  Clock,
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { ConfirmModal } from '../components/ConfirmModal';
import { useBadges } from '../context/BadgeContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';

const FRIENDS_CACHE_KEY = 'streakup_friends_data_cache';

interface CachedFriendsData {
  timestamp: number;
  friends: FriendUser[];
  received: FriendRequestItem[];
  sent: FriendRequestItem[];
}

function getCachedFriendsData(): CachedFriendsData | null {
  try {
    const raw = sessionStorage.getItem(FRIENDS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < 3 * 60 * 1000) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

function setCachedFriendsData(data: Omit<CachedFriendsData, 'timestamp'>) {
  try {
    sessionStorage.setItem(
      FRIENDS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), ...data })
    );
  } catch (e) {}
}

export const FriendsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const { setPendingRequestsCount, decrementFriendRequests } = useBadges();
  const toast = useToast();

  const [cachedInitial] = useState(() => getCachedFriendsData());

  // Data states
  const [friends, setFriends] = useState<FriendUser[]>(() => cachedInitial?.friends || []);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>(() => cachedInitial?.received || []);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>(() => cachedInitial?.sent || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);

  // Action pending tracking for optimistic locking and zero duplicate requests
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
  const [friendToRemove, setFriendToRemove] = useState<FriendUser | null>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(() => !cachedInitial);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addPendingId = (id: string) => {
    setPendingActionIds((prev) => new Set(prev).add(id));
  };
  const removePendingId = (id: string) => {
    setPendingActionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedFriendsData()) setIsInitialLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetchFriendsList().catch(() => null),
        fetchFriendRequests().catch(() => null),
      ]);

      const currentCached = getCachedFriendsData();
      const freshFriends = (friendsRes && friendsRes.success) ? (friendsRes.friends || []) : (currentCached?.friends || []);
      const freshReceived = (requestsRes && requestsRes.success) ? (requestsRes.received || []) : (currentCached?.received || []);
      const freshSent = (requestsRes && requestsRes.success) ? (requestsRes.sent || []) : (currentCached?.sent || []);

      if (friendsRes && friendsRes.success) {
        setFriends(freshFriends);
      }
      if (requestsRes && requestsRes.success) {
        setReceivedRequests(freshReceived);
        setSentRequests(freshSent);
        // Immediately synchronize navbar badge count
        setPendingRequestsCount(requestsRes.pendingCount || freshReceived.length);
      }

      setCachedFriendsData({
        friends: freshFriends,
        received: freshReceived,
        sent: freshSent,
      });
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      if (isMountedRef.current) setIsInitialLoading(false);
    }
  }, [setPendingRequestsCount]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Handle User Search with quick debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(trimmed);
        if (res.success && isMountedRef.current) {
          setSearchResults(res.users || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ==========================================
  // Optimistic Handlers for Instant UI Feel
  // ==========================================

  const handleSendRequest = async (targetUser: FriendUser) => {
    if (pendingActionIds.has(targetUser.id)) return;
    addPendingId(targetUser.id);

    // 1. Optimistic UI update: immediately switch target user status
    const previousSearchResults = [...searchResults];
    setSearchResults((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, status: 'REQUEST_SENT' } : u))
    );
    toast.success('Request sent');

    try {
      const res = await sendFriendRequest(targetUser.id);
      if (res.success) {
        // Background silent refresh of sent requests
        loadData(true);
      } else {
        throw new Error(res.message || 'Failed to send request');
      }
    } catch (err: any) {
      // Revert optimistic state on failure
      setSearchResults(previousSearchResults);
      toast.error(extractErrorMessage(err, 'Could not send friend request. Please try again.'));
    } finally {
      removePendingId(targetUser.id);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (pendingActionIds.has(requestId)) return;
    addPendingId(requestId);

    const targetReq = receivedRequests.find((r) => r.id === requestId);
    const previousReceived = [...receivedRequests];
    const previousFriends = [...friends];

    // 1. Optimistic UI update: instantly remove from requests and add to friends
    setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (targetReq?.sender) {
      setFriends((prev) => [targetReq.sender!, ...prev.filter((f) => f.id !== targetReq.sender!.id)]);
    }

    // 2. Immediately update badge count in Navbar
    decrementFriendRequests();

    const friendName = targetReq?.sender?.username ? `@${targetReq.sender.username}` : 'your friend';
    toast.success(`You're now friends with ${friendName}`);

    try {
      const res = await acceptFriendRequest(requestId);
      if (!res.success) {
        throw new Error(res.message || 'Failed to accept request');
      }
      // Reconcile in background
      loadData(true);
    } catch (err: any) {
      // Revert optimistic state on failure
      setReceivedRequests(previousReceived);
      setFriends(previousFriends);
      setPendingRequestsCount((c) => c + 1);
      toast.error(extractErrorMessage(err, "Couldn't accept request. Please try again."));
    } finally {
      removePendingId(requestId);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (pendingActionIds.has(requestId)) return;
    addPendingId(requestId);

    const previousReceived = [...receivedRequests];

    // 1. Optimistic UI: remove from list & decrement badge immediately
    setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId));
    decrementFriendRequests();
    toast.info('Request declined');

    try {
      const res = await rejectFriendRequest(requestId);
      if (!res.success) {
        throw new Error(res.message || 'Failed to reject request');
      }
      loadData(true);
    } catch (err: any) {
      // Revert on failure
      setReceivedRequests(previousReceived);
      setPendingRequestsCount((c) => c + 1);
      toast.error(extractErrorMessage(err, "Couldn't decline request. Please try again."));
    } finally {
      removePendingId(requestId);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (pendingActionIds.has(requestId)) return;
    addPendingId(requestId);

    const previousSent = [...sentRequests];
    const previousSearchResults = [...searchResults];

    // Optimistic UI: remove from sent requests
    setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    setSearchResults((prev) =>
      prev.map((u) => (u.requestId === requestId ? { ...u, status: 'NONE' } : u))
    );
    toast.info('Request cancelled');

    try {
      const res = await cancelFriendRequest(requestId);
      if (!res.success) {
        throw new Error(res.message || 'Failed to cancel request');
      }
      loadData(true);
    } catch (err: any) {
      setSentRequests(previousSent);
      setSearchResults(previousSearchResults);
      toast.error(extractErrorMessage(err, "Couldn't cancel request. Please try again."));
    } finally {
      removePendingId(requestId);
    }
  };

  const executeRemoveFriend = async (friend: FriendUser) => {
    setFriendToRemove(null);
    if (pendingActionIds.has(friend.id)) return;
    addPendingId(friend.id);

    const previousFriends = [...friends];
    // Optimistic UI: remove friend instantly
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    toast.info(`Removed @${friend.username} from friends`);

    try {
      const res = await removeFriend(friend.id);
      if (!res.success) {
        throw new Error(res.message || 'Failed to remove friend');
      }
      loadData(true);
    } catch (err: any) {
      setFriends(previousFriends);
      toast.error(extractErrorMessage(err, 'Failed to remove friend. Please try again.'));
    } finally {
      removePendingId(friend.id);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Users2 className="w-7 h-7 text-flame-500" />
              <span>Friends & Social</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 font-mono text-xs font-bold shadow-sm">
              <Users2 className="w-3.5 h-3.5" />
              <span>{friends.length} {friends.length === 1 ? 'Connection' : 'Connections'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-dark-muted mt-1">
            Connect with friends, keep each other accountable, and compete on the leaderboard
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-dark-card border border-dark-border p-1 rounded-2xl max-w-md">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'friends'
              ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>My Connections ({friends.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'search'
              ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Find Users</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
            activeTab === 'requests'
              ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Requests</span>
          {receivedRequests.length > 0 && (
            <span className="bg-flame-500 text-zinc-950 font-black text-[10px] px-1.5 py-0.2 rounded-full">
              {receivedRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Friends List */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {isInitialLoading && friends.length === 0 ? (
            <div className="py-16 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading friends...</span>
            </div>
          ) : friends.length === 0 ? (
            <div className="bg-dark-card border border-dashed border-dark-border rounded-2xl p-12 text-center">
              <Users2 className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-bold text-zinc-200">No friends added yet</h3>
              <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
                Search for other registered users by username to send friend requests.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-xs rounded-xl shadow-md transition-all"
              >
                <UserPlus className="w-4 h-4" /> Find Friends
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                    className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex flex-col justify-between gap-3 group hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link to={`/profile/${friend.username}`} className="flex items-center gap-3 min-w-0">
                        <InitialsAvatar
                          name={friend.name}
                          image={friend.profileImage}
                          size="md"
                          className="group-hover:border-flame-500 transition-colors"
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors truncate">
                            {friend.name}
                          </h4>
                          <p className="text-xs text-dark-muted font-mono truncate">@{friend.username}</p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs font-mono font-bold text-flame-400 justify-end">
                            <Flame className="w-3.5 h-3.5 fill-flame-500/30" />
                            <span>{friend.currentStreak}d</span>
                          </div>
                          <div className="text-[10px] text-dark-muted font-mono">
                            {friend.tasksCompletedToday || 0} done today
                          </div>
                        </div>

                        <button
                          onClick={() => setFriendToRemove(friend)}
                          title={`Remove ${friend.name} from friends`}
                          aria-label={`Remove ${friend.name} from friends`}
                          className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-dark-hover rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Search Users */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="text"
                placeholder="Search registered users by username (e.g. alex)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
              />
            </div>
          </div>

          {searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
            <div className="p-8 text-center bg-dark-card border border-dark-border rounded-2xl text-xs text-dark-muted">
              No users found matching "@{searchQuery.trim()}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((user) => {
                const isActionPending = pendingActionIds.has(user.id);

                return (
                  <div
                    key={user.id}
                    className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center justify-between gap-3 group hover:border-zinc-700 transition-colors"
                  >
                    <Link to={`/profile/${user.username}`} className="flex items-center gap-3 min-w-0">
                      <InitialsAvatar
                        name={user.name}
                        image={user.profileImage}
                        size="md"
                        className="group-hover:border-flame-500 transition-colors"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-zinc-100 truncate">{user.name}</h4>
                        <p className="text-xs text-dark-muted font-mono truncate">@{user.username}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-1 text-xs font-mono font-bold text-flame-400 justify-end">
                          <Flame className="w-3.5 h-3.5 fill-flame-500/30" />
                          <span>{user.currentStreak}d</span>
                        </div>
                        <div className="text-[10px] text-dark-muted font-mono">
                          Best: {user.longestStreak}d
                        </div>
                      </div>

                      {user.status === 'SELF' ? (
                        <span className="text-[10px] font-bold bg-dark-surface text-zinc-400 px-3 py-1.5 rounded-xl border border-dark-border">
                          You
                        </span>
                      ) : user.status === 'FRIENDS' ? (
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/25 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Friends
                        </span>
                      ) : user.status === 'REQUEST_SENT' ? (
                        <span className="text-[11px] font-medium text-dark-muted bg-dark-surface px-3 py-1.5 rounded-xl border border-dark-border flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" /> Request Sent
                        </span>
                      ) : user.status === 'REQUEST_RECEIVED' && user.requestId ? (
                        <button
                          onClick={() => handleAcceptRequest(user.requestId!)}
                          disabled={isActionPending}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Accept
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(user)}
                          disabled={isActionPending}
                          className="px-3.5 py-1.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Add Friend
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

      {/* TAB 3: Friend Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Received Requests */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-flame-500" />
              Received Requests ({receivedRequests.length})
            </h3>

            {receivedRequests.length === 0 ? (
              <p className="text-xs text-dark-muted py-4">No pending incoming friend requests. All caught up!</p>
            ) : (
              <div className="space-y-3">
                {receivedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={req.sender?.name || 'User'}
                        image={req.sender?.profileImage}
                        size="md"
                      />
                      <div>
                        <div className="text-sm font-bold text-zinc-100">{req.sender?.name}</div>
                        <div className="text-xs text-dark-muted font-mono">
                          @{req.sender?.username} • {req.sender?.currentStreak || 0}d streak
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        disabled={pendingActionIds.has(req.id)}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={pendingActionIds.has(req.id)}
                        className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent Requests */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending Sent Requests ({sentRequests.length})
            </h3>

            {sentRequests.length === 0 ? (
              <p className="text-xs text-dark-muted py-4">You have no outgoing friend requests.</p>
            ) : (
              <div className="space-y-3">
                {sentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={req.receiver?.name || 'User'}
                        image={req.receiver?.profileImage}
                        size="md"
                      />
                      <div>
                        <div className="text-sm font-bold text-zinc-100">{req.receiver?.name}</div>
                        <div className="text-xs text-dark-muted font-mono">@{req.receiver?.username}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelRequest(req.id)}
                      disabled={pendingActionIds.has(req.id)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-medium text-xs rounded-xl flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-app Friend Removal Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(friendToRemove)}
        title="Remove Friend"
        message={
          friendToRemove
            ? `Are you sure you want to remove ${friendToRemove.name} (@${friendToRemove.username}) from your friends list? They will no longer appear on your friends leaderboard.`
            : ''
        }
        confirmText="Remove Friend"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (friendToRemove) executeRemoveFriend(friendToRemove);
        }}
        onClose={() => setFriendToRemove(null)}
      />
    </div>
  );
};
