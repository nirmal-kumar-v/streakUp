import React, { useState, useEffect, useCallback } from 'react';
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
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { extractErrorMessage } from '../utils/error';

export const FriendsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');

  // Data states
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetchFriendsList(),
        fetchFriendRequests(),
      ]);

      if (friendsRes.success) {
        setFriends(friendsRes.friends || []);
      }
      if (requestsRes.success) {
        setReceivedRequests(requestsRes.received || []);
        setSentRequests(requestsRes.sent || []);
      }
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(searchQuery.trim());
        if (res.success) {
          setSearchResults(res.users || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Actions
  const handleSendRequest = async (targetUser: FriendUser) => {
    try {
      const res = await sendFriendRequest(targetUser.id);
      if (res.success) {
        showFeedback(res.message || `Friend request sent to @${targetUser.username}!`);
        // Update local status
        setSearchResults((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, status: 'REQUEST_SENT' } : u))
        );
        loadData();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to send friend request.'), 'error');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await acceptFriendRequest(requestId);
      if (res.success) {
        showFeedback('Friend request accepted! You can now view their streak on your leaderboard.');
        loadData();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to accept request.'), 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const res = await rejectFriendRequest(requestId);
      if (res.success) {
        showFeedback('Friend request rejected.');
        loadData();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to reject request.'), 'error');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const res = await cancelFriendRequest(requestId);
      if (res.success) {
        showFeedback('Friend request cancelled.');
        loadData();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to cancel request.'), 'error');
    }
  };

  const handleRemoveFriend = async (friend: FriendUser) => {
    if (!window.confirm(`Are you sure you want to remove @${friend.username} from your friends?`)) {
      return;
    }
    try {
      const res = await removeFriend(friend.id);
      if (res.success) {
        showFeedback(`Removed @${friend.username} from friends.`);
        loadData();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to remove friend.'), 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
          <Users2 className="w-7 h-7 text-flame-500" />
          Friends & Social
        </h1>
        <p className="text-xs sm:text-sm text-dark-muted mt-1">
          Connect with friends, keep each other accountable, and compete on the leaderboard
        </p>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-dark-card p-1.5 rounded-2xl border border-dark-border gap-2 max-w-md">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'friends'
              ? 'bg-flame-500/20 text-flame-400 border border-flame-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>My Friends ({friends.length})</span>
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
          {isLoading ? (
            <div className="py-20 text-center text-xs text-dark-muted">Loading friends...</div>
          ) : friends.length === 0 ? (
            <div className="bg-dark-card border border-dashed border-dark-border rounded-2xl p-12 text-center">
              <Users2 className="w-12 h-12 text-dark-muted mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-bold text-zinc-200">No friends added yet</h3>
              <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
                Search for other registered users by username to send friend requests.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="mt-4 px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" /> Find Users
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center justify-between gap-3 group hover:border-zinc-700 transition-colors"
                >
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
                      onClick={() => handleRemoveFriend(friend)}
                      title="Remove friend"
                      className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-dark-hover rounded-xl transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
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
            <div className="py-12 text-center text-xs text-dark-muted">
              No matching users found for "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center justify-between gap-3"
                >
                  <Link to={`/profile/${user.username}`} className="flex items-center gap-3 min-w-0">
                    <InitialsAvatar
                      name={user.name}
                      image={user.profileImage}
                      size="md"
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
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Accept
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user)}
                        className="px-3.5 py-1.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Add Friend
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
              <p className="text-xs text-dark-muted py-4">No pending incoming friend requests.</p>
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
                        <div className="text-xs text-dark-muted font-mono">@{req.sender?.username} • {req.sender?.currentStreak || 0}d streak</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-dark-hover rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
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
              <p className="text-xs text-dark-muted py-4">No outgoing pending requests.</p>
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
                      className="text-xs text-zinc-400 hover:text-rose-400 hover:bg-dark-hover px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Cancel Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
