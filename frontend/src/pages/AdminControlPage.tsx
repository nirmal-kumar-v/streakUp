import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Flame,
  Snowflake,
  Coins,
  Clock,
  Lock,
  User,
  History,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  adminLogin,
  fetchAdminProfile,
  changeAdminCredentials,
  fetchAdminAuditLogs,
  searchAdminUsers,
  fetchAdminUserDetails,
  overrideUsernameCooldown,
  correctUserStreak,
  adjustUserFreezes,
  adjustUserPoints,
  overrideUserLimit15,
  deleteUserAccountByAdmin,
  AdminUser,
  AdminAuditLogItem,
} from '../api/admin';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';

export const AdminControlPage: React.FC = () => {
  const toast = useToast();

  // Admin Auth State
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeAdmin, setActiveAdmin] = useState<any>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'security'>('users');

  // Search & Selected User State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Action Form States
  const [streakType, setStreakType] = useState<'OVERALL' | 'TASK'>('OVERALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [newStreakValue, setNewStreakValue] = useState<number>(0);
  const [newLongestStreak, setNewLongestStreak] = useState<number>(0);
  const [streakReason, setStreakReason] = useState('');
  const [isSubmittingStreak, setIsSubmittingStreak] = useState(false);

  // Freeze adjustment state
  const [newFreezeBalance, setNewFreezeBalance] = useState<number>(0);
  const [newFreezeRechargeDays, setNewFreezeRechargeDays] = useState<number>(0);
  const [historicalFreezeDate, setHistoricalFreezeDate] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false);

  // Points adjustment state
  const [pointsDelta, setPointsDelta] = useState<number>(0);
  const [pointsReason, setPointsReason] = useState('');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);

  // Limit of 15 (starred notifications) override state
  const [newStarredLimit, setNewStarredLimit] = useState<number>(15);
  const [limit15Reason, setLimit15Reason] = useState('');
  const [isSubmittingLimit15, setIsSubmittingLimit15] = useState(false);

  // Username cooldown state
  const [overrideNewUsername, setOverrideNewUsername] = useState('');
  const [usernameReason, setUsernameReason] = useState('');
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);

  // Account deletion state
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSensitivePin, setDeleteSensitivePin] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Admin Security State
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newSensitivePin, setNewSensitivePin] = useState('');
  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);

  // Verify existing admin token on mount
  useEffect(() => {
    const token = localStorage.getItem('streakup_admin_token');
    if (token) {
      fetchAdminProfile()
        .then((res) => {
          if (res.success) {
            setIsAdminAuth(true);
            setActiveAdmin(res.admin);
          }
        })
        .catch(() => {
          localStorage.removeItem('streakup_admin_token');
          setIsAdminAuth(false);
        });
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      toast.error('Username and password are required.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await adminLogin(adminUsername, adminPassword);
      if (res.success) {
        localStorage.setItem('streakup_admin_token', res.token);
        setIsAdminAuth(true);
        setActiveAdmin(res.admin);
        toast.info('Super Admin authenticated successfully.');
        handleSearchUsers('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Admin authentication failed.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('streakup_admin_token');
    setIsAdminAuth(false);
    setActiveAdmin(null);
    setSelectedUserId(null);
    setSelectedUserDetails(null);
    toast.info('Signed out of Admin Control.');
  };

  const handleSearchUsers = async (q: string = searchQuery) => {
    setIsSearching(true);
    try {
      const res = await searchAdminUsers(q.trim());
      if (res.success) {
        setSearchResults(res.users || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to search users.'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user: AdminUser) => {
    setSelectedUserId(user.id);
    setIsLoadingDetails(true);
    try {
      const res = await fetchAdminUserDetails(user.id);
      if (res.success) {
        setSelectedUserDetails(res.user);
        // Pre-fill fields
        setNewStreakValue(res.user.currentStreak || 0);
        setNewLongestStreak(res.user.longestStreak || 0);
        setNewFreezeBalance(res.user.overallFreezeBalance || 0);
        setNewFreezeRechargeDays(res.user.overallFreezeRechargeDays || 0);
        setNewStarredLimit(res.user.maxStarredNotifications || 15);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to load user details.'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetchAdminAuditLogs({ limit: 50 });
      if (res.success) {
        setAuditLogs(res.logs || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to load audit logs.'));
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAdminAuth && activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [isAdminAuth, activeTab]);

  // Actions
  const handleStreakCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!streakReason.trim()) {
      toast.error('An administrative reason is mandatory for streak adjustments.');
      return;
    }
    setIsSubmittingStreak(true);
    try {
      const res = await correctUserStreak(selectedUserId, {
        type: streakType,
        taskId: streakType === 'TASK' ? selectedTaskId : undefined,
        currentStreak: Number(newStreakValue),
        longestStreak: Number(newLongestStreak),
        reason: streakReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setStreakReason('');
        handleSelectUser(selectedUserDetails);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to correct streak.'));
    } finally {
      setIsSubmittingStreak(false);
    }
  };

  const handleFreezeAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!freezeReason.trim()) {
      toast.error('An administrative reason is mandatory for freeze adjustments.');
      return;
    }
    setIsSubmittingFreeze(true);
    try {
      const res = await adjustUserFreezes(selectedUserId, {
        overallFreezeBalance: Number(newFreezeBalance),
        overallFreezeRechargeDays: Number(newFreezeRechargeDays),
        historicalFreezeDate: historicalFreezeDate.trim() || undefined,
        reason: freezeReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setFreezeReason('');
        setHistoricalFreezeDate('');
        handleSelectUser(selectedUserDetails);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to adjust freezes.'));
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  const handlePointsAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!pointsReason.trim()) {
      toast.error('An administrative reason is mandatory for points adjustments.');
      return;
    }
    setIsSubmittingPoints(true);
    try {
      const res = await adjustUserPoints(selectedUserId, {
        pointsDelta: Number(pointsDelta),
        reason: pointsReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setPointsReason('');
        setPointsDelta(0);
        handleSelectUser(selectedUserDetails);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to adjust points.'));
    } finally {
      setIsSubmittingPoints(false);
    }
  };

  const handleLimit15Override = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!limit15Reason.trim()) {
      toast.error('An administrative reason is mandatory for overriding the limit of 15.');
      return;
    }
    setIsSubmittingLimit15(true);
    try {
      const res = await overrideUserLimit15(selectedUserId, {
        maxStarredNotifications: Number(newStarredLimit),
        reason: limit15Reason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setLimit15Reason('');
        handleSelectUser(selectedUserDetails);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to override limit of 15.'));
    } finally {
      setIsSubmittingLimit15(false);
    }
  };

  const handleUsernameOverride = async (resetOnly: boolean) => {
    if (!selectedUserId) return;
    if (!usernameReason.trim()) {
      toast.error('An administrative reason is mandatory for username cooldown overrides.');
      return;
    }
    setIsSubmittingUsername(true);
    try {
      const res = await overrideUsernameCooldown(selectedUserId, {
        resetCooldownOnly: resetOnly,
        newUsername: !resetOnly ? overrideNewUsername.trim() : undefined,
        reason: usernameReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setUsernameReason('');
        setOverrideNewUsername('');
        handleSelectUser(selectedUserDetails);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to override username restriction.'));
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  const handleDeleteUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!deleteReason.trim() || !deleteSensitivePin.trim()) {
      toast.error('Both administrative reason and sensitive PIN confirmation are required.');
      return;
    }
    if (!window.confirm(`Are you ABSOLUTELY sure you want to permanently delete @${selectedUserDetails?.username}? This action is irreversible.`)) {
      return;
    }
    setIsSubmittingDelete(true);
    try {
      const res = await deleteUserAccountByAdmin(selectedUserId, {
        reason: deleteReason.trim(),
        sensitivePin: deleteSensitivePin.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setSelectedUserId(null);
        setSelectedUserDetails(null);
        setDeleteReason('');
        setDeleteSensitivePin('');
        handleSearchUsers('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to delete user account.'));
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleUpdateAdminSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdminPassword) {
      toast.error('Current password is required.');
      return;
    }
    setIsSubmittingSecurity(true);
    try {
      const res = await changeAdminCredentials({
        currentPassword: currentAdminPassword,
        newPassword: newAdminPassword.trim() || undefined,
        newSensitivePin: newSensitivePin.trim() || undefined,
      });
      if (res.success) {
        toast.info(res.message);
        setCurrentAdminPassword('');
        setNewAdminPassword('');
        setNewSensitivePin('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update admin security.'));
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

  // ==========================================
  // RENDER: LOGIN MODAL IF NOT AUTHENTICATED
  // ==========================================
  if (!isAdminAuth) {
    return (
      <div className="min-h-screen bg-dark-bg text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-flame-500 to-rose-500" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100">StreakUp Super Admin</h1>
              <p className="text-xs text-dark-muted">Restricted Privileged Control Center</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Username</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="e.g. admin"
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all mt-2"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In as Super Admin'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-dark-border text-[11px] text-zinc-500 text-center">
            All administrative actions are cryptographically signed & recorded in the immutable audit ledger.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SUPER ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-dark-bg text-zinc-100 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-dark-card/90 backdrop-blur-md border-b border-dark-border px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-zinc-100">Super Admin Control Panel</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-flame-500/10 border border-flame-500/30 text-flame-400 font-bold">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">StreakUp Multi-Tenant Management & Override Ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-surface border border-dark-border text-xs text-zinc-300">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span>@{activeAdmin?.username || 'admin'}</span>
          </div>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-dark-border pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-flame-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <User className="w-4 h-4" />
            User Controls & Streaks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-flame-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <History className="w-4 h-4" />
            Audit Ledger Trail
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-flame-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Lock className="w-4 h-4" />
            Admin Security & PIN
          </button>
        </div>

        {/* TAB 1: USERS & CONTROLS */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Search & User Directory */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchUsers();
                  }}
                  className="flex items-center gap-2 mb-3"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by username, name, email or ID..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shrink-0"
                  >
                    Search
                  </button>
                </form>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {isSearching ? (
                    <div className="py-8 text-center text-xs text-dark-muted">Searching users...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-dark-muted">
                      No users loaded. Click Search to list users.
                    </div>
                  ) : (
                    searchResults.map((user) => {
                      const isSelected = user.id === selectedUserId;
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-flame-500/10 border-flame-500/50 text-zinc-100'
                              : 'bg-dark-surface/60 border-dark-border hover:border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <span>{user.name}</span>
                                <span className="text-[11px] text-zinc-400 font-mono">@{user.username}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate max-w-[200px] sm:max-w-[250px]">
                                {user.email}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                          </div>

                          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3 text-flame-400" />
                              <span>{user.currentStreak}d</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Coins className="w-3 h-3 text-amber-400" />
                              <span>{user.points || 0} pts</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Snowflake className="w-3 h-3 text-cyan-400" />
                              <span>{user.overallFreezeBalance} / 7</span>
                            </span>
                            <span className="font-mono text-zinc-500">
                              Limit: {user.maxStarredNotifications || 15}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Selected User Inspector & Override Actions */}
            <div className="lg:col-span-7 space-y-4">
              {isLoadingDetails ? (
                <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center text-zinc-400 shadow-panel">
                  <div className="w-6 h-6 border-2 border-flame-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-dark-muted">Loading user profile and metrics...</p>
                </div>
              ) : !selectedUserDetails ? (
                <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center text-zinc-400 shadow-panel">
                  <User className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-zinc-200">Select a User</h3>
                  <p className="text-xs text-dark-muted mt-1">
                    Choose a user from the left directory to inspect metrics, adjust streaks, override freezes, modify points, or clear 14-day username limits.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* User Profile Summary Card */}
                  <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-zinc-100">{selectedUserDetails.name}</h2>
                          <span className="text-xs font-mono font-bold text-flame-400">@{selectedUserDetails.username}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{selectedUserDetails.email}</p>
                        <p className="text-[11px] font-mono text-zinc-500 mt-0.5">ID: {selectedUserDetails.id}</p>
                      </div>

                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                        Timezone: {selectedUserDetails.timezone}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-dark-border">
                      <div className="p-2.5 rounded-xl bg-dark-surface border border-dark-border">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-flame-400" /> Overall Streak
                        </span>
                        <p className="text-base font-extrabold text-zinc-100 mt-0.5">
                          {selectedUserDetails.currentStreak} <span className="text-[10px] text-zinc-500">days</span>
                        </p>
                        <p className="text-[10px] text-zinc-500">Longest: {selectedUserDetails.longestStreak}d</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-dark-surface border border-dark-border">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-400" /> Points Balance
                        </span>
                        <p className="text-base font-extrabold text-amber-300 mt-0.5">
                          {selectedUserDetails.points || 0}
                        </p>
                        <p className="text-[10px] text-zinc-500">Ledger Audited</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-dark-surface border border-dark-border">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Snowflake className="w-3 h-3 text-cyan-400" /> Freezes
                        </span>
                        <p className="text-base font-extrabold text-cyan-300 mt-0.5">
                          {selectedUserDetails.overallFreezeBalance} / 7
                        </p>
                        <p className="text-[10px] text-zinc-500">Recharge: {selectedUserDetails.overallFreezeRechargeDays}d</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-dark-surface border border-dark-border">
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" /> Starred Limit
                        </span>
                        <p className="text-base font-extrabold text-purple-300 mt-0.5">
                          {selectedUserDetails.maxStarredNotifications || 15}
                        </p>
                        <p className="text-[10px] text-zinc-500">Default: 15</p>
                      </div>
                    </div>
                  </div>

                  {/* ACTION 1: STREAK CORRECTION */}
                  <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
                    <h3 className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5 mb-3">
                      <Flame className="w-4 h-4 text-flame-400" />
                      Streak Correction & Recalculation
                    </h3>

                    <form onSubmit={handleStreakCorrection} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Target Streak Scope</label>
                          <select
                            value={streakType}
                            onChange={(e) => setStreakType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          >
                            <option value="OVERALL">Overall User Streak</option>
                            <option value="TASK">Specific Personal / Group Task</option>
                          </select>
                        </div>

                        {streakType === 'TASK' && (
                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Select Task</label>
                            <select
                              value={selectedTaskId}
                              onChange={(e) => setSelectedTaskId(e.target.value)}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            >
                              <option value="">Choose task...</option>
                              {selectedUserDetails.tasks?.map((t: any) => (
                                <option key={t.id} value={t.id}>
                                  {t.title} {t.isGroupTask ? '(Group Task)' : ''} · Current: {t.currentStreak}d
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-300 mb-1">New Current Streak</label>
                          <input
                            type="number"
                            min="0"
                            value={newStreakValue}
                            onChange={(e) => setNewStreakValue(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-300 mb-1">New Longest Streak</label>
                          <input
                            type="number"
                            min="0"
                            value={newLongestStreak}
                            onChange={(e) => setNewLongestStreak(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                          Mandatory Administrative Reason
                        </label>
                        <input
                          type="text"
                          value={streakReason}
                          onChange={(e) => setStreakReason(e.target.value)}
                          placeholder="e.g. Verified database timezone glitch recovery for GATE habit"
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingStreak}
                        className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        {isSubmittingStreak ? 'Saving...' : 'Apply Streak Correction'}
                      </button>
                    </form>
                  </div>

                  {/* ACTION 2: FREEZES & LIMIT OF 15 */}
                  <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
                    <h3 className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5 mb-3">
                      <Snowflake className="w-4 h-4 text-cyan-400" />
                      Freeze Adjustment & Starred Notifications Limit (Limit of 15)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Freezes Form */}
                      <form onSubmit={handleFreezeAdjustment} className="space-y-3 p-3 rounded-xl bg-dark-surface/50 border border-dark-border">
                        <span className="text-[11px] font-bold text-cyan-300 block">Freeze Controls</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-1">Freeze Balance (0-7)</label>
                            <input
                              type="number"
                              min="0"
                              max="7"
                              value={newFreezeBalance}
                              onChange={(e) => setNewFreezeBalance(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-1">Recharge Days</label>
                            <input
                              type="number"
                              min="0"
                              value={newFreezeRechargeDays}
                              onChange={(e) => setNewFreezeRechargeDays(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Historical Freeze Override Date (YYYY-MM-DD)
                          </label>
                          <input
                            type="text"
                            value={historicalFreezeDate}
                            onChange={(e) => setHistoricalFreezeDate(e.target.value)}
                            placeholder="e.g. 2026-10-17"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Reason</label>
                          <input
                            type="text"
                            value={freezeReason}
                            onChange={(e) => setFreezeReason(e.target.value)}
                            placeholder="Reason for freeze update"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingFreeze}
                          className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs rounded-lg transition-all"
                        >
                          {isSubmittingFreeze ? 'Saving...' : 'Update Freezes'}
                        </button>
                      </form>

                      {/* Limit of 15 Override Form */}
                      <form onSubmit={handleLimit15Override} className="space-y-3 p-3 rounded-xl bg-dark-surface/50 border border-dark-border flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-purple-300 block mb-1">
                            Per-User Override for Limit of 15
                          </span>
                          <p className="text-[10px] text-zinc-500 mb-3">
                            StreakUp defaults to max 15 starred notifications per user (which prevents them from auto-expiring after 15 days). You can override this limit.
                          </p>

                          <label className="block text-[10px] text-zinc-400 mb-1">Max Starred Notifications Limit</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={newStarredLimit}
                            onChange={(e) => setNewStarredLimit(parseInt(e.target.value, 10) || 15)}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100 mb-2"
                            required
                          />

                          <label className="block text-[10px] text-zinc-400 mb-1">Reason</label>
                          <input
                            type="text"
                            value={limit15Reason}
                            onChange={(e) => setLimit15Reason(e.target.value)}
                            placeholder="e.g. VIP scholar extended limit"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingLimit15}
                          className="w-full py-1.5 bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-xs rounded-lg transition-all mt-2"
                        >
                          {isSubmittingLimit15 ? 'Saving...' : 'Override Limit of 15'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* ACTION 3: POINTS & USERNAME COOLDOWN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Points Adjustment */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
                      <h3 className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5 mb-2">
                        <Coins className="w-4 h-4 text-amber-400" /> Points Ledger Adjustment
                      </h3>
                      <form onSubmit={handlePointsAdjustment} className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Points Delta (+/- integer)</label>
                          <input
                            type="number"
                            value={pointsDelta}
                            onChange={(e) => setPointsDelta(parseInt(e.target.value, 10) || 0)}
                            placeholder="+50 or -20"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Reason</label>
                          <input
                            type="text"
                            value={pointsReason}
                            onChange={(e) => setPointsReason(e.target.value)}
                            placeholder="e.g. Bonus competition credit"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmittingPoints}
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-all"
                        >
                          {isSubmittingPoints ? 'Saving...' : 'Apply Points Correction'}
                        </button>
                      </form>
                    </div>

                    {/* Username Cooldown Override */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
                      <h3 className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5 mb-2">
                        <Clock className="w-4 h-4 text-emerald-400" /> Username 14-Day Cooldown
                      </h3>
                      <p className="text-[11px] text-zinc-500 mb-3">
                        Last change: {selectedUserDetails.lastUsernameChangeAt ? new Date(selectedUserDetails.lastUsernameChangeAt).toLocaleDateString() : 'Never changed'}
                      </p>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Reason for Cooldown Override</label>
                          <input
                            type="text"
                            value={usernameReason}
                            onChange={(e) => setUsernameReason(e.target.value)}
                            placeholder="Reason for early username change"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUsernameOverride(true)}
                            disabled={isSubmittingUsername}
                            className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-lg transition-all"
                          >
                            Reset 14-Day Lock
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SENSITIVE ACTION: ACCOUNT DELETION */}
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 shadow-panel">
                    <h3 className="text-xs font-extrabold text-rose-400 flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-4 h-4" /> Sensitive Action: Delete Account
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      Permanently wipes user account, memberships, tasks, completions, and friendships. Requires secondary sensitive PIN authorization.
                    </p>

                    <form onSubmit={handleDeleteUserAccount} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Deletion Reason</label>
                          <input
                            type="text"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder="e.g. User GDPR requested deletion"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Admin Sensitive PIN / Password</label>
                          <input
                            type="password"
                            value={deleteSensitivePin}
                            onChange={(e) => setDeleteSensitivePin(e.target.value)}
                            placeholder="Enter Sensitive Action PIN"
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-xs text-zinc-100"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingDelete}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition-all"
                      >
                        {isSubmittingDelete ? 'Deleting...' : `Permanently Delete @${selectedUserDetails.username}`}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">Administrative Audit Trail</h2>
                <p className="text-xs text-dark-muted">Chronological ledger of all privileged changes, overrides, and administrative actions.</p>
              </div>
              <button
                type="button"
                onClick={loadAuditLogs}
                disabled={isLoadingLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-surface hover:bg-zinc-800 text-zinc-300 border border-dark-border text-xs font-semibold rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-dark-border text-zinc-400 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-dark-muted">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-dark-surface/40 transition-colors">
                        <td className="py-2 px-3 text-zinc-500 font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-zinc-200">
                          @{log.adminUsername}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-flame-500/10 border border-flame-500/20 text-flame-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-300">
                          {log.targetUser || log.targetUserId || 'System'}
                        </td>
                        <td className="py-2 px-3 text-zinc-400 truncate max-w-[250px]">
                          {log.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN SECURITY */}
        {activeTab === 'security' && (
          <div className="max-w-xl mx-auto bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-flame-400" /> Admin Credentials & Sensitive Action PIN
              </h2>
              <p className="text-xs text-dark-muted mt-1">
                Configure your Super Admin password and an independent secondary PIN required for irreversible sensitive actions.
              </p>
            </div>

            <form onSubmit={handleUpdateAdminSecurity} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Current Admin Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  New Admin Password (Optional)
                </label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  New Sensitive Action PIN (Optional)
                </label>
                <input
                  type="password"
                  value={newSensitivePin}
                  onChange={(e) => setNewSensitivePin(e.target.value)}
                  placeholder="Min 4 digits/characters (default: 1234)"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  This PIN is required before sensitive operations (e.g., account deletions).
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSecurity}
                className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                {isSubmittingSecurity ? 'Updating...' : 'Save Updated Admin Security'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
export default AdminControlPage;
