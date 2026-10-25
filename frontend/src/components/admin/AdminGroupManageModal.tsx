import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  adminGetGroupJoinRequests,
  adminRespondToGroupJoinRequest,
  adminGetGroupInvitations,
  adminCancelGroupInvitation,
  adminForceAddMemberToGroup,
  searchAdminUsers,
  AdminUser,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';

interface AdminGroupManageModalProps {
  group: any;
  onClose: () => void;
  onRequirePin: (title: string, description: string, action: (pin: string) => Promise<void>) => void;
}

export const AdminGroupManageModal: React.FC<AdminGroupManageModalProps> = ({
  group,
  onClose,
  onRequirePin,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'members' | 'join_requests' | 'invitations' | 'force_add'>('join_requests');

  // Join Requests
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Invitations
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  // Force Add Member
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<AdminUser[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<AdminUser | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [forceAddReason, setForceAddReason] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const loadJoinRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await adminGetGroupJoinRequests(group.id);
      if (res.success) {
        setJoinRequests(res.joinRequests || []);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const res = await adminGetGroupInvitations(group.id);
      if (res.success) {
        setInvitations(res.invitations || []);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    if (group?.id) {
      loadJoinRequests();
      loadInvitations();
    }
  }, [group?.id]);

  const handleRespondJoinRequest = (requestId: string, username: string, action: 'APPROVE' | 'REJECT') => {
    onRequirePin(
      `${action === 'APPROVE' ? 'Approve' : 'Reject'} Group Join Request`,
      `${action === 'APPROVE' ? 'Grant membership' : 'Reject join request'} for @${username} in "${group.name}"?`,
      async (pin) => {
        const res = await adminRespondToGroupJoinRequest(group.id, requestId, {
          action,
          reason: `Admin ${action === 'APPROVE' ? 'approved' : 'rejected'} join request for @${username}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          loadJoinRequests();
        }
      }
    );
  };

  const handleCancelInvitation = (invitationId: string, inviteeIdentifier: string) => {
    onRequirePin(
      'Cancel Group Invitation',
      `Revoke active invitation for "${inviteeIdentifier}" in "${group.name}"?`,
      async (pin) => {
        const res = await adminCancelGroupInvitation(invitationId, {
          reason: `Admin cancelled invitation for ${inviteeIdentifier}`,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.success(res.message);
          loadInvitations();
        }
      }
    );
  };

  const handleSearchUserToAdd = async () => {
    if (!userSearchQuery.trim()) return;
    try {
      setIsSearchingUser(true);
      const res = await searchAdminUsers(userSearchQuery.trim());
      if (res.success) {
        setUserSearchResults(res.users);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleForceAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToAdd) {
      toast.error('Select a user to add to this group.');
      return;
    }
    if (!forceAddReason.trim()) {
      toast.error('Administrative reason is required.');
      return;
    }

    onRequirePin(
      'Direct Group Membership',
      `Directly add @${selectedUserToAdd.username} into "${group.name}" as ${newMemberRole}?`,
      async (pin) => {
        try {
          setIsSubmittingAdd(true);
          const res = await adminForceAddMemberToGroup(group.id, {
            userId: selectedUserToAdd.id,
            role: newMemberRole,
            reason: forceAddReason.trim(),
            sensitivePin: pin,
          });
          if (res.success) {
            toast.success(res.message);
            setSelectedUserToAdd(null);
            setForceAddReason('');
            setUserSearchQuery('');
            setUserSearchResults([]);
          }
        } finally {
          setIsSubmittingAdd(false);
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-card border border-dark-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                <span>Group Management Hub: {group.name}</span>
                <span className="font-mono text-[10px] bg-dark-border px-2 py-0.5 rounded text-amber-400 font-bold">
                  {group.joinCode}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Full administration over membership, join requests, invitations, and access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-dark-border bg-dark-surface/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('join_requests')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'join_requests'
                ? 'border-flame-500 text-flame-400 bg-dark-card'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Join Requests ({joinRequests.filter((r) => r.status === 'PENDING').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'invitations'
                ? 'border-flame-500 text-flame-400 bg-dark-card'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Active Invitations ({invitations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('force_add')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'force_add'
                ? 'border-flame-500 text-flame-400 bg-dark-card'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>➕ Force-Add Member</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 space-y-4">
          {/* TAB 1: JOIN REQUESTS */}
          {activeTab === 'join_requests' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">
                  Pending Member Join Requests
                </span>
                <button
                  type="button"
                  onClick={loadJoinRequests}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin text-flame-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {joinRequests.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-8 text-center bg-dark-surface/30 rounded-xl border border-dashed border-dark-border">
                  No pending join requests found for this group.
                </p>
              ) : (
                <div className="space-y-2">
                  {joinRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">{req.user?.name}</span>
                          <span className="text-zinc-500 font-mono">(@{req.user?.username})</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              req.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : req.status === 'ACCEPTED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                          Requested on {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRespondJoinRequest(req.id, req.user?.username, 'APPROVE')}
                            className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondJoinRequest(req.id, req.user?.username, 'REJECT')}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVITATIONS */}
          {activeTab === 'invitations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">
                  Active Group Invitations & Links
                </span>
                <button
                  type="button"
                  onClick={loadInvitations}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInvitations ? 'animate-spin text-flame-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {invitations.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-8 text-center bg-dark-surface/30 rounded-xl border border-dashed border-dark-border">
                  No active invitations for this group.
                </p>
              ) : (
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">
                            {inv.inviteeEmail || inv.inviteeUser?.username || 'Open Invite Link'}
                          </span>
                          <span className="font-mono text-[10px] bg-dark-border px-1.5 py-0.5 rounded text-amber-400">
                            Code: {inv.code}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                          Created by @{inv.inviter?.username || 'member'} • Expires:{' '}
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleCancelInvitation(inv.id, inv.inviteeEmail || inv.code)
                        }
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FORCE-ADD MEMBER */}
          {activeTab === 'force_add' && (
            <form onSubmit={handleForceAddMember} className="space-y-4">
              <div className="bg-dark-surface/40 border border-dark-border rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-zinc-200 block">
                  Find User to Add Directly to "{group.name}"
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchUserToAdd();
                      }
                    }}
                    placeholder="Search by username or email..."
                    className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearchUserToAdd}
                    disabled={isSearchingUser}
                    className="px-3 py-2 bg-dark-border hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </button>
                </div>

                {userSearchResults.length > 0 && !selectedUserToAdd && (
                  <div className="bg-dark-surface border border-dark-border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                    {userSearchResults.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedUserToAdd(u)}
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

                {selectedUserToAdd && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs flex items-center justify-between">
                    <span className="text-emerald-300">
                      Selected: <strong>{selectedUserToAdd.name}</strong> (@{selectedUserToAdd.username})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserToAdd(null)}
                      className="text-zinc-400 hover:text-zinc-200 text-xs"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Membership Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  >
                    <option value="MEMBER">MEMBER (Standard Access)</option>
                    <option value="ADMIN">ADMIN (Group Moderator Privileges)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Administrative Reason (Logged)
                  </label>
                  <input
                    type="text"
                    value={forceAddReason}
                    onChange={(e) => setForceAddReason(e.target.value)}
                    placeholder="e.g. User onboarding / requested direct access"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingAdd || !selectedUserToAdd}
                  className="px-4 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Member Directly</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
