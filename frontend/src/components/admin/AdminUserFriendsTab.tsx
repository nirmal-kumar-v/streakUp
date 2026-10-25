import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  RefreshCw,
  Search,
  ArrowRight,
} from 'lucide-react';
import {
  adminGetUserFriendRequests,
  adminForceAcceptFriendRequest,
  adminForceRejectFriendRequest,
  adminForceCreateFriendship,
  adminForceRemoveFriendship,
  searchAdminUsers,
  AdminUser,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';

interface AdminUserFriendsTabProps {
  userId: string;
  username: string;
  onRequirePin: (title: string, description: string, action: (pin: string) => Promise<void>) => void;
}

export const AdminUserFriendsTab: React.FC<AdminUserFriendsTabProps> = ({
  userId,
  username,
  onRequirePin,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  // Force Create Friendship State
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [targetSearchResults, setTargetSearchResults] = useState<AdminUser[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<AdminUser | null>(null);
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const [createFriendshipReason, setCreateFriendshipReason] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminGetUserFriendRequests(userId);
      if (res.success) {
        setIncoming(res.incoming || []);
        setOutgoing(res.outgoing || []);
        setFriends(res.friends || []);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const handleSearchTarget = async () => {
    if (!targetSearchQuery.trim()) return;
    try {
      setIsSearchingTarget(true);
      const res = await searchAdminUsers(targetSearchQuery.trim());
      if (res.success) {
        // Exclude the current user
        setTargetSearchResults(res.users.filter((u) => u.id !== userId));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSearchingTarget(false);
    }
  };

  const handleAcceptRequest = (requestId: string, senderName: string) => {
    onRequirePin(
      'Force-Accept Friend Request',
      `Approve pending friend request from @${senderName} on behalf of @${username}?`,
      async (pin) => {
        const res = await adminForceAcceptFriendRequest(requestId, {
          reason: `Admin approved request from @${senderName}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          loadData();
        }
      }
    );
  };

  const handleRejectRequest = (requestId: string, senderName: string) => {
    onRequirePin(
      'Force-Reject Friend Request',
      `Decline pending friend request involving @${senderName} and @${username}?`,
      async (pin) => {
        const res = await adminForceRejectFriendRequest(requestId, {
          reason: `Admin rejected request from @${senderName}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          loadData();
        }
      }
    );
  };

  const handleRemoveFriend = (friendId: string, friendUsername: string) => {
    onRequirePin(
      'Force-Remove Friendship',
      `Disconnect friendship between @${username} and @${friendUsername}?`,
      async (pin) => {
        const res = await adminForceRemoveFriendship({
          userIdA: userId,
          userIdB: friendId,
          reason: `Administrative friendship severance between @${username} and @${friendUsername}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          loadData();
        }
      }
    );
  };

  const handleCreateFriendship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUser) {
      toast.error('Please select a target user to connect with.');
      return;
    }
    if (!createFriendshipReason.trim()) {
      toast.error('Administrative reason is required.');
      return;
    }

    onRequirePin(
      'Direct Friendship Establishment',
      `Force-connect @${username} and @${selectedTargetUser.username} as mutual friends without friend request?`,
      async (pin) => {
        try {
          setIsSubmittingCreate(true);
          const res = await adminForceCreateFriendship({
            userIdA: userId,
            userIdB: selectedTargetUser.id,
            reason: createFriendshipReason.trim(),
            sensitivePin: pin,
          });
          if (res.success) {
            toast.success(res.message);
            setSelectedTargetUser(null);
            setCreateFriendshipReason('');
            setTargetSearchQuery('');
            setTargetSearchResults([]);
            loadData();
          }
        } finally {
          setIsSubmittingCreate(false);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-flame-400" />
            <span>Friendship & Social Connections Administration</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Manage @{username}'s network: inspect friend requests, force-connect new friends, or disconnect relationships.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border text-zinc-300 border border-dark-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-flame-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Force-Create Friendship Form */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Force Direct Friendship (Bypass Request Flow)</span>
        </h4>

        <form onSubmit={handleCreateFriendship} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Search Target User to Link with @{username}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchTarget();
                    }
                  }}
                  placeholder="Username or email..."
                  className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                />
                <button
                  type="button"
                  onClick={handleSearchTarget}
                  disabled={isSearchingTarget}
                  className="px-3 py-2 bg-dark-border hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Find</span>
                </button>
              </div>

              {targetSearchResults.length > 0 && !selectedTargetUser && (
                <div className="mt-2 bg-dark-surface border border-dark-border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                  {targetSearchResults.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setSelectedTargetUser(u)}
                      className="w-full text-left p-2 rounded-lg hover:bg-dark-card text-xs flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-zinc-200">
                        {u.name} <span className="text-zinc-500 font-mono">(@{u.username})</span>
                      </span>
                      <span className="text-[11px] text-flame-400 font-bold">Select</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedTargetUser && (
                <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs flex items-center justify-between">
                  <div className="text-emerald-300">
                    Target: <strong>{selectedTargetUser.name}</strong> (@{selectedTargetUser.username})
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetUser(null)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Administrative Reason (Logged in Audit Ledger)
              </label>
              <textarea
                value={createFriendshipReason}
                onChange={(e) => setCreateFriendshipReason(e.target.value)}
                placeholder="Reason for establishing direct friendship..."
                rows={2}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 resize-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmittingCreate || !selectedTargetUser}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Link Friends Directly</span>
            </button>
          </div>
        </form>
      </div>

      {/* Grid: Pending Friend Requests (Incoming & Outgoing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Incoming Requests */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Incoming Requests ({incoming.length})</span>
            </div>
            <span className="text-[10px] text-zinc-500">Sent to @{username}</span>
          </h4>

          {incoming.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4 text-center">No incoming requests pending.</p>
          ) : (
            <div className="space-y-2">
              {incoming.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-200">
                      {req.sender?.name || req.sender?.username}
                    </span>
                    <span className="text-zinc-500 font-mono ml-1.5">(@{req.sender?.username})</span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req.id, req.sender?.username)}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id, req.sender?.username)}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing Requests */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-blue-400" />
              <span>Outgoing Requests ({outgoing.length})</span>
            </div>
            <span className="text-[10px] text-zinc-500">Sent by @{username}</span>
          </h4>

          {outgoing.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4 text-center">No outgoing requests pending.</p>
          ) : (
            <div className="space-y-2">
              {outgoing.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-200">
                      {req.receiver?.name || req.receiver?.username}
                    </span>
                    <span className="text-zinc-500 font-mono ml-1.5">(@{req.receiver?.username})</span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRejectRequest(req.id, req.receiver?.username)}
                    className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold"
                  >
                    Cancel Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Current Friends List */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
        <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Established Friends ({friends.length})</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Mutual Connections</span>
        </h4>

        {friends.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-6 text-center">
            @{username} currently has no mutual friends.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-zinc-100 block">{friend.name}</span>
                  <span className="text-zinc-500 font-mono text-[11px]">@{friend.username}</span>
                  <span className="text-amber-400 font-mono text-[10px] block mt-0.5">
                    {friend.currentStreak || 0}d streak • {friend.points || 0} pts
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFriend(friend.id, friend.username)}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="Remove Friendship"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Unfriend</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
