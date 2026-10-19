import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminManagers,
  grantAdminManager,
  revokeAdminManager,
  updateAdminManagerEmail,
  searchAdminUsers,
  AdminManager,
  AdminUser,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';
import {
  ShieldCheck,
  UserPlus,
  UserMinus,
  Mail,
  Search,
  RefreshCw,
} from 'lucide-react';

export const AdminManagersTab: React.FC = () => {
  const toast = useToast();
  const [managers, setManagers] = useState<AdminManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // User search for granting access
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Action in progress state
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [confirmRevokeUserId, setConfirmRevokeUserId] = useState<string | null>(null);

  const loadManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminManagers();
      if (res.success) {
        setManagers(res.managers || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to fetch managers.'));
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await searchAdminUsers(searchQuery.trim());
      if (res.success) {
        setSearchResults(res.users || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to search users.'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleGrantManager = async (user: AdminUser) => {
    setActionUserId(user.id);
    try {
      const res = await grantAdminManager({
        userId: user.id,
        emailNotificationsEnabled: true,
      });
      if (res.success) {
        toast.success(`Manager access granted to @${user.username}.`);
        loadManagers();
        setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to grant manager access.'));
    } finally {
      setActionUserId(null);
    }
  };

  const handleRevokeManager = async (userId: string) => {
    setActionUserId(userId);
    try {
      const res = await revokeAdminManager(userId);
      if (res.success) {
        toast.info('Manager access revoked successfully.');
        setManagers((prev) => prev.filter((m) => m.userId !== userId));
        setConfirmRevokeUserId(null);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to revoke manager access.'));
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleEmailNotifications = async (
    userId: string,
    currentEnabled: boolean
  ) => {
    setActionUserId(userId);
    try {
      const res = await updateAdminManagerEmail(userId, !currentEnabled);
      if (res.success) {
        setManagers((prev) =>
          prev.map((m) =>
            m.userId === userId
              ? { ...m, emailNotificationsEnabled: !currentEnabled }
              : m
          )
        );
        toast.success(
          `Email notifications ${!currentEnabled ? 'enabled' : 'disabled'} for manager.`
        );
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update email preferences.'));
    } finally {
      setActionUserId(null);
    }
  };

  const isUserAlreadyManager = (userId: string) => {
    return managers.some((m) => m.userId === userId);
  };

  return (
    <div className="space-y-6">
      {/* Header & Role Clarification */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-flame-500" />
            <h2 className="text-sm font-bold text-zinc-100">Manager Access Control</h2>
          </div>
          <button
            onClick={loadManagers}
            disabled={isLoading}
            className="px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-xs text-dark-muted leading-relaxed">
          Managers receive in-app and optional email notifications whenever users submit new Requests & Feedback.
          Managers have <strong className="text-zinc-200">no access</strong> to the Super Admin Control Panel, user streaks, points, or administrative modifications.
        </p>
      </div>

      {/* Grant Access: User Search Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-flame-400" />
          <span>Grant Manager Access</span>
        </h3>

        <form onSubmit={handleSearchUsers} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name, @username, email, or user ID..."
              className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-flame-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Find User</span>
          </button>
        </form>

        {/* Search Results */}
        {hasSearched && (
          <div className="pt-2">
            {searchResults.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-3 bg-dark-surface/30 rounded-xl">
                No users found matching "{searchQuery}".
              </p>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] text-dark-muted font-medium">
                  Search Results ({searchResults.length}):
                </span>
                <div className="divide-y divide-dark-border/40 rounded-xl border border-dark-border overflow-hidden bg-dark-surface/40">
                  {searchResults.map((user) => {
                    const already = isUserAlreadyManager(user.id);
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200">{user.name}</span>
                            <span className="text-flame-400 font-mono">@{user.username}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500">{user.email}</span>
                        </div>

                        {already ? (
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                            Already Manager
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGrantManager(user)}
                            disabled={actionUserId === user.id}
                            className="px-3 py-1.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                          >
                            {actionUserId === user.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            <span>Grant Manager Access</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current Managers List */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-flame-400" />
            <span>Active Managers ({managers.length})</span>
          </h3>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-dark-muted">
            <RefreshCw className="w-4 h-4 animate-spin text-flame-500 mx-auto mb-2" />
            <span>Loading managers...</span>
          </div>
        ) : managers.length === 0 ? (
          <div className="p-8 text-center bg-dark-surface/30 rounded-xl space-y-1">
            <p className="text-xs font-medium text-zinc-300">No active managers configured.</p>
            <p className="text-[11px] text-dark-muted">
              Use the search above to grant Manager access to trusted team members.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border/60 rounded-xl border border-dark-border overflow-hidden bg-dark-surface/40">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100">{manager.name}</span>
                    <span className="text-flame-400 font-mono">@{manager.username}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-2 font-mono">
                    <span>{manager.email}</span>
                    <span>•</span>
                    <span>Granted: {new Date(manager.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Email Notifications Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleEmailNotifications(
                        manager.userId,
                        manager.emailNotificationsEnabled
                      )
                    }
                    disabled={actionUserId === manager.userId}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      manager.emailNotificationsEnabled
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-dark-surface text-zinc-500 border-dark-border hover:bg-dark-hover'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>
                      Email Alerts: {manager.emailNotificationsEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>

                  {/* Revoke Button with Confirmation */}
                  {confirmRevokeUserId === manager.userId ? (
                    <div className="flex items-center gap-1.5 p-1 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                      <span className="text-rose-300 text-[11px] px-1 font-semibold">
                        Confirm revoke?
                      </span>
                      <button
                        onClick={() => handleRevokeManager(manager.userId)}
                        disabled={actionUserId === manager.userId}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs"
                      >
                        {actionUserId === manager.userId ? '...' : 'Yes, Revoke'}
                      </button>
                      <button
                        onClick={() => setConfirmRevokeUserId(null)}
                        className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevokeUserId(manager.userId)}
                      disabled={actionUserId === manager.userId}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Revoke Access</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
