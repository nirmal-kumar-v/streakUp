import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronLeft,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  KeyRound,
  Trash2,
  Copy,
  Bell,
  MessageSquare,
  Award,
  Tag,
  Eye,
  EyeOff,
  Mail,
  X,
  Sliders,
  Globe,
} from 'lucide-react';
import {
  adminLogin,
  fetchAdminProfile,
  changeAdminCredentials,
  fetchAdminAuditLogs,
  deleteAdminAuditLog,
  clearAdminAuditLogs,
  searchAdminUsers,
  fetchAdminUserDetails,
  overrideUsernameCooldown,
  overrideEmailCooldown,
  toggleUserEmailVerification,
  updateUserTimezone,
  correctUserStreak,
  grantDayStreak,
  adjustUserFreezes,
  adjustUserPoints,
  overrideUserLimit15,
  resetNudgeCooldown,
  adminManageGroupMember,
  adminRecoverGroupTask,
  adminModerateStudyNote,
  deleteUserAccountByAdmin,
  adminUpdateTaskFull,
  adminUpdateGroupFull,
  unfreezeUserDate,
  adminDeleteReminderSchedule,
  overrideLeaderboardLimit,
  AdminUser,
  AdminAuditLogItem,
} from '../api/admin';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';

export const AdminControlPage: React.FC = () => {
  const toast = useToast();

  // ------------------------------------------
  // Admin Auth State
  // ------------------------------------------
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeAdmin, setActiveAdmin] = useState<any>(null);

  // ------------------------------------------
  // Primary Tabs: users | audit | security
  // ------------------------------------------
  const [primaryTab, setPrimaryTab] = useState<'users' | 'audit' | 'security'>('users');

  // ------------------------------------------
  // User Search & Selected User State
  // ------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Sub-tabs inside Selected User Control Center
  const [userTab, setUserTab] = useState<
    'overview' | 'username_email' | 'streaks' | 'points' | 'limits' | 'tasks_groups' | 'danger'
  >('overview');

  // ------------------------------------------
  // PIN Modal State for High-Risk Actions
  // ------------------------------------------
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalTitle, setPinModalTitle] = useState('');
  const [pinModalDescription, setPinModalDescription] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pendingPinAction, setPendingPinAction] = useState<((pin: string) => Promise<void>) | null>(null);
  const [isSubmittingPinAction, setIsSubmittingPinAction] = useState(false);
  const [showPinPassword, setShowPinPassword] = useState(false);

  // ------------------------------------------
  // User Notification Dispatch Options
  // ------------------------------------------
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyIncludeReason, setNotifyIncludeReason] = useState(true);
  const [notifyIncludeChanges, setNotifyIncludeChanges] = useState(true);

  // ------------------------------------------
  // Heatmap Day Activity & Streak Control Modal
  // ------------------------------------------
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState('');
  const [dayModalMode, setDayModalMode] = useState<'STREAK' | 'FREEZE' | 'UNFREEZE'>('STREAK');
  const [dayModalTaskId, setDayModalTaskId] = useState('');
  const [dayModalNote, setDayModalNote] = useState('');
  const [dayModalReason, setDayModalReason] = useState('');
  const [isSubmittingDayAction, setIsSubmittingDayAction] = useState(false);

  // ------------------------------------------
  // Form States for Controls
  // ------------------------------------------
  // Username & Email
  const [overrideNewUsername, setOverrideNewUsername] = useState('');
  const [usernameReason, setUsernameReason] = useState('');
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);

  const [overrideNewEmail, setOverrideNewEmail] = useState('');
  const [emailReason, setEmailReason] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  // Timezone
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Kolkata');
  const [timezoneReason, setTimezoneReason] = useState('');
  const [isSubmittingTimezone, setIsSubmittingTimezone] = useState(false);

  // Streaks
  const [streakTargetType, setStreakTargetType] = useState<'OVERALL' | 'TASK'>('OVERALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [newCurrentStreak, setNewCurrentStreak] = useState<number>(0);
  const [newLongestStreak, setNewLongestStreak] = useState<number>(0);
  const [streakReason, setStreakReason] = useState('');
  const [isSubmittingStreak, setIsSubmittingStreak] = useState(false);


  // Points
  const [pointsDelta, setPointsDelta] = useState<number>(0);
  const [pointsReason, setPointsReason] = useState('');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);

  // Limits
  const [newStarredLimit, setNewStarredLimit] = useState<number>(15);
  const [limitReason, setLimitReason] = useState('');
  const [isSubmittingLimit, setIsSubmittingLimit] = useState(false);

  const [newLeaderboardLimit, setNewLeaderboardLimit] = useState<number>(10);
  const [leaderboardReason, setLeaderboardReason] = useState('');
  const [isSubmittingLeaderboardLimit, setIsSubmittingLeaderboardLimit] = useState(false);

  // Full Task Settings Modal State
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState('');
  const [taskEditDescription, setTaskEditDescription] = useState('');
  const [taskEditCategory, setTaskEditCategory] = useState('');
  const [taskEditPriority, setTaskEditPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [taskEditRecurrence, setTaskEditRecurrence] = useState<'DAILY' | 'ONE_TIME'>('DAILY');
  const [taskEditStatus, setTaskEditStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [taskEditHiddenFrom, setTaskEditHiddenFrom] = useState<string[]>([]);
  const [taskEditVisibleOnlyTo, setTaskEditVisibleOnlyTo] = useState<string[]>([]);
  const [taskEditReason, setTaskEditReason] = useState('');
  const [isSubmittingTaskEdit, setIsSubmittingTaskEdit] = useState(false);

  // Full Group Settings Modal State
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditDescription, setGroupEditDescription] = useState('');
  const [groupEditJoinCode, setGroupEditJoinCode] = useState('');
  const [groupEditOwnerId, setGroupEditOwnerId] = useState('');
  const [groupEditHiddenFrom, setGroupEditHiddenFrom] = useState<string[]>([]);
  const [groupEditVisibleOnlyTo, setGroupEditVisibleOnlyTo] = useState<string[]>([]);
  const [groupEditReason, setGroupEditReason] = useState('');
  const [isSubmittingGroupEdit, setIsSubmittingGroupEdit] = useState(false);

  // User Search Autocomplete State (for privacy chips & group transfer)
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchMatches, setUserSearchMatches] = useState<AdminUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [activeSearchTarget, setActiveSearchTarget] = useState<
    'TASK_HIDDEN' | 'TASK_VISIBLE' | 'GROUP_HIDDEN' | 'GROUP_VISIBLE' | 'GROUP_OWNER' | null
  >(null);

  // Moderation & Tasks
  const [editingCompletionId, setEditingCompletionId] = useState<string | null>(null);
  const [editingStudyNote, setEditingStudyNote] = useState('');
  const [clearNoteReactions, setClearNoteReactions] = useState(false);
  const [moderationReason, setModerationReason] = useState('');
  const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);

  // Delete User
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  // ------------------------------------------
  // Audit Logs State
  // ------------------------------------------
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // ------------------------------------------
  // Admin Security State
  // ------------------------------------------
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminSensitivePin, setNewAdminSensitivePin] = useState('');
  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);

  // ------------------------------------------
  // Verify token on mount
  // ------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem('streakup_admin_token');
    if (token) {
      fetchAdminProfile()
        .then((res) => {
          if (res.success) {
            setIsAdminAuth(true);
            setActiveAdmin(res.admin);
            handleSearchUsers('');
          }
        })
        .catch(() => {
          localStorage.removeItem('streakup_admin_token');
          setIsAdminAuth(false);
        });
    }
  }, []);

  // ------------------------------------------
  // Debounced auto-search on searchQuery change
  // ------------------------------------------
  useEffect(() => {
    if (!isAdminAuth) return;
    const timer = setTimeout(() => {
      handleSearchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isAdminAuth]);

  // ------------------------------------------
  // Auth Handlers
  // ------------------------------------------
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
    toast.info('Signed out of Super Admin Panel.');
  };

  // ------------------------------------------
  // User Search & Selection
  // ------------------------------------------
  const handleSearchUsers = async (q: string = searchQuery) => {
    setIsSearching(true);
    try {
      const res = await searchAdminUsers(q.trim());
      if (res.success) {
        setSearchResults(res.users || []);
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('streakup_admin_token');
        setIsAdminAuth(false);
        toast.error('Admin session expired or unauthorized. Please sign in with Super Admin credentials.');
        return;
      }
      toast.error(extractErrorMessage(err, 'Failed to search users.'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user: AdminUser | { id: string }) => {
    setSelectedUserId(user.id);
    setIsLoadingDetails(true);
    try {
      const res = await fetchAdminUserDetails(user.id);
      if (res.success) {
        const u = res.user;
        setSelectedUserDetails(u);

        // Pre-fill fields for smooth experience
        setNewCurrentStreak(u.currentStreak || 0);
        setNewLongestStreak(u.longestStreak || 0);
        setNewStarredLimit(u.maxStarredNotifications || 15);
        setNewLeaderboardLimit(u.leaderboardLimit || 10);
        setSelectedTimezone(u.timezone || 'Asia/Kolkata');
        if (u.tasks && u.tasks.length > 0) {
          setSelectedTaskId(u.tasks[0].id);
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('streakup_admin_token');
        setIsAdminAuth(false);
        toast.error('Admin session expired or unauthorized. Please sign in with Super Admin credentials.');
        return;
      }
      toast.error(extractErrorMessage(err, 'Failed to load user details.'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const refreshCurrentUser = () => {
    if (selectedUserId) {
      handleSelectUser({ id: selectedUserId });
    }
  };

  // ------------------------------------------
  // Audit Logs Loader
  // ------------------------------------------
  const loadAuditLogs = async (page = auditPage) => {
    setIsLoadingLogs(true);
    try {
      const res = await fetchAdminAuditLogs({
        page,
        limit: 30,
        action: auditFilterAction || undefined,
        targetUserId: auditFilterUser.trim() || undefined,
      });
      if (res.success) {
        setAuditLogs(res.logs || []);
        setAuditTotal(res.total || 0);
        setAuditPage(res.page || 1);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to load audit logs.'));
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAdminAuth && primaryTab === 'audit') {
      loadAuditLogs(1);
    }
  }, [isAdminAuth, primaryTab, auditFilterAction]);

  // ------------------------------------------
  // PIN Confirmation Execution Helper
  // ------------------------------------------
  const openPinPrompt = (
    title: string,
    description: string,
    action: (pin: string) => Promise<void>
  ) => {
    setPinModalTitle(title);
    setPinModalDescription(description);
    setPendingPinAction(() => action);
    setPinInput('');
    setPinModalOpen(true);
  };

  const executePinAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      toast.error('Sensitive Action PIN is required.');
      return;
    }
    if (!pendingPinAction) return;

    setIsSubmittingPinAction(true);
    try {
      await pendingPinAction(pinInput.trim());
      setPinModalOpen(false);
      setPinInput('');
      setPendingPinAction(null);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Sensitive PIN verification failed.'));
    } finally {
      setIsSubmittingPinAction(false);
    }
  };

  // ------------------------------------------
  // Action Handlers (Protected with Sensitive Password)
  // ------------------------------------------

  // A. Username Cooldown & Override
  const handleUsernameOverride = async (resetOnly: boolean) => {
    if (!selectedUserId) return;
    if (!usernameReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    if (!resetOnly && !overrideNewUsername.trim()) {
      toast.error('New username is required.');
      return;
    }

    openPinPrompt(
      'Authorize Username Cooldown Override',
      'Enter Super Admin Sensitive Password to execute username cooldown/override.',
      async (pin) => {
        setIsSubmittingUsername(true);
        try {
          const res = await overrideUsernameCooldown(selectedUserId, {
            resetCooldownOnly: resetOnly,
            newUsername: !resetOnly ? overrideNewUsername.trim() : undefined,
            reason: usernameReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setUsernameReason('');
            setOverrideNewUsername('');
            refreshCurrentUser();
          }
        } finally {
          setIsSubmittingUsername(false);
        }
      }
    );
  };

  // B. Email Cooldown & Override
  const handleEmailOverride = async (resetOnly: boolean) => {
    if (!selectedUserId) return;
    if (!emailReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    if (!resetOnly && !overrideNewEmail.trim()) {
      toast.error('New email address is required.');
      return;
    }

    openPinPrompt(
      'Authorize Email Cooldown Override',
      'Enter Super Admin Sensitive Password to execute email cooldown/override.',
      async (pin) => {
        setIsSubmittingEmail(true);
        try {
          const res = await overrideEmailCooldown(selectedUserId, {
            resetCooldownOnly: resetOnly,
            newEmail: !resetOnly ? overrideNewEmail.trim() : undefined,
            reason: emailReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setEmailReason('');
            setOverrideNewEmail('');
            refreshCurrentUser();
          }
        } finally {
          setIsSubmittingEmail(false);
        }
      }
    );
  };

  // C. Toggle Email Verification
  const handleToggleEmailVerification = async () => {
    if (!selectedUserId || !selectedUserDetails) return;
    const nextStatus = !selectedUserDetails.isEmailVerified;
    const reason = `Admin toggled verification to ${nextStatus ? 'VERIFIED' : 'UNVERIFIED'}`;

    try {
      const res = await toggleUserEmailVerification(selectedUserId, {
        isEmailVerified: nextStatus,
        reason,
      });
      if (res.success) {
        toast.info(res.message);
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to toggle email verification.'));
    }
  };

  // D. Update Timezone
  const handleUpdateTimezone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!timezoneReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    setIsSubmittingTimezone(true);
    try {
      const res = await updateUserTimezone(selectedUserId, {
        timezone: selectedTimezone,
        reason: timezoneReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setTimezoneReason('');
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update timezone.'));
    } finally {
      setIsSubmittingTimezone(false);
    }
  };

  // E. Streak Correction
  const handleStreakCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!streakReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    openPinPrompt(
      'Authorize Streak Correction',
      'Enter Super Admin Sensitive Password to modify streak records.',
      async (pin) => {
        setIsSubmittingStreak(true);
        try {
          const res = await correctUserStreak(selectedUserId, {
            type: streakTargetType,
            taskId: streakTargetType === 'TASK' ? selectedTaskId : undefined,
            currentStreak: Number(newCurrentStreak),
            longestStreak: Number(newLongestStreak),
            reason: streakReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setStreakReason('');
            refreshCurrentUser();
          }
        } finally {
          setIsSubmittingStreak(false);
        }
      }
    );
  };

  // G. Points Adjustment
  const handlePointsAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!pointsReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    if (pointsDelta === 0) {
      toast.error('Points adjustment cannot be zero.');
      return;
    }

    openPinPrompt(
      'Authorize Points Adjustment',
      `Enter Super Admin Sensitive Password to adjust points by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}.`,
      async (pin) => {
        setIsSubmittingPoints(true);
        try {
          const res = await adjustUserPoints(selectedUserId, {
            pointsDelta: Number(pointsDelta),
            reason: pointsReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setPointsReason('');
            setPointsDelta(0);
            refreshCurrentUser();
          }
        } finally {
          setIsSubmittingPoints(false);
        }
      }
    );
  };

  // H. Limit of 15 (Starred Notifications) Override
  const handleLimitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!limitReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    openPinPrompt(
      'Authorize Notification Limit Override',
      `Enter Super Admin Sensitive Password to set starred notifications limit to ${newStarredLimit}.`,
      async (pin) => {
        setIsSubmittingLimit(true);
        try {
          const res = await overrideUserLimit15(selectedUserId, {
            maxStarredNotifications: Number(newStarredLimit),
            reason: limitReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setLimitReason('');
            refreshCurrentUser();
          }
        } finally {
          setIsSubmittingLimit(false);
        }
      }
    );
  };

  // Heatmap Day Action Submission (Streak or Freeze on any particular day)
  const handleDayActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !dayModalDate) return;
    if (!dayModalReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    openPinPrompt(
      dayModalMode === 'STREAK'
        ? 'Authorize Day Streak Grant'
        : dayModalMode === 'UNFREEZE'
        ? 'Authorize Freeze Removal'
        : 'Authorize Day Freeze Protection',
      `Enter Super Admin Sensitive Password to ${
        dayModalMode === 'STREAK'
          ? 'grant streak completion'
          : dayModalMode === 'UNFREEZE'
          ? 'remove freeze'
          : 'apply freeze'
      } on ${dayModalDate}.`,
      async (pin) => {
        setIsSubmittingDayAction(true);
        try {
          if (dayModalMode === 'STREAK') {
            const res = await grantDayStreak(selectedUserId, {
              date: dayModalDate,
              taskId: dayModalTaskId || undefined,
              studyNote: dayModalNote.trim() || undefined,
              reason: dayModalReason.trim(),
              sensitivePin: pin,
              sendInApp: notifyInApp,
              sendEmail: notifyEmail,
              includeReason: notifyIncludeReason,
              includeChanges: notifyIncludeChanges,
            });
            if (res.success) {
              toast.info(res.message);
              setDayModalOpen(false);
              refreshCurrentUser();
            }
          } else if (dayModalMode === 'UNFREEZE') {
            const res = await unfreezeUserDate(selectedUserId, dayModalDate, {
              reason: dayModalReason.trim(),
              sensitivePin: pin,
            });
            if (res.success) {
              toast.info(res.message);
              setDayModalOpen(false);
              refreshCurrentUser();
            }
          } else {
            const res = await adjustUserFreezes(selectedUserId, {
              historicalFreezeDate: dayModalDate,
              reason: dayModalReason.trim(),
              sensitivePin: pin,
              sendInApp: notifyInApp,
              sendEmail: notifyEmail,
              includeReason: notifyIncludeReason,
              includeChanges: notifyIncludeChanges,
            });
            if (res.success) {
              toast.info(res.message);
              setDayModalOpen(false);
              refreshCurrentUser();
            }
          }
        } finally {
          setIsSubmittingDayAction(false);
        }
      }
    );
  };

  // Direct Unfreeze on a date
  const handleUnfreezeDay = (date: string) => {
    if (!selectedUserId) return;
    openPinPrompt(
      'Authorize Freeze Removal',
      `Enter Super Admin Sensitive Password to remove streak freeze protection on ${date}. Streaks will be recalculated automatically.`,
      async (pin) => {
        try {
          const res = await unfreezeUserDate(selectedUserId, date, {
            reason: `Admin unfreezed date ${date}`,
            sensitivePin: pin,
          });
          if (res.success) {
            toast.info(res.message);
            if (dayModalOpen && dayModalDate === date) {
              setDayModalOpen(false);
            }
            refreshCurrentUser();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to remove freeze.'));
        }
      }
    );
  };

  // Delete a Reminder Schedule
  const handleDeleteReminder = async (reminderId: string) => {
    if (!selectedUserId) return;
    try {
      const res = await adminDeleteReminderSchedule(reminderId, 'Admin removed scheduled reminder quota');
      if (res.success) {
        toast.info(res.message);
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to delete reminder schedule.'));
    }
  };

  // Leaderboard Cohort Limit Override
  const handleOverrideLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!leaderboardReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    openPinPrompt(
      'Authorize Leaderboard Limit Override',
      `Enter Super Admin Sensitive Password to set visible leaderboard cohort to Top ${newLeaderboardLimit}.`,
      async (pin) => {
        setIsSubmittingLeaderboardLimit(true);
        try {
          const res = await overrideLeaderboardLimit(selectedUserId, {
            leaderboardLimit: Number(newLeaderboardLimit),
            reason: leaderboardReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setLeaderboardReason('');
            refreshCurrentUser();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update leaderboard limit.'));
        } finally {
          setIsSubmittingLeaderboardLimit(false);
        }
      }
    );
  };

  // Open Full Task Editor Modal
  const handleOpenTaskEditor = (task: any) => {
    setEditingTask(task);
    setTaskEditTitle(task.title || '');
    setTaskEditDescription(task.description || '');
    setTaskEditCategory(task.category || 'General');
    setTaskEditPriority(task.priority || 'MEDIUM');
    setTaskEditRecurrence(task.recurrence || 'DAILY');
    setTaskEditStatus(task.status || 'ACTIVE');
    setTaskEditHiddenFrom(Array.isArray(task.hiddenFrom) ? [...task.hiddenFrom] : []);
    setTaskEditVisibleOnlyTo(Array.isArray(task.visibleOnlyTo) ? [...task.visibleOnlyTo] : []);
    setTaskEditReason(`Admin updated task "${task.title}" settings`);
    setUserSearchQuery('');
    setUserSearchMatches([]);
    setActiveSearchTarget(null);
  };

  // Save Full Task Settings
  const handleSaveTaskFull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!taskEditReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    setIsSubmittingTaskEdit(true);
    try {
      const res = await adminUpdateTaskFull(editingTask.id, {
        title: taskEditTitle.trim(),
        description: taskEditDescription,
        category: taskEditCategory.trim(),
        priority: taskEditPriority,
        recurrence: taskEditRecurrence,
        status: taskEditStatus,
        hiddenFrom: taskEditHiddenFrom,
        visibleOnlyTo: taskEditVisibleOnlyTo,
        reason: taskEditReason.trim(),
        sendInApp: notifyInApp,
        sendEmail: notifyEmail,
        includeReason: notifyIncludeReason,
        includeChanges: notifyIncludeChanges,
      });
      if (res.success) {
        toast.info(res.message);
        setEditingTask(null);
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update task settings.'));
    } finally {
      setIsSubmittingTaskEdit(false);
    }
  };

  // Open Full Group Editor Modal
  const handleOpenGroupEditor = (group: any) => {
    setEditingGroup(group);
    setGroupEditName(group.name || '');
    setGroupEditDescription(group.description || '');
    setGroupEditJoinCode(group.joinCode || '');
    setGroupEditOwnerId(group.ownerId || '');
    setGroupEditHiddenFrom(Array.isArray(group.hiddenFrom) ? [...group.hiddenFrom] : []);
    setGroupEditVisibleOnlyTo(Array.isArray(group.visibleOnlyTo) ? [...group.visibleOnlyTo] : []);
    setGroupEditReason(`Admin updated group "${group.name}" settings`);
    setUserSearchQuery('');
    setUserSearchMatches([]);
    setActiveSearchTarget(null);
  };

  // Save Full Group Settings
  const handleSaveGroupFull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    if (!groupEditReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }
    setIsSubmittingGroupEdit(true);
    try {
      const res = await adminUpdateGroupFull(editingGroup.id, {
        name: groupEditName.trim(),
        description: groupEditDescription,
        joinCode: groupEditJoinCode.trim(),
        ownerId: groupEditOwnerId || undefined,
        hiddenFrom: groupEditHiddenFrom,
        visibleOnlyTo: groupEditVisibleOnlyTo,
        reason: groupEditReason.trim(),
        sendInApp: notifyInApp,
        sendEmail: notifyEmail,
        includeReason: notifyIncludeReason,
        includeChanges: notifyIncludeChanges,
      });
      if (res.success) {
        toast.info(res.message);
        setEditingGroup(null);
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update group settings.'));
    } finally {
      setIsSubmittingGroupEdit(false);
    }
  };

  // Remove Member from Group
  const handleRemoveGroupMember = (groupId: string, memberUserId: string, memberUsername: string) => {
    openPinPrompt(
      `Remove @${memberUsername} from Group`,
      `Are you sure you want to remove @${memberUsername} from this group? This will revoke their membership immediately.`,
      async () => {
        try {
          const res = await adminManageGroupMember(groupId, {
            targetUserId: memberUserId,
            role: 'REMOVE',
            reason: `Admin removed @${memberUsername} from group`,
          });
          if (res.success) {
            toast.info(res.message);
            if (editingGroup && editingGroup.members) {
              setEditingGroup({
                ...editingGroup,
                members: editingGroup.members.filter((m: any) => m.userId !== memberUserId),
              });
            }
            refreshCurrentUser();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to remove member.'));
        }
      }
    );
  };

  // Live substring user search for privacy / owner selection
  const searchUsersForPrivacy = async (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setUserSearchMatches([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const res = await searchAdminUsers(query.trim());
      if (res.success) {
        setUserSearchMatches(res.users || []);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Delete Individual Audit Log
  const handleDeleteAuditLog = (logId: string) => {
    openPinPrompt(
      'Authorize Audit Log Deletion',
      'Enter Super Admin Sensitive Password to permanently purge this audit entry.',
      async (pin) => {
        const res = await deleteAdminAuditLog(logId, pin);
        if (res.success) {
          toast.info(res.message);
          loadAuditLogs(auditPage);
        }
      }
    );
  };

  // Clear All Audit Logs
  const handleClearAllAuditLogs = () => {
    openPinPrompt(
      'Authorize Clear All Audit Logs',
      'Enter Super Admin Sensitive Password to permanently purge audit log records.',
      async (pin) => {
        const res = await clearAdminAuditLogs({
          targetUserId: auditFilterUser.trim() || undefined,
          sensitivePin: pin,
        });
        if (res.success) {
          toast.info(res.message);
          loadAuditLogs(1);
        }
      }
    );
  };

  // I. Reset Nudge Cooldown
  const handleResetNudgeCooldown = async () => {
    if (!selectedUserId) return;
    try {
      const res = await resetNudgeCooldown(selectedUserId, {
        reason: 'Admin reset 12-hour friend nudge cooldown lockout',
      });
      if (res.success) {
        toast.info(res.message);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to reset nudge cooldown.'));
    }
  };

  // J. Recover Group Task to Dashboard
  const handleRecoverGroupTask = async (taskId: string, taskTitle: string) => {
    try {
      const res = await adminRecoverGroupTask(taskId, {
        reason: `Admin restored archived group task "${taskTitle}" to active dashboard`,
      });
      if (res.success) {
        toast.info(res.message);
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to recover group task.'));
    }
  };

  // K. Manage Group Member Role & Ownership Transfer
  const handleManageGroupMember = async (
    groupId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER',
    groupName: string,
    targetUserId?: string
  ) => {
    const userId = targetUserId || selectedUserId;
    if (!userId) return;
    try {
      const res = await adminManageGroupMember(groupId, {
        targetUserId: userId,
        role,
        reason: `Admin updated role to ${role} in group "${groupName}"`,
      });
      if (res.success) {
        toast.info(res.message);
        if (editingGroup && editingGroup.members) {
          setEditingGroup({
            ...editingGroup,
            members: editingGroup.members.map((m: any) =>
              m.userId === userId ? { ...m, role } : m
            ),
          });
        }
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update group role.'));
    }
  };

  // L. Moderate Study Note
  const handleModerateStudyNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompletionId) return;
    if (!moderationReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    setIsSubmittingModeration(true);
    try {
      const res = await adminModerateStudyNote(editingCompletionId, {
        studyNote: editingStudyNote,
        clearReactions: clearNoteReactions,
        reason: moderationReason.trim(),
      });
      if (res.success) {
        toast.info(res.message);
        setEditingCompletionId(null);
        setEditingStudyNote('');
        setClearNoteReactions(false);
        setModerationReason('');
        refreshCurrentUser();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to moderate study note.'));
    } finally {
      setIsSubmittingModeration(false);
    }
  };


  // N. Delete User Account (High-Risk Sensitive Action)
  const handleDeleteUserAccount = () => {
    if (!selectedUserId || !selectedUserDetails) return;
    if (deleteConfirmText.trim().toLowerCase() !== selectedUserDetails.username.toLowerCase()) {
      toast.error(`Please type "${selectedUserDetails.username}" exactly to confirm deletion.`);
      return;
    }
    if (!deleteReason.trim()) {
      toast.error('An administrative reason is mandatory for permanent deletion.');
      return;
    }

    openPinPrompt(
      `Permanently Delete @${selectedUserDetails.username}`,
      `This will cascade and delete all tasks, streaks, memberships, friendships, and history for @${selectedUserDetails.username}. This action is completely irreversible.`,
      async (pin: string) => {
        const res = await deleteUserAccountByAdmin(selectedUserId, {
          reason: deleteReason.trim(),
          sensitivePin: pin,
        });
        if (res.success) {
          toast.info(res.message);
          setSelectedUserId(null);
          setSelectedUserDetails(null);
          setDeleteConfirmText('');
          setDeleteReason('');
          handleSearchUsers('');
        }
      }
    );
  };

  // O. Admin Security (Change Password & Sensitive PIN)
  const handleUpdateAdminSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdminPassword) {
      toast.error('Current password is required to update credentials.');
      return;
    }
    if (!newAdminPassword && !newAdminSensitivePin) {
      toast.error('Please enter a new password or a new sensitive PIN.');
      return;
    }

    setIsSubmittingSecurity(true);
    try {
      const res = await changeAdminCredentials({
        currentPassword: currentAdminPassword,
        newPassword: newAdminPassword.trim() || undefined,
        newSensitivePin: newAdminSensitivePin.trim() || undefined,
        reason: 'Super Admin credentials update',
      });
      if (res.success) {
        toast.info(res.message);
        setCurrentAdminPassword('');
        setNewAdminPassword('');
        setNewAdminSensitivePin('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update credentials.'));
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

  // ------------------------------------------
  // Interactive 365-Day Activity Heatmap Data
  // ------------------------------------------
  const heatmapData = useMemo(() => {
    if (!selectedUserDetails) return [];

    const completionsMap = new Set<string>();
    if (Array.isArray(selectedUserDetails.taskCompletions)) {
      selectedUserDetails.taskCompletions.forEach((c: any) => {
        if (c.completionDate) completionsMap.add(c.completionDate);
      });
    }

    const freezeMap = new Map<string, string>();
    if (Array.isArray(selectedUserDetails.freezeLogs)) {
      selectedUserDetails.freezeLogs.forEach((f: any) => {
        if (f.protectedDate) {
          freezeMap.set(f.protectedDate, f.scopeKey || 'OVERALL');
        }
      });
    }

    const days = [];
    const today = new Date();
    // 52 weeks = 364 days + today
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const isCompleted = completionsMap.has(dateStr);
      const isFrozen = freezeMap.has(dateStr);
      const freezeScope = freezeMap.get(dateStr);

      days.push({
        date: dateStr,
        isCompleted,
        isFrozen,
        freezeScope,
      });
    }
    return days;
  }, [selectedUserDetails]);

  // Click on heatmap cell opens Day Activity & Streak Control modal
  const handleHeatmapCellClick = (dateStr: string) => {
    setDayModalDate(dateStr);
    setDayModalMode('STREAK');
    setDayModalReason(`Administrative activity granted for ${dateStr}`);
    setDayModalNote('');
    if (selectedUserDetails?.tasks && selectedUserDetails.tasks.length > 0) {
      setDayModalTaskId(selectedUserDetails.tasks[0].id);
    }
    setDayModalOpen(true);
  };

  // ------------------------------------------
  // Reusable Notification & Changes Option Dispatch Component
  // ------------------------------------------
  const renderNotificationOptions = () => (
    <div className="p-3.5 bg-dark-surface/90 rounded-xl border border-dark-border/80 space-y-2.5 my-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-flame-400" />
          <span>User Notification Dispatch</span>
        </span>
        <span className="text-[10px] text-zinc-500">Send in-app & email notices</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
          <input
            type="checkbox"
            checked={notifyInApp}
            onChange={(e) => setNotifyInApp(e.target.checked)}
            className="rounded border-dark-border text-flame-500 focus:ring-flame-500/20"
          />
          <span className="text-[11px]">In-App Notice</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            className="rounded border-dark-border text-flame-500 focus:ring-flame-500/20"
          />
          <Mail className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px]">Email Notice</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-zinc-400 select-none">
          <input
            type="checkbox"
            checked={notifyIncludeReason}
            onChange={(e) => setNotifyIncludeReason(e.target.checked)}
            className="rounded border-dark-border text-flame-500 focus:ring-flame-500/20"
          />
          <span className="text-[10px]">Include Reason</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-zinc-400 select-none">
          <input
            type="checkbox"
            checked={notifyIncludeChanges}
            onChange={(e) => setNotifyIncludeChanges(e.target.checked)}
            className="rounded border-dark-border text-flame-500 focus:ring-flame-500/20"
          />
          <span className="text-[10px]">Include Changes Diff</span>
        </label>
      </div>
    </div>
  );

  // ==========================================
  // RENDER: LOGIN FORM (If not authenticated)
  // ==========================================
  if (!isAdminAuth) {
    return (
      <div className="min-h-screen bg-dark-bg text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-flame-500 to-rose-500" />
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-zinc-100 tracking-tight">StreakUp Super Admin</h1>
              <p className="text-xs text-dark-muted font-medium">Privileged Management & Override Control</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Username</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all mt-3 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate Super Admin</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SUPER ADMIN CONTROL PANEL
  // ==========================================
  return (
    <div className="min-h-screen bg-dark-bg text-zinc-100 pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-dark-card/95 backdrop-blur-md border-b border-dark-border px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-zinc-100 tracking-tight">Super Admin Control Panel</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-flame-500/10 border border-flame-500/30 text-flame-400 font-bold uppercase tracking-wider">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-[11px] text-dark-muted">StreakUp Multi-Tenant User Management & Override Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-surface border border-dark-border text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold">@{activeAdmin?.username || 'admin'}</span>
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Primary Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-dark-border pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setPrimaryTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'users'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Directory & Control</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'audit'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Ledger Trail</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'security'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Admin Security & PIN</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* PRIMARY TAB 1: USER DIRECTORY & USER CONTROL CENTER      */}
        {/* ======================================================== */}
        {primaryTab === 'users' && (
          <div className="space-y-6">
            {/* Global User Search Bar (Always visible) */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 shadow-panel">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchUsers();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Full Name, @username, Email address, or User UUID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search Directory</span>
                </button>
              </form>
            </div>

            {/* Layout: Either Search Results or Selected User Control Center */}
            {!selectedUserId ? (
              /* Search Results Directory View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-zinc-200">
                    Directory Results {searchResults.length > 0 && `(${searchResults.length} users)`}
                  </h2>
                  <span className="text-[11px] text-zinc-500">Click a user to open their dedicated Control Center</span>
                </div>

                {isSearching ? (
                  <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-flame-400" />
                    <span>Searching StreakUp user records...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center text-zinc-400 space-y-2">
                    <Users className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="text-xs font-semibold text-zinc-300">No users found</p>
                    <p className="text-[11px] text-zinc-500">
                      Try searching with a different name, email, or @username.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="bg-dark-card hover:bg-dark-card/80 border border-dark-border hover:border-flame-500/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg space-y-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 font-bold text-xs shrink-0">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-100 truncate group-hover:text-flame-400 transition-colors">
                                {u.name || u.username}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">@{u.username}</p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              u.isEmailVerified !== false
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {u.isEmailVerified !== false ? 'Verified' : 'Unverified'}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-400 truncate">{u.email}</p>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dark-border text-center">
                          <div className="bg-dark-surface rounded-lg p-1.5">
                            <p className="text-[10px] text-zinc-500">Streak</p>
                            <p className="text-xs font-bold text-flame-400">{u.currentStreak}d</p>
                          </div>
                          <div className="bg-dark-surface rounded-lg p-1.5">
                            <p className="text-[10px] text-zinc-500">Points</p>
                            <p className="text-xs font-bold text-amber-400">{u.points}</p>
                          </div>
                          <div className="bg-dark-surface rounded-lg p-1.5">
                            <p className="text-[10px] text-zinc-500">Freezes</p>
                            <p className="text-xs font-bold text-sky-400">{u.overallFreezeBalance}/7</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-flame-400 font-semibold group-hover:translate-x-1 transition-transform">
                          <span>Open Control Center</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Dedicated User Control Center */
              <div className="space-y-6">
                {/* Header Banner for Selected User */}
                <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(null)}
                        className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Directory</span>
                      </button>
                      <div className="h-6 w-px bg-dark-border hidden sm:block" />
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 font-extrabold text-sm shrink-0 shadow-inner">
                          {selectedUserDetails?.name
                            ? selectedUserDetails.name.slice(0, 2).toUpperCase()
                            : selectedUserDetails?.username?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-extrabold text-zinc-100 truncate">
                              {selectedUserDetails?.name || selectedUserDetails?.username}
                            </h2>
                            <span className="text-xs font-medium text-flame-400">
                              @{selectedUserDetails?.username}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{selectedUserDetails?.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={refreshCurrentUser}
                        disabled={isLoadingDetails}
                        className="p-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-zinc-300 text-xs transition-colors"
                        title="Refresh user data"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetails ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedUserDetails?.id || '');
                          toast.info('User ID copied to clipboard.');
                        }}
                        className="px-2.5 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 transition-colors"
                        title="Copy User UUID"
                      >
                        <Copy className="w-3 h-3" />
                        <span>ID: {selectedUserDetails?.id?.slice(0, 8)}...</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-dark-border">
                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Overall Streak</span>
                      <span className="text-xs font-bold text-flame-400">
                        {selectedUserDetails?.currentStreak || 0}d
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        Longest: {selectedUserDetails?.longestStreak || 0}d
                      </span>
                    </div>

                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Point Balance</span>
                      <span className="text-xs font-bold text-amber-400">
                        {selectedUserDetails?.points || 0} pts
                      </span>
                      <span className="text-[9px] text-zinc-500 block">Ledger synced</span>
                    </div>

                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Shield Freezes</span>
                      <span className="text-xs font-bold text-sky-400">
                        {selectedUserDetails?.overallFreezeBalance || 0}/7
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        Recharge: {selectedUserDetails?.overallFreezeRechargeDays || 0}/7d
                      </span>
                    </div>

                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Starred Limit</span>
                      <span className="text-xs font-bold text-purple-400">
                        {selectedUserDetails?.maxStarredNotifications || 15}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">Purge immune</span>
                    </div>

                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Email Verified</span>
                      <span
                        className={`text-xs font-bold ${
                          selectedUserDetails?.isEmailVerified !== false
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {selectedUserDetails?.isEmailVerified !== false ? 'Verified' : 'Unverified'}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        {selectedUserDetails?.timezone || 'Asia/Kolkata'}
                      </span>
                    </div>

                    <div className="bg-dark-surface rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-zinc-500 block">Total Habits</span>
                      <span className="text-xs font-bold text-zinc-200">
                        {selectedUserDetails?.tasks?.length || 0}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        Groups: {selectedUserDetails?.groupMemberships?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs for Selected User */}
                <div className="flex items-center gap-1.5 border-b border-dark-border pb-2 overflow-x-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setUserTab('overview')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'overview'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('username_email')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'username_email'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Username & Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('streaks')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'streaks'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Streaks & Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('points')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'points'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Points & Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('limits')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'limits'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Limits & Quotas
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('tasks_groups')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'tasks_groups'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Tasks & Groups
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('danger')}
                    className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      userTab === 'danger'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'text-rose-400/80 hover:text-rose-300'
                    }`}
                  >
                    Danger Zone
                  </button>
                </div>

                {/* SUB-TAB A: OVERVIEW & PROFILE */}
                {userTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Account Details Card */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <User className="w-4 h-4 text-flame-400" />
                        <span>Account Identity & Restrictions</span>
                      </h3>

                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Full Name</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.name || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Username</span>
                          <span className="font-mono font-semibold text-flame-400">
                            @{selectedUserDetails?.username}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Registered Email</span>
                          <span className="font-semibold text-zinc-200">{selectedUserDetails?.email}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Email Verification</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                selectedUserDetails?.isEmailVerified !== false
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {selectedUserDetails?.isEmailVerified !== false ? 'Verified' : 'Unverified'}
                            </span>
                            <button
                              type="button"
                              onClick={handleToggleEmailVerification}
                              className="text-[10px] px-2 py-0.5 rounded bg-dark-surface border border-dark-border text-zinc-300 hover:border-flame-500/50"
                            >
                              Toggle
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">14-Day Username Cooldown</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.lastUsernameChangeAt
                              ? `Changed on ${new Date(
                                  selectedUserDetails.lastUsernameChangeAt
                                ).toLocaleDateString()}`
                              : 'Eligible for change'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">14-Day Email Cooldown</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.emailLastChangedAt
                              ? `Changed on ${new Date(
                                  selectedUserDetails.emailLastChangedAt
                                ).toLocaleDateString()}`
                              : 'Eligible for change'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Account Created</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.createdAt
                              ? new Date(selectedUserDetails.createdAt).toLocaleString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timezone & Habits Summary */}
                    <div className="space-y-6">
                      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-flame-400" />
                          <span>Timezone Alignment</span>
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Streak calculations and midnight boundary resets are calculated based on the user's
                          registered timezone.
                        </p>

                        <form onSubmit={handleUpdateTimezone} className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Registered Timezone (IANA)
                            </label>
                            <select
                              value={selectedTimezone}
                              onChange={(e) => setSelectedTimezone(e.target.value)}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            >
                              <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                              <option value="UTC">UTC (Universal Time)</option>
                              <option value="America/New_York">America/New_York (EST/EDT)</option>
                              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                              <option value="Europe/London">Europe/London (GMT/BST)</option>
                              <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                              <option value="Asia/Tokyo">Asia/Tokyo (JST +9:00)</option>
                              <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                              <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Administrative Reason
                            </label>
                            <input
                              type="text"
                              value={timezoneReason}
                              onChange={(e) => setTimezoneReason(e.target.value)}
                              placeholder="e.g. User relocated to new timezone"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isSubmittingTimezone}
                            className="w-full py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            {isSubmittingTimezone ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-flame-400" />
                            )}
                            <span>Update Timezone</span>
                          </button>
                        </form>
                      </div>

                      {/* Quick Nudge Reset */}
                      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-flame-400" />
                          <span>12-Hour Friend Nudge Lockout</span>
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Friends cannot nudge this user if they were nudged within the last 12 hours. Clearing
                          this lockout allows immediate re-nudging.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetNudgeCooldown}
                          className="px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-flame-400" />
                          <span>Clear Recent Nudge Logs</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB B: USERNAME & EMAIL RESTRICTIONS */}
                {userTab === 'username_email' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Username Controls */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-flame-400" />
                          <span>14-Day Username Restriction</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          RULE: 14 DAYS
                        </span>
                      </div>

                      <div className="p-3 bg-dark-surface rounded-xl border border-dark-border text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Current Username:</span>
                          <span className="font-bold text-zinc-100">@{selectedUserDetails?.username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Last Changed:</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.lastUsernameChangeAt
                              ? new Date(selectedUserDetails.lastUsernameChangeAt).toLocaleString()
                              : 'Never (Ready for change)'}
                          </span>
                        </div>
                      </div>

                      {/* Option 1: Clear Cooldown */}
                      <div className="pt-2 border-t border-dark-border space-y-2">
                        <h4 className="text-xs font-bold text-zinc-200">
                          Option 1: Clear 14-Day Cooldown Only
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Allows the user to pick their own new username directly from their settings page without
                          waiting 14 days.
                        </p>
                        {renderNotificationOptions()}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={usernameReason}
                            onChange={(e) => setUsernameReason(e.target.value)}
                            placeholder="Mandatory administrative reason..."
                            className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUsernameOverride(true)}
                            disabled={isSubmittingUsername}
                            className="px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-200 font-bold text-xs rounded-xl whitespace-nowrap transition-colors"
                          >
                            Reset Cooldown
                          </button>
                        </div>
                      </div>

                      {/* Option 2: Force Change Username */}
                      <div className="pt-3 border-t border-dark-border space-y-2">
                        <h4 className="text-xs font-bold text-zinc-200">
                          Option 2: Force Update Username Directly
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Changes the username immediately in the database with case-insensitive uniqueness
                          validation.
                        </p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={overrideNewUsername}
                            onChange={(e) => setOverrideNewUsername(e.target.value)}
                            placeholder="New username (e.g. john_doe)"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <input
                            type="text"
                            value={usernameReason}
                            onChange={(e) => setUsernameReason(e.target.value)}
                            placeholder="Mandatory administrative reason..."
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUsernameOverride(false)}
                            disabled={isSubmittingUsername || !overrideNewUsername.trim()}
                            className="w-full py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all"
                          >
                            Update Username Directly
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Email Controls */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-flame-400" />
                          <span>14-Day Registered Email Restriction</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          RULE: 14 DAYS
                        </span>
                      </div>

                      <div className="p-3 bg-dark-surface rounded-xl border border-dark-border text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Current Email:</span>
                          <span className="font-bold text-zinc-100">{selectedUserDetails?.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Last Changed:</span>
                          <span className="font-semibold text-zinc-200">
                            {selectedUserDetails?.emailLastChangedAt
                              ? new Date(selectedUserDetails.emailLastChangedAt).toLocaleString()
                              : 'Never (Ready for change)'}
                          </span>
                        </div>
                      </div>

                      {/* Option 1: Clear Cooldown */}
                      <div className="pt-2 border-t border-dark-border space-y-2">
                        <h4 className="text-xs font-bold text-zinc-200">
                          Option 1: Clear 14-Day Email Cooldown
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Allows the user to initiate their own email change with OTP verification without waiting
                          14 days.
                        </p>
                        {renderNotificationOptions()}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={emailReason}
                            onChange={(e) => setEmailReason(e.target.value)}
                            placeholder="Mandatory administrative reason..."
                            className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleEmailOverride(true)}
                            disabled={isSubmittingEmail}
                            className="px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-200 font-bold text-xs rounded-xl whitespace-nowrap transition-colors"
                          >
                            Reset Cooldown
                          </button>
                        </div>
                      </div>

                      {/* Option 2: Force Change Email */}
                      <div className="pt-3 border-t border-dark-border space-y-2">
                        <h4 className="text-xs font-bold text-zinc-200">
                          Option 2: Direct Admin Email Update
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Updates the registered email address immediately without OTP, checking uniqueness across
                          all accounts.
                        </p>
                        <div className="space-y-2">
                          <input
                            type="email"
                            value={overrideNewEmail}
                            onChange={(e) => setOverrideNewEmail(e.target.value)}
                            placeholder="New email (e.g. user@example.com)"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <input
                            type="text"
                            value={emailReason}
                            onChange={(e) => setEmailReason(e.target.value)}
                            placeholder="Mandatory administrative reason..."
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleEmailOverride(false)}
                            disabled={isSubmittingEmail || !overrideNewEmail.trim()}
                            className="w-full py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all"
                          >
                            Update Email Directly
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB C: STREAKS & INTERACTIVE HEATMAP */}
                {userTab === 'streaks' && (
                  <div className="space-y-6">
                    {/* 4 Prominent Stat Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                            Current Streak
                          </span>
                          <span className="text-xl font-black text-flame-400 font-mono">
                            {selectedUserDetails?.currentStreak || 0}{' '}
                            <span className="text-xs font-bold text-zinc-400">Days</span>
                          </span>
                        </div>
                      </div>

                      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                            Longest Streak
                          </span>
                          <span className="text-xl font-black text-amber-400 font-mono">
                            {selectedUserDetails?.longestStreak || 0}{' '}
                            <span className="text-xs font-bold text-zinc-400">Days</span>
                          </span>
                        </div>
                      </div>

                      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                          <Snowflake className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                            Protected Freezes
                          </span>
                          <span className="text-xl font-black text-sky-400 font-mono">
                            {selectedUserDetails?.freezeLogs?.length || 0}{' '}
                            <span className="text-xs font-bold text-zinc-400">Days</span>
                          </span>
                        </div>
                      </div>

                      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-panel flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                            Total Check-ins
                          </span>
                          <span className="text-xl font-black text-emerald-400 font-mono">
                            {selectedUserDetails?.taskCompletions?.length ||
                              selectedUserDetails?._count?.taskCompletions ||
                              0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive 365-Day Activity Heatmap */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-flame-400" />
                            <span>Interactive 365-Day Activity & Freeze Heatmap</span>
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            Click any day to Freeze that day, Unfreeze it, or Grant a Streak directly on that calendar date.
                          </p>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-dark-surface border border-dark-border" />
                            <span>Missed</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-flame-500" />
                            <span>Completed</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-sky-400" />
                            <span>Freeze Applied</span>
                          </div>
                        </div>
                      </div>

                      {/* Heatmap Grid Container */}
                      <div className="overflow-x-auto pb-2">
                        <div className="inline-grid grid-flow-col grid-rows-7 gap-1">
                          {heatmapData.map((d) => (
                            <div
                              key={d.date}
                              onClick={() => handleHeatmapCellClick(d.date)}
                              title={`${d.date}: ${
                                d.isFrozen
                                  ? `Freeze Log (${d.freezeScope || 'OVERALL'})`
                                  : d.isCompleted
                                  ? 'Habit Completed'
                                  : 'No Completion'
                              } — Click to Freeze or Grant Streak`}
                              className={`w-3.5 h-3.5 rounded-sm cursor-pointer transition-all hover:scale-125 ${
                                d.isFrozen
                                  ? 'bg-sky-400 hover:ring-2 hover:ring-sky-300'
                                  : d.isCompleted
                                  ? 'bg-flame-500 hover:ring-2 hover:ring-flame-400'
                                  : 'bg-dark-surface border border-dark-border/60 hover:border-flame-500/60'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Authoritative Active FreezeLog Table with Direct Remove Action */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                          <Snowflake className="w-4 h-4 text-sky-400" />
                          <span>Active Protected Freeze Dates ({selectedUserDetails?.freezeLogs?.length || 0})</span>
                        </h4>
                        <span className="text-[10px] text-zinc-400">
                          Admin can remove freeze from any date to recalculate streaks
                        </span>
                      </div>
                      {selectedUserDetails?.freezeLogs?.length === 0 ? (
                        <p className="text-xs text-zinc-500 py-3">No freeze log records found for this user. Click any day on the heatmap to freeze it.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-dark-border text-zinc-400">
                                <th className="py-2 px-3">Protected Date</th>
                                <th className="py-2 px-3">Scope Key</th>
                                <th className="py-2 px-3">Scope</th>
                                <th className="py-2 px-3">Applied At</th>
                                <th className="py-2 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                              {selectedUserDetails?.freezeLogs?.map((f: any) => (
                                <tr key={f.id} className="text-zinc-300 hover:bg-dark-surface/40">
                                  <td className="py-2 px-3 font-mono text-sky-400 font-bold">
                                    {f.protectedDate}
                                  </td>
                                  <td className="py-2 px-3 font-mono">{f.scopeKey}</td>
                                  <td className="py-2 px-3">{f.scope}</td>
                                  <td className="py-2 px-3 text-zinc-500">
                                    {new Date(f.usedAt).toLocaleDateString()}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleUnfreezeDay(f.protectedDate)}
                                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                      title="Remove freeze protection on this date"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove Freeze</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Streak Value Adjustment Form */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-flame-400" />
                        <span>Manual Streak Value Correction</span>
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Streak adjustments update current and longest streak tallies. For durable persistence against
                        dynamic recalculations, apply a historical freeze to the missed date above.
                      </p>

                      <form onSubmit={handleStreakCorrection} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Target Streak Scope
                            </label>
                            <select
                              value={streakTargetType}
                              onChange={(e) => {
                                const val = e.target.value as 'OVERALL' | 'TASK';
                                setStreakTargetType(val);
                                if (val === 'OVERALL') {
                                  setNewCurrentStreak(selectedUserDetails?.currentStreak || 0);
                                  setNewLongestStreak(selectedUserDetails?.longestStreak || 0);
                                } else if (selectedUserDetails?.tasks?.length > 0) {
                                  const t = selectedUserDetails.tasks[0];
                                  setSelectedTaskId(t.id);
                                  setNewCurrentStreak(t.currentStreak || 0);
                                  setNewLongestStreak(t.longestStreak || 0);
                                }
                              }}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            >
                              <option value="OVERALL">Overall User Streak</option>
                              <option value="TASK">Individual Personal or Group Task</option>
                            </select>
                          </div>

                          {streakTargetType === 'TASK' && (
                            <div>
                              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                Select Target Task
                              </label>
                              <select
                                value={selectedTaskId}
                                onChange={(e) => {
                                  setSelectedTaskId(e.target.value);
                                  const t = selectedUserDetails?.tasks?.find(
                                    (x: any) => x.id === e.target.value
                                  );
                                  if (t) {
                                    setNewCurrentStreak(t.currentStreak || 0);
                                    setNewLongestStreak(t.longestStreak || 0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              >
                                {selectedUserDetails?.tasks?.map((t: any) => (
                                  <option key={t.id} value={t.id}>
                                    {t.isGroupTask ? `[Group Task: ${t.group?.name || 'Group'}] ` : '[Personal] '}
                                    {t.title} (Current: {t.currentStreak}d)
                                  </option>
                                ))}
                              </select>
                              {selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)?.isGroupTask && (
                                <p className="text-[10px] text-amber-400 mt-1">
                                  ✓ Member-Isolated: Modifying this group task alters only this member's streak.
                                  Other members retain independent completion histories.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Streak values and before/after */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              New Current Streak (Days)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={newCurrentStreak}
                              onChange={(e) => setNewCurrentStreak(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              New Longest Streak (Days)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={newLongestStreak}
                              onChange={(e) => setNewLongestStreak(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>
                        </div>

                        {/* Live Before & After Preview */}
                        <div className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Before / After Preview:</span>
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400">
                              Current:{' '}
                              <strong className="text-zinc-200">
                                {streakTargetType === 'OVERALL'
                                  ? selectedUserDetails?.currentStreak || 0
                                  : selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)
                                      ?.currentStreak || 0}
                                d
                              </strong>
                            </span>
                            <span className="text-zinc-500">→</span>
                            <span className="text-flame-400 font-bold">
                              Resulting: {newCurrentStreak}d
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={streakReason}
                            onChange={(e) => setStreakReason(e.target.value)}
                            placeholder="e.g. Corrected missed check-in due to verified technical glitch"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingStreak}
                          className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingStreak ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Streak Correction</span>
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* SUB-TAB E: POINTS & LEDGER */}
                {userTab === 'points' && (
                  <div className="space-y-6">
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>Points Correction via Double-Entry Ledger</span>
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Points adjustments insert a permanent row into <code className="text-amber-400">PointLedger</code>,
                        guaranteeing that transaction sums always equal the user's displayed balance.
                      </p>

                      {/* Prominent Current Points Balance Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-xl gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Coins className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">
                              Current Balance
                            </span>
                            <p className="text-2xl font-black text-amber-400 font-mono">
                              {selectedUserDetails?.points?.toLocaleString() || 0}{' '}
                              <span className="text-xs font-bold text-zinc-400">pts</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-dark-border/80 pt-2 sm:pt-0 sm:pl-4">
                          <span className="text-[11px] text-zinc-400 block">Projected Balance After Delta</span>
                          <span
                            className={`font-mono text-base font-bold ${
                              (selectedUserDetails?.points || 0) + pointsDelta >= 0
                                ? 'text-zinc-100'
                                : 'text-rose-400'
                            }`}
                          >
                            {Math.max(0, (selectedUserDetails?.points || 0) + pointsDelta).toLocaleString()} pts
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handlePointsAdjustment} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Points Delta (+ to grant, - to deduct)
                          </label>
                          <input
                            type="number"
                            value={pointsDelta}
                            onChange={(e) => setPointsDelta(parseInt(e.target.value, 10) || 0)}
                            placeholder="e.g. 50 or -25"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {/* Live Before & After Preview */}
                        <div className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Balance Preview:</span>
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400">
                              Current Balance:{' '}
                              <strong className="text-zinc-200">{selectedUserDetails?.points || 0} pts</strong>
                            </span>
                            <span className="text-zinc-500">→</span>
                            <span className="text-amber-400 font-bold">
                              Resulting Balance:{' '}
                              {Math.max(0, (selectedUserDetails?.points || 0) + Number(pointsDelta))} pts
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={pointsReason}
                            onChange={(e) => setPointsReason(e.target.value)}
                            placeholder="e.g. Community challenge participation bonus"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingPoints || pointsDelta === 0}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingPoints ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Record Points Correction in Ledger</span>
                        </button>
                      </form>
                    </div>

                    {/* Point Ledger History Table */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
                      <h4 className="text-xs font-bold text-zinc-200">Recent PointLedger Transactions</h4>
                      {selectedUserDetails?.pointLedgers?.length === 0 ? (
                        <p className="text-xs text-zinc-500">No ledger transactions found.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-dark-border text-zinc-400">
                                <th className="py-2">Date</th>
                                <th className="py-2">Delta</th>
                                <th className="py-2">Reason</th>
                                <th className="py-2">Logged At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                              {selectedUserDetails?.pointLedgers?.map((p: any) => (
                                <tr key={p.id} className="text-zinc-300">
                                  <td className="py-2 font-mono">{p.date}</td>
                                  <td
                                    className={`py-2 font-bold ${
                                      p.points > 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {p.points > 0 ? `+${p.points}` : p.points}
                                  </td>
                                  <td className="py-2">{p.reason}</td>
                                  <td className="py-2 text-zinc-500">
                                    {new Date(p.createdAt).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB F: LIMITS & PRIVILEGES */}
                {userTab === 'limits' && (
                  <div className="space-y-6">
                    {/* Starred Notifications Limit (Limit of 15) */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Award className="w-4 h-4 text-purple-400" />
                          <span>Override Starred Notifications Limit (Limit of 15)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                          PER-USER OVERRIDE
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, StreakUp limits users to a maximum of 15 starred notifications. Starred notifications
                        are <strong className="text-zinc-200">permanently exempt from the 15-day automated purge</strong>.
                        Raising this quota allows this specific user to retain more permanently starred items without
                        affecting any other user.
                      </p>

                      <form onSubmit={handleLimitOverride} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Current Effective Limit
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`${selectedUserDetails?.maxStarredNotifications || 15} starred notifications`}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              New Custom Limit
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="999"
                              value={newStarredLimit}
                              onChange={(e) => setNewStarredLimit(parseInt(e.target.value, 10) || 15)}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={limitReason}
                            onChange={(e) => setLimitReason(e.target.value)}
                            placeholder="e.g. VIP account upgrade to 50 starred notifications"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingLimit}
                          className="w-full py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Starred Notification Limit Override</span>
                        </button>
                      </form>
                    </div>

                    {/* CARD 2: SCHEDULED REMINDERS QUOTA (3 REMINDERS) */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-flame-400" />
                          <span>Scheduled Reminders Quota (Max 3 Schedules)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          {selectedUserDetails?.reminderSchedules?.length || 0} / 3 SCHEDULES
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        StreakUp caps habit reminders to a maximum of 3 scheduled alert times per habit scope.
                        Admin can view active reminders and delete any schedule to instantly free up quota.
                      </p>

                      {(!selectedUserDetails?.reminderSchedules || selectedUserDetails.reminderSchedules.length === 0) ? (
                        <p className="text-xs text-zinc-500 py-3">No active reminder schedules found for this user.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-dark-border text-zinc-400">
                                <th className="py-2 px-3">Alert Time</th>
                                <th className="py-2 px-3">Scope</th>
                                <th className="py-2 px-3">Target Habit</th>
                                <th className="py-2 px-3">Status</th>
                                <th className="py-2 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                              {selectedUserDetails.reminderSchedules.map((r: any) => (
                                <tr key={r.id} className="text-zinc-300 hover:bg-dark-surface/40">
                                  <td className="py-2 px-3 font-mono text-flame-400 font-bold">{r.time}</td>
                                  <td className="py-2 px-3 font-mono">{r.scope}</td>
                                  <td className="py-2 px-3">{r.task?.title || 'Overall Daily Reminder'}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        r.isEnabled !== false
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : 'bg-zinc-500/10 text-zinc-400'
                                      }`}
                                    >
                                      {r.isEnabled !== false ? 'Active' : 'Disabled'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReminder(r.id)}
                                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                      title="Delete reminder schedule to free up quota"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* CARD 3: 12-HOUR FRIEND NUDGE LOCKOUT */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-flame-400" />
                          <span>12-Hour Friendly Nudge Cooldown Lockout</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          12-HR LOCKOUT
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        To prevent spam notifications, friends cannot nudge this user if they were nudged within the last 12 hours.
                        Admin can immediately clear the cooldown lockout so friends can nudge this user again without waiting.
                      </p>

                      <div className="flex items-center justify-between p-3.5 bg-dark-surface rounded-xl border border-dark-border">
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block">Nudge Cooldown Status</span>
                          <span className="text-[11px] text-zinc-400">
                            Enforced per friend-pair with 12-hour automated debounce
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetNudgeCooldown}
                          className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Clear Nudge Lockout Now</span>
                        </button>
                      </div>
                    </div>

                    {/* CARD 4: GLOBAL LEADERBOARD VISIBLE COHORT */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-flame-400" />
                          <span>Global Leaderboard Visible Cohort (Default: Top 10)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          PER-PERSON QUOTA
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, the global leaderboard displays only the Top 10 members worldwide. You can increase this visible cohort specifically for <strong className="text-zinc-200">@{selectedUserDetails?.username}</strong> (e.g. to Top 20, 50, or 100 members) so they can view more competitors on their leaderboard page.
                      </p>

                      <form onSubmit={handleOverrideLeaderboard} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Current Visible Cohort
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`Top ${selectedUserDetails?.leaderboardLimit || 10} members displayed`}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              New Cohort Limit (Max 100)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={newLeaderboardLimit}
                                onChange={(e) => setNewLeaderboardLimit(parseInt(e.target.value, 10) || 10)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                                required
                              />
                              {/* Quick Presets */}
                              <div className="flex gap-1">
                                {[10, 20, 50, 100].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setNewLeaderboardLimit(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      newLeaderboardLimit === preset
                                        ? 'bg-flame-500 text-zinc-950 border-flame-500'
                                        : 'bg-dark-surface text-zinc-400 border-dark-border hover:border-flame-500/50'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={leaderboardReason}
                            onChange={(e) => setLeaderboardReason(e.target.value)}
                            placeholder="e.g. Increased visible leaderboard cohort to Top 50 upon user request"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingLeaderboardLimit}
                          className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingLeaderboardLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Leaderboard Cohort Quota (Top {newLeaderboardLimit})</span>
                        </button>
                      </form>
                    </div>

                    {/* CARD 5: TOP 5 DISCOVER RANKING GROUPS */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Users className="w-4 h-4 text-flame-400" />
                          <span>Top 5 Discover Ranking Groups</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          TOP 5 FEATURED
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Public communities in StreakUp are automatically ranked for the global Discover page. The Top 5 groups with highest member counts and daily streak activity are featured globally.
                      </p>

                      {(!selectedUserDetails?.ownedGroups || selectedUserDetails.ownedGroups.length === 0) ? (
                        <div className="p-3 bg-dark-surface rounded-xl border border-dark-border text-xs text-zinc-400">
                          @{selectedUserDetails?.username} does not currently own any groups. They are participating in {selectedUserDetails?.groupMemberships?.length || 0} community groups.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-zinc-300 block">Groups Owned by @{selectedUserDetails?.username}:</span>
                          {selectedUserDetails.ownedGroups.map((g: any) => (
                            <div key={g.id} className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-zinc-200">{g.name}</span>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span>Code: <code className="text-flame-400">{g.joinCode}</code></span>
                                  <span>•</span>
                                  <span>Members: {g._count?.members || 1}</span>
                                  <span>•</span>
                                  <span>Habit Tasks: {g._count?.tasks || 0}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 text-[10px] font-bold">
                                Discovery Active
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB G: TASKS & GROUP MANAGEMENT */}
                {userTab === 'tasks_groups' && (
                  <div className="space-y-6">
                    {/* Personal Habits */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-flame-400" />
                          <span>Personal Habits ({selectedUserDetails?.tasks?.filter((t: any) => !t.isGroupTask).length || 0})</span>
                        </h3>
                        <span className="text-[10px] text-zinc-500 font-mono">Full Settings & Substring Privacy Controls</span>
                      </div>

                      <div className="space-y-3">
                        {(!selectedUserDetails?.tasks || selectedUserDetails.tasks.filter((t: any) => !t.isGroupTask).length === 0) ? (
                          <p className="text-xs text-zinc-500 italic py-3 text-center">No personal habits found for this user.</p>
                        ) : (
                          selectedUserDetails?.tasks
                            ?.filter((t: any) => !t.isGroupTask)
                            .map((t: any) => (
                              <div
                                key={t.id}
                                className="p-3.5 bg-dark-surface rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-flame-500/30 transition-all"
                              >
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-zinc-200 text-sm">{t.title}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-border text-zinc-400 font-mono">
                                      {t.category || 'General'}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                        t.status === 'ACTIVE'
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                      }`}
                                    >
                                      {t.status}
                                    </span>
                                    {t.priority && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-card border border-dark-border text-zinc-400 font-mono">
                                        {t.priority}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 flex-wrap">
                                    <span>Streak: <strong className="text-flame-400">{t.currentStreak}d</strong> (Best: {t.longestStreak}d)</span>
                                    <span>•</span>
                                    <span>Completions: {t._count?.completions || 0}</span>
                                    {t.hiddenFrom && t.hiddenFrom.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-rose-400 font-mono text-[10px]">Hidden: {t.hiddenFrom.join(', ')}</span>
                                      </>
                                    )}
                                    {t.visibleOnlyTo && t.visibleOnlyTo.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-400 font-mono text-[10px]">Restricted: {t.visibleOnlyTo.join(', ')}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenTaskEditor(t)}
                                    className="px-3 py-1.5 bg-flame-500/10 hover:bg-flame-500/20 text-flame-400 border border-flame-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>⚙️ Full Settings & Privacy</span>
                                  </button>
                                  {t.status === 'ARCHIVED' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRecoverGroupTask(t.id, t.title)}
                                      className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all"
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Group Habits & Memberships */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Users className="w-4 h-4 text-flame-400" />
                          <span>Group Habits & Memberships ({selectedUserDetails?.groupMemberships?.length || 0})</span>
                        </h3>
                        <span className="text-[10px] text-zinc-500 font-mono">Full Group & Member Administration</span>
                      </div>

                      <div className="space-y-3">
                        {(!selectedUserDetails?.groupMemberships || selectedUserDetails.groupMemberships.length === 0) ? (
                          <p className="text-xs text-zinc-500 italic py-3 text-center">No group memberships found for this user.</p>
                        ) : (
                          selectedUserDetails?.groupMemberships?.map((m: any) => (
                            <div
                              key={m.id}
                              className="p-3.5 bg-dark-surface rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-flame-500/30 transition-all"
                            >
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-zinc-200 text-sm">{m.group?.name}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30 font-bold">
                                    {m.role}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-border text-zinc-400">
                                    Code: {m.group?.joinCode}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1">
                                  Group Members: {m.group?._count?.members || m.group?.members?.length || 1} • Joined:{' '}
                                  {new Date(m.joinedAt).toLocaleDateString()}
                                  {m.group?.description ? ` • "${m.group.description}"` : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenGroupEditor(m.group || m)}
                                  className="px-3 py-1.5 bg-flame-500/10 hover:bg-flame-500/20 text-flame-400 border border-flame-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>⚙️ Full Group Settings & Members</span>
                                </button>
                                {m.role !== 'OWNER' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageGroupMember(m.groupId, 'OWNER', m.group?.name)
                                    }
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold"
                                  >
                                    Make Owner
                                  </button>
                                )}
                                {m.role === 'MEMBER' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageGroupMember(m.groupId, 'ADMIN', m.group?.name)
                                    }
                                    className="px-2.5 py-1 bg-dark-border hover:bg-dark-border/80 text-zinc-300 rounded-lg text-xs font-semibold"
                                  >
                                    Promote to Admin
                                  </button>
                                )}
                                {m.role === 'ADMIN' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageGroupMember(m.groupId, 'MEMBER', m.group?.name)
                                    }
                                    className="px-2.5 py-1 bg-dark-border hover:bg-dark-border/80 text-zinc-300 rounded-lg text-xs font-semibold"
                                  >
                                    Demote to Member
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Owned Groups if any not listed above */}
                    {selectedUserDetails?.ownedGroups && selectedUserDetails.ownedGroups.length > 0 && (
                      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-400" />
                            <span>Created & Owned Groups ({selectedUserDetails.ownedGroups.length})</span>
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {selectedUserDetails.ownedGroups.map((g: any) => (
                            <div
                              key={g.id}
                              className="p-3.5 bg-dark-surface rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-amber-500/30 transition-all"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-200 text-sm">{g.name}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                                    OWNER
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-border text-zinc-400">
                                    Code: {g.joinCode}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1">
                                  {g.description || 'No description provided'} • Members: {g._count?.members || g.members?.length || 1}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenGroupEditor(g)}
                                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>⚙️ Full Group Settings & Members</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Study Note Moderation */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-flame-400" />
                        <span>Study Note Moderation (Preserves Underlying Completion)</span>
                      </h3>

                      {editingCompletionId ? (
                        <form onSubmit={handleModerateStudyNote} className="space-y-3 p-4 bg-dark-surface rounded-xl border border-dark-border">
                          <h4 className="text-xs font-bold text-zinc-200">Edit or Scrub Study Note</h4>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Study Note Content
                            </label>
                            <textarea
                              rows={2}
                              value={editingStudyNote}
                              onChange={(e) => setEditingStudyNote(e.target.value)}
                              placeholder="Clean note text, or leave blank to scrub..."
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            />
                          </div>

                          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={clearNoteReactions}
                              onChange={(e) => setClearNoteReactions(e.target.checked)}
                              className="rounded border-dark-border accent-flame-500"
                            />
                            <span>Clear all emoji reactions for this completion record</span>
                          </label>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Mandatory Administrative Reason
                            </label>
                            <input
                              type="text"
                              value={moderationReason}
                              onChange={(e) => setModerationReason(e.target.value)}
                              placeholder="e.g. Inappropriate language scrubbing"
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isSubmittingModeration}
                              className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl"
                            >
                              Save Moderation
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCompletionId(null)}
                              className="px-4 py-2 bg-dark-border text-zinc-300 text-xs font-semibold rounded-xl"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-2">
                          {selectedUserDetails?.taskCompletions
                            ?.filter((c: any) => c.studyNote)
                            .slice(0, 10)
                            .map((c: any) => (
                              <div
                                key={c.id}
                                className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-zinc-400">{c.completionDate}</span>
                                    <span className="text-zinc-500">•</span>
                                    <span className="text-zinc-200">"{c.studyNote}"</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-500">
                                    Reactions: {c.reactions?.length || 0}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCompletionId(c.id);
                                    setEditingStudyNote(c.studyNote || '');
                                  }}
                                  className="px-3 py-1 bg-dark-border hover:bg-dark-border/80 text-zinc-300 rounded-lg text-xs font-semibold"
                                >
                                  Moderate
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB H: DANGER ZONE & ACCOUNT DELETION */}
                {userTab === 'danger' && (
                  <div className="bg-rose-500/5 border border-rose-500/30 rounded-2xl p-6 shadow-panel space-y-4">
                    <div className="flex items-center gap-3 text-rose-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-extrabold">Permanent Account Deletion (Irreversible)</h3>
                        <p className="text-xs text-rose-300/80">
                          This sensitive operation completely purges @{selectedUserDetails?.username} from PostgreSQL.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-dark-bg/60 rounded-xl border border-rose-500/20 text-xs text-zinc-300 space-y-2">
                      <p className="font-bold text-rose-300">Cascaded Deletions Include:</p>
                      <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                        <li>All user habits, task completions, and study notes</li>
                        <li>All friendships, pending friend requests, and mutual notifications</li>
                        <li>All group memberships, join requests, and owned group associations</li>
                        <li>Freeze logs, milestone events, and point ledger history</li>
                      </ul>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Type <span className="font-mono text-rose-400">"{selectedUserDetails?.username}"</span> to confirm
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={selectedUserDetails?.username}
                          className="w-full px-3 py-2 bg-dark-surface border border-rose-500/40 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Mandatory Administrative Reason
                        </label>
                        <input
                          type="text"
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          placeholder="e.g. Verified GDPR right to erasure request"
                          className="w-full px-3 py-2 bg-dark-surface border border-rose-500/40 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleDeleteUserAccount}
                        disabled={
                          deleteConfirmText.trim().toLowerCase() !== selectedUserDetails?.username.toLowerCase() ||
                          !deleteReason.trim()
                        }
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-zinc-100 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Confirm Permanent Deletion with Sensitive PIN</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB 2: AUDIT LEDGER TRAIL                        */}
        {/* ======================================================== */}
        {primaryTab === 'audit' && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-100 tracking-tight">
                  Immutable Administrative Audit Ledger
                </h2>
                <p className="text-xs text-zinc-400">
                  Total Records: {auditTotal} • Every privileged action is signed, verified, and logged.
                </p>
              </div>

              {/* Filters & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={auditFilterUser}
                  onChange={(e) => setAuditFilterUser(e.target.value)}
                  placeholder="Filter by target user..."
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none"
                />

                <select
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value)}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="">All Action Types</option>
                  <option value="USERNAME_COOLDOWN_OVERRIDE">Username Override</option>
                  <option value="EMAIL_COOLDOWN_OVERRIDE">Email Override</option>
                  <option value="OVERALL_STREAK_CORRECTION">Overall Streak</option>
                  <option value="TASK_STREAK_CORRECTION">Task Streak</option>
                  <option value="GRANT_DAY_STREAK">Grant Day Streak</option>
                  <option value="FREEZE_ADJUSTMENT">Freeze Adjustment</option>
                  <option value="POINTS_ADJUSTMENT">Points Adjustment</option>
                  <option value="OVERRIDE_LIMIT_15">Starred Limit Override</option>
                  <option value="DELETE_ADMIN_AUDIT_LOG">Delete Audit Log</option>
                  <option value="CLEAR_ADMIN_AUDIT_LOGS">Clear All Audit Logs</option>
                  <option value="TRANSFER_GROUP_OWNERSHIP">Transfer Group Ownership</option>
                  <option value="MODERATE_STUDY_NOTE">Study Note Moderation</option>
                  <option value="DELETE_USER_ACCOUNT">Delete User Account</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadAuditLogs(auditPage)}
                  disabled={isLoadingLogs}
                  className="p-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-zinc-300 text-xs"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* 15-Day Auto-Purge Banner & Clear All Button */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>15-Day Auto-Purge Policy Active:</strong> All audit records older than 15 days are automatically purged daily to protect database performance and privacy.
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearAllAuditLogs}
                className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-zinc-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 text-xs shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Logs</span>
              </button>
            </div>

            {/* Audit Table */}
            {isLoadingLogs ? (
              <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-flame-400" />
                <span>Loading audit trail...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="py-12 text-center text-xs text-zinc-500">No audit log records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-dark-border text-zinc-400 font-semibold">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Target User</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {auditLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-dark-surface/50 text-zinc-300">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">
                            @{log.adminUsername}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-flame-500/10 text-flame-400 border border-flame-500/30 font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-zinc-200">
                            {log.targetUser || log.targetUserId || '—'}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-zinc-400" title={log.reason}>
                            {log.reason}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                className="text-[11px] text-flame-400 font-semibold hover:underline"
                              >
                                {expandedLogId === log.id ? 'Hide' : 'View Diff'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAuditLog(log.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Delete this audit log (Requires Sensitive Password)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedLogId === log.id && (
                          <tr>
                            <td colSpan={6} className="p-4 bg-dark-bg/80 border-b border-dark-border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                                    BEFORE STATE:
                                  </span>
                                  <pre className="p-3 bg-dark-surface rounded-xl border border-dark-border text-[11px] text-zinc-300 overflow-x-auto">
                                    {log.beforeState ? JSON.stringify(log.beforeState, null, 2) : 'null'}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-[10px] text-zinc-500 font-bold block mb-1">
                                    AFTER STATE:
                                  </span>
                                  <pre className="p-3 bg-dark-surface rounded-xl border border-dark-border text-[11px] text-zinc-300 overflow-x-auto">
                                    {log.afterState ? JSON.stringify(log.afterState, null, 2) : 'null'}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB 3: ADMIN SECURITY & SENSITIVE PASSWORD       */}
        {/* ======================================================== */}
        {primaryTab === 'security' && (
          <div className="max-w-2xl mx-auto bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-6">
            <div>
              <h2 className="text-sm font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                <Lock className="w-4 h-4 text-flame-400" />
                <span>Super Admin Credentials & Sensitive Password</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Update the primary Super Admin login password or the secondary Sensitive Action Password required for sensitive overrides.
              </p>
            </div>

            <form onSubmit={handleUpdateAdminSecurity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Current Admin Password <span className="text-flame-400">*</span>
                </label>
                <input
                  type="password"
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  required
                />
              </div>

              <div className="pt-2 border-t border-dark-border space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    New Admin Password (optional, min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    New Sensitive Action Password (optional)
                  </label>
                  <input
                    type="password"
                    value={newAdminSensitivePin}
                    onChange={(e) => setNewAdminSensitivePin(e.target.value)}
                    placeholder="Enter new sensitive action password"
                    className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    This password is required for streak corrections, freezes, limit changes, and log deletions.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSecurity || !currentAdminPassword}
                className="w-full py-3 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all mt-2"
              >
                {isSubmittingSecurity ? 'Updating Credentials...' : 'Update Admin Credentials'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* FULL TASK SETTINGS & SUBSTRING PRIVACY MODAL             */}
      {/* ======================================================== */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-dark-card border border-flame-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                    <span>Full Task Settings & Privacy Controls</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Target: @{selectedUserDetails?.username} • Task: "{editingTask.title}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setUserSearchQuery('');
                  setUserSearchMatches([]);
                  setActiveSearchTarget(null);
                }}
                className="w-8 h-8 rounded-xl bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTaskFull} className="space-y-4 text-xs">
              {/* Basic Habit Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Task Title / Name <span className="text-flame-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskEditTitle}
                    onChange={(e) => setTaskEditTitle(e.target.value)}
                    placeholder="Habit title..."
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Task Description
                  </label>
                  <textarea
                    rows={2}
                    value={taskEditDescription}
                    onChange={(e) => setTaskEditDescription(e.target.value)}
                    placeholder="Habit description, notes, or expectations..."
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={taskEditCategory}
                    onChange={(e) => setTaskEditCategory(e.target.value)}
                    placeholder="e.g. Coding, Fitness, Study"
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={taskEditPriority}
                    onChange={(e: any) => setTaskEditPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Cadence / Recurrence
                  </label>
                  <select
                    value={taskEditRecurrence}
                    onChange={(e: any) => setTaskEditRecurrence(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  >
                    <option value="DAILY">Daily Habit (Recurring)</option>
                    <option value="ONE_TIME">One-Time Goal / Task</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Task Status
                  </label>
                  <select
                    value={taskEditStatus}
                    onChange={(e: any) => setTaskEditStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* Privacy Controls Section */}
              <div className="p-4 bg-dark-surface/90 rounded-2xl border border-dark-border space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-flame-400" />
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Privacy Controls & Substring Search
                  </h4>
                </div>

                {/* Hidden From */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">
                      Hidden From (Blocked users who cannot see this habit)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!taskEditHiddenFrom.includes('all')) {
                          setTaskEditHiddenFrom([...taskEditHiddenFrom, 'all']);
                        }
                      }}
                      className="text-[11px] font-bold text-flame-400 hover:text-flame-300 flex items-center gap-1"
                    >
                      + Hide from All ("all")
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-dark-card border border-dark-border rounded-xl">
                    {taskEditHiddenFrom.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic py-0.5">Not hidden from anyone (Public to friends/group)</span>
                    ) : (
                      taskEditHiddenFrom.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-[11px]"
                        >
                          {item === 'all' ? '🔒 ALL USERS' : `@${item}`}
                          <button
                            type="button"
                            onClick={() => setTaskEditHiddenFrom(taskEditHiddenFrom.filter((x) => x !== item))}
                            className="hover:text-rose-100 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={activeSearchTarget === 'TASK_HIDDEN' ? userSearchQuery : ''}
                      onFocus={() => setActiveSearchTarget('TASK_HIDDEN')}
                      onChange={(e) => {
                        setActiveSearchTarget('TASK_HIDDEN');
                        searchUsersForPrivacy(e.target.value);
                      }}
                      placeholder="Type letters to search by name, @username, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                    />

                    {activeSearchTarget === 'TASK_HIDDEN' && userSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-1 space-y-1">
                        {isSearchingUsers ? (
                          <div className="p-3 text-center text-zinc-400 text-xs">Searching directory...</div>
                        ) : userSearchMatches.length === 0 ? (
                          <div className="p-3 text-center text-zinc-500 text-xs">
                            No users containing "{userSearchQuery}".
                            <button
                              type="button"
                              onClick={() => {
                                const val = userSearchQuery.trim().replace(/^@/, '');
                                if (val && !taskEditHiddenFrom.includes(val)) {
                                  setTaskEditHiddenFrom([...taskEditHiddenFrom, val]);
                                }
                                setUserSearchQuery('');
                                setActiveSearchTarget(null);
                              }}
                              className="block mx-auto mt-1 text-flame-400 hover:underline font-semibold"
                            >
                              + Add "{userSearchQuery.trim()}" as custom entry
                            </button>
                          </div>
                        ) : (
                          userSearchMatches.map((u) => {
                            const alreadyIn = taskEditHiddenFrom.includes(u.username);
                            return (
                              <div
                                key={u.id}
                                className="p-2 hover:bg-dark-surface rounded-xl flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                                    {u.username[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-200 truncate">@{u.username} <span className="text-zinc-400 font-normal">({u.name || 'No name'})</span></p>
                                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={alreadyIn}
                                  onClick={() => {
                                    if (!alreadyIn) {
                                      setTaskEditHiddenFrom([...taskEditHiddenFrom, u.username]);
                                    }
                                    setUserSearchQuery('');
                                    setActiveSearchTarget(null);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    alreadyIn
                                      ? 'bg-dark-surface text-zinc-500 cursor-not-allowed'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {alreadyIn ? 'Added' : '+ Hide'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visible Only To */}
                <div className="space-y-2 pt-2 border-t border-dark-border/60">
                  <label className="text-xs font-semibold text-zinc-300">
                    Visible Only To (Restricted visibility whitelist — only these users can see)
                  </label>

                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-dark-card border border-dark-border rounded-xl">
                    {taskEditVisibleOnlyTo.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic py-0.5">Visible to everyone eligible (No specific restriction)</span>
                    ) : (
                      taskEditVisibleOnlyTo.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
                        >
                          @{item}
                          <button
                            type="button"
                            onClick={() => setTaskEditVisibleOnlyTo(taskEditVisibleOnlyTo.filter((x) => x !== item))}
                            className="hover:text-emerald-100 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={activeSearchTarget === 'TASK_VISIBLE' ? userSearchQuery : ''}
                      onFocus={() => setActiveSearchTarget('TASK_VISIBLE')}
                      onChange={(e) => {
                        setActiveSearchTarget('TASK_VISIBLE');
                        searchUsersForPrivacy(e.target.value);
                      }}
                      placeholder="Type letters to search by name, @username, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                    />

                    {activeSearchTarget === 'TASK_VISIBLE' && userSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-1 space-y-1">
                        {isSearchingUsers ? (
                          <div className="p-3 text-center text-zinc-400 text-xs">Searching directory...</div>
                        ) : userSearchMatches.length === 0 ? (
                          <div className="p-3 text-center text-zinc-500 text-xs">
                            No users containing "{userSearchQuery}".
                            <button
                              type="button"
                              onClick={() => {
                                const val = userSearchQuery.trim().replace(/^@/, '');
                                if (val && !taskEditVisibleOnlyTo.includes(val)) {
                                  setTaskEditVisibleOnlyTo([...taskEditVisibleOnlyTo, val]);
                                }
                                setUserSearchQuery('');
                                setActiveSearchTarget(null);
                              }}
                              className="block mx-auto mt-1 text-flame-400 hover:underline font-semibold"
                            >
                              + Add "{userSearchQuery.trim()}" as custom entry
                            </button>
                          </div>
                        ) : (
                          userSearchMatches.map((u) => {
                            const alreadyIn = taskEditVisibleOnlyTo.includes(u.username);
                            return (
                              <div
                                key={u.id}
                                className="p-2 hover:bg-dark-surface rounded-xl flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                                    {u.username[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-200 truncate">@{u.username} <span className="text-zinc-400 font-normal">({u.name || 'No name'})</span></p>
                                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={alreadyIn}
                                  onClick={() => {
                                    if (!alreadyIn) {
                                      setTaskEditVisibleOnlyTo([...taskEditVisibleOnlyTo, u.username]);
                                    }
                                    setUserSearchQuery('');
                                    setActiveSearchTarget(null);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    alreadyIn
                                      ? 'bg-dark-surface text-zinc-500 cursor-not-allowed'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {alreadyIn ? 'Added' : '+ Allow'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Mandatory Administrative Reason <span className="text-flame-400">*</span>
                </label>
                <input
                  type="text"
                  value={taskEditReason}
                  onChange={(e) => setTaskEditReason(e.target.value)}
                  placeholder="e.g. Administrative habit correction & privacy adjustment"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  required
                />
              </div>

              {renderNotificationOptions()}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTaskEdit}
                  className="flex-1 py-2.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingTaskEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Full Task Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULL GROUP SETTINGS & ROSTER CONTROL MODAL               */}
      {/* ======================================================== */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-dark-card border border-flame-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                    <span>Full Group Settings & Member Management</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Group: "{editingGroup.name}" • Join Code: {editingGroup.joinCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingGroup(null);
                  setUserSearchQuery('');
                  setUserSearchMatches([]);
                  setActiveSearchTarget(null);
                }}
                className="w-8 h-8 rounded-xl bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroupFull} className="space-y-4 text-xs">
              {/* Basic Group Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Group Name <span className="text-flame-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupEditName}
                    onChange={(e) => setGroupEditName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Join Code <span className="text-flame-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupEditJoinCode}
                    onChange={(e) => setGroupEditJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123"
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-flame-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Group Description
                  </label>
                  <textarea
                    rows={2}
                    value={groupEditDescription}
                    onChange={(e) => setGroupEditDescription(e.target.value)}
                    placeholder="Describe group goals, guidelines, or topics..."
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>

                {/* Owner Transfer with Substring Search */}
                <div className="sm:col-span-2 p-3.5 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Transfer Ownership (Current Owner ID: <code className="text-amber-400 font-mono">{groupEditOwnerId ? `${groupEditOwnerId.slice(0, 10)}...` : 'None'}</code>)</span>
                    </label>
                    <span className="text-[10px] text-zinc-500">Search by username, email, or name</span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={activeSearchTarget === 'GROUP_OWNER' ? userSearchQuery : ''}
                      onFocus={() => setActiveSearchTarget('GROUP_OWNER')}
                      onChange={(e) => {
                        setActiveSearchTarget('GROUP_OWNER');
                        searchUsersForPrivacy(e.target.value);
                      }}
                      placeholder="Type letters to search user to transfer group ownership to..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                    />

                    {activeSearchTarget === 'GROUP_OWNER' && userSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-1 space-y-1">
                        {isSearchingUsers ? (
                          <div className="p-3 text-center text-zinc-400 text-xs">Searching directory...</div>
                        ) : userSearchMatches.length === 0 ? (
                          <div className="p-3 text-center text-zinc-500 text-xs">No users found containing "{userSearchQuery}".</div>
                        ) : (
                          userSearchMatches.map((u) => (
                            <div
                              key={u.id}
                              className="p-2 hover:bg-dark-surface rounded-xl flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                                  {u.username[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-200 truncate">@{u.username} <span className="text-zinc-400 font-normal">({u.name || 'No name'})</span></p>
                                  <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setGroupEditOwnerId(u.id);
                                  setUserSearchQuery('');
                                  setActiveSearchTarget(null);
                                  toast.info(`Designated @${u.username} as new group owner. Save below to finalize.`);
                                }}
                                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[11px] font-bold"
                              >
                                Select
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Privacy Rules */}
              <div className="p-4 bg-dark-surface/90 rounded-2xl border border-dark-border space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-flame-400" />
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Group Privacy Rules & Substring Search
                  </h4>
                </div>

                {/* Group Hidden From */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">
                      Hidden From (Users blocked from discovering this group)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!groupEditHiddenFrom.includes('all')) {
                          setGroupEditHiddenFrom([...groupEditHiddenFrom, 'all']);
                        }
                      }}
                      className="text-[11px] font-bold text-flame-400 hover:text-flame-300"
                    >
                      + Hide from All ("all")
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-dark-card border border-dark-border rounded-xl">
                    {groupEditHiddenFrom.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic py-0.5">Not hidden from anyone</span>
                    ) : (
                      groupEditHiddenFrom.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-[11px]"
                        >
                          {item === 'all' ? '🔒 ALL USERS' : `@${item}`}
                          <button
                            type="button"
                            onClick={() => setGroupEditHiddenFrom(groupEditHiddenFrom.filter((x) => x !== item))}
                            className="hover:text-rose-100 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={activeSearchTarget === 'GROUP_HIDDEN' ? userSearchQuery : ''}
                      onFocus={() => setActiveSearchTarget('GROUP_HIDDEN')}
                      onChange={(e) => {
                        setActiveSearchTarget('GROUP_HIDDEN');
                        searchUsersForPrivacy(e.target.value);
                      }}
                      placeholder="Type letters to search by name, @username, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                    />

                    {activeSearchTarget === 'GROUP_HIDDEN' && userSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-1 space-y-1">
                        {isSearchingUsers ? (
                          <div className="p-3 text-center text-zinc-400 text-xs">Searching directory...</div>
                        ) : userSearchMatches.length === 0 ? (
                          <div className="p-3 text-center text-zinc-500 text-xs">
                            No users containing "{userSearchQuery}".
                            <button
                              type="button"
                              onClick={() => {
                                const val = userSearchQuery.trim().replace(/^@/, '');
                                if (val && !groupEditHiddenFrom.includes(val)) {
                                  setGroupEditHiddenFrom([...groupEditHiddenFrom, val]);
                                }
                                setUserSearchQuery('');
                                setActiveSearchTarget(null);
                              }}
                              className="block mx-auto mt-1 text-flame-400 hover:underline font-semibold"
                            >
                              + Add "{userSearchQuery.trim()}" as custom entry
                            </button>
                          </div>
                        ) : (
                          userSearchMatches.map((u) => {
                            const alreadyIn = groupEditHiddenFrom.includes(u.username);
                            return (
                              <div
                                key={u.id}
                                className="p-2 hover:bg-dark-surface rounded-xl flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                                    {u.username[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-200 truncate">@{u.username} <span className="text-zinc-400 font-normal">({u.name || 'No name'})</span></p>
                                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={alreadyIn}
                                  onClick={() => {
                                    if (!alreadyIn) {
                                      setGroupEditHiddenFrom([...groupEditHiddenFrom, u.username]);
                                    }
                                    setUserSearchQuery('');
                                    setActiveSearchTarget(null);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    alreadyIn
                                      ? 'bg-dark-surface text-zinc-500 cursor-not-allowed'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {alreadyIn ? 'Added' : '+ Hide'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group Visible Only To */}
                <div className="space-y-1.5 pt-2 border-t border-dark-border/60">
                  <label className="text-xs font-semibold text-zinc-300">
                    Visible Only To (Restricted visibility whitelist)
                  </label>
                  <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-dark-card border border-dark-border rounded-xl">
                    {groupEditVisibleOnlyTo.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic py-0.5">Visible to all eligible members</span>
                    ) : (
                      groupEditVisibleOnlyTo.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
                        >
                          @{item}
                          <button
                            type="button"
                            onClick={() => setGroupEditVisibleOnlyTo(groupEditVisibleOnlyTo.filter((x) => x !== item))}
                            className="hover:text-emerald-100 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={activeSearchTarget === 'GROUP_VISIBLE' ? userSearchQuery : ''}
                      onFocus={() => setActiveSearchTarget('GROUP_VISIBLE')}
                      onChange={(e) => {
                        setActiveSearchTarget('GROUP_VISIBLE');
                        searchUsersForPrivacy(e.target.value);
                      }}
                      placeholder="Type letters to search by name, @username, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                    />

                    {activeSearchTarget === 'GROUP_VISIBLE' && userSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-1 space-y-1">
                        {isSearchingUsers ? (
                          <div className="p-3 text-center text-zinc-400 text-xs">Searching directory...</div>
                        ) : userSearchMatches.length === 0 ? (
                          <div className="p-3 text-center text-zinc-500 text-xs">
                            No users containing "{userSearchQuery}".
                            <button
                              type="button"
                              onClick={() => {
                                const val = userSearchQuery.trim().replace(/^@/, '');
                                if (val && !groupEditVisibleOnlyTo.includes(val)) {
                                  setGroupEditVisibleOnlyTo([...groupEditVisibleOnlyTo, val]);
                                }
                                setUserSearchQuery('');
                                setActiveSearchTarget(null);
                              }}
                              className="block mx-auto mt-1 text-flame-400 hover:underline font-semibold"
                            >
                              + Add "{userSearchQuery.trim()}" as custom entry
                            </button>
                          </div>
                        ) : (
                          userSearchMatches.map((u) => {
                            const alreadyIn = groupEditVisibleOnlyTo.includes(u.username);
                            return (
                              <div
                                key={u.id}
                                className="p-2 hover:bg-dark-surface rounded-xl flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                                    {u.username[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-200 truncate">@{u.username} <span className="text-zinc-400 font-normal">({u.name || 'No name'})</span></p>
                                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={alreadyIn}
                                  onClick={() => {
                                    if (!alreadyIn) {
                                      setGroupEditVisibleOnlyTo([...groupEditVisibleOnlyTo, u.username]);
                                    }
                                    setUserSearchQuery('');
                                    setActiveSearchTarget(null);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    alreadyIn
                                      ? 'bg-dark-surface text-zinc-500 cursor-not-allowed'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {alreadyIn ? 'Added' : '+ Allow'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Member Management Roster */}
              <div className="p-4 bg-dark-surface rounded-2xl border border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Users className="w-4 h-4 text-flame-400" />
                    <span>Group Member Roster ({editingGroup.members?.length || 0})</span>
                  </h4>
                  <span className="text-[10px] text-zinc-500">Live role management & removal</span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {(!editingGroup.members || editingGroup.members.length === 0) ? (
                    <p className="text-xs text-zinc-500 italic py-2 text-center">No member records loaded for this group.</p>
                  ) : (
                    editingGroup.members.map((m: any) => {
                      const memberUser = m.user || {};
                      const isOwner = m.role === 'OWNER';
                      return (
                        <div
                          key={m.userId}
                          className="p-2.5 bg-dark-card rounded-xl border border-dark-border flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center font-bold text-zinc-200 shrink-0 text-xs">
                              {(memberUser.username || m.userId || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-200 truncate">@{memberUser.username || m.userId}</span>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                    isOwner
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      : m.role === 'ADMIN'
                                      ? 'bg-flame-500/10 text-flame-400 border border-flame-500/30'
                                      : 'bg-dark-border text-zinc-400'
                                  }`}
                                >
                                  {m.role}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate">
                                {memberUser.name ? `${memberUser.name} • ` : ''}{memberUser.email || 'No email'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isOwner && (
                              <>
                                <select
                                  value={m.role}
                                  onChange={(e) =>
                                    handleManageGroupMember(
                                      editingGroup.id,
                                      e.target.value as 'ADMIN' | 'MEMBER',
                                      editingGroup.name,
                                      m.userId
                                    )
                                  }
                                  className="px-2 py-1 bg-dark-surface border border-dark-border rounded-lg text-[11px] text-zinc-300 focus:outline-none focus:border-flame-500"
                                >
                                  <option value="MEMBER">Member</option>
                                  <option value="ADMIN">Admin</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveGroupMember(
                                      editingGroup.id,
                                      m.userId,
                                      memberUser.username || m.userId
                                    )
                                  }
                                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Mandatory Administrative Reason <span className="text-flame-400">*</span>
                </label>
                <input
                  type="text"
                  value={groupEditReason}
                  onChange={(e) => setGroupEditReason(e.target.value)}
                  placeholder="e.g. Administrative group settings & membership update"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  required
                />
              </div>

              {renderNotificationOptions()}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroupEdit}
                  className="flex-1 py-2.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingGroupEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Full Group Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* HEATMAP DAY ACTIVITY & STREAK / FREEZE CONTROL MODAL     */}
      {/* ======================================================== */}
      {dayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-dark-card border border-flame-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    dayModalMode === 'STREAK'
                      ? 'bg-flame-500/10 border border-flame-500/30 text-flame-400'
                      : dayModalMode === 'UNFREEZE'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                  }`}
                >
                  {dayModalMode === 'STREAK' ? (
                    <Flame className="w-5 h-5" />
                  ) : dayModalMode === 'UNFREEZE' ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Snowflake className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100">
                    Day Activity Control: {dayModalDate}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Target User: @{selectedUserDetails?.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDayModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-dark-surface rounded-2xl border border-dark-border">
              <button
                type="button"
                onClick={() => {
                  setDayModalMode('STREAK');
                  setDayModalReason(`Administrative streak completion granted for ${dayModalDate}`);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  dayModalMode === 'STREAK'
                    ? 'bg-flame-500 text-zinc-950 shadow-md shadow-flame-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Grant Streak</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDayModalMode('FREEZE');
                  setDayModalReason(`Historical freeze applied for ${dayModalDate}`);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  dayModalMode === 'FREEZE'
                    ? 'bg-sky-500 text-zinc-950 shadow-md shadow-sky-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>Freeze Day</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDayModalMode('UNFREEZE');
                  setDayModalReason(`Administrative freeze removed for ${dayModalDate}`);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  dayModalMode === 'UNFREEZE'
                    ? 'bg-rose-500 text-zinc-100 shadow-md shadow-rose-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>Unfreeze</span>
              </button>
            </div>

            {/* Mode Description Banner */}
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                dayModalMode === 'STREAK'
                  ? 'bg-flame-500/10 border-flame-500/30 text-amber-200'
                  : dayModalMode === 'UNFREEZE'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
              }`}
            >
              {dayModalMode === 'STREAK' ? (
                <span>
                  🔥 <strong>Grant Streak:</strong> Records habit completion on <strong>{dayModalDate}</strong>. Automatically awards 10 points to PointLedger, recalculates personal & group streaks, and updates heatmaps everywhere in the app.
                </span>
              ) : dayModalMode === 'UNFREEZE' ? (
                <span>
                  🔓 <strong>Remove Freeze:</strong> Revokes streak freeze protection on <strong>{dayModalDate}</strong>. Streaks and freeze usage will be recalculated automatically.
                </span>
              ) : (
                <span>
                  ❄️ <strong>Freeze Day:</strong> Applies streak freeze protection on <strong>{dayModalDate}</strong>. Bridges missed habit days without breaking active streaks.
                </span>
              )}
            </div>

            <form onSubmit={handleDayActionSubmit} className="space-y-3 text-xs">
              {dayModalMode === 'STREAK' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Associate Task (Optional)
                    </label>
                    <select
                      value={dayModalTaskId}
                      onChange={(e) => setDayModalTaskId(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    >
                      <option value="">General User Streak (First Active Task)</option>
                      {selectedUserDetails?.tasks?.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.isGroupTask ? `[Group Task: ${t.group?.name || 'Group'}] ` : '[Personal] '}
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Optional Study Note / Journal Entry
                    </label>
                    <input
                      type="text"
                      value={dayModalNote}
                      onChange={(e) => setDayModalNote(e.target.value)}
                      placeholder="e.g. Completed targeted learning modules"
                      className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Mandatory Administrative Reason
                </label>
                <input
                  type="text"
                  value={dayModalReason}
                  onChange={(e) => setDayModalReason(e.target.value)}
                  placeholder="e.g. Administrative retroactive credit"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  required
                />
              </div>

              {renderNotificationOptions()}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDayModalOpen(false)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDayAction}
                  className={`flex-1 py-2.5 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                    dayModalMode === 'STREAK'
                      ? 'bg-flame-500 hover:bg-flame-400 text-zinc-950'
                      : dayModalMode === 'UNFREEZE'
                      ? 'bg-rose-500 hover:bg-rose-400 text-zinc-100'
                      : 'bg-sky-500 hover:bg-sky-400 text-zinc-950'
                  }`}
                >
                  {isSubmittingDayAction ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : dayModalMode === 'STREAK' ? (
                    <Flame className="w-3.5 h-3.5" />
                  ) : dayModalMode === 'UNFREEZE' ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    <Snowflake className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Authorize & {dayModalMode === 'STREAK' ? 'Apply Streak' : dayModalMode === 'UNFREEZE' ? 'Remove Freeze' : 'Apply Freeze'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SENSITIVE ACTION PASSWORD CONFIRMATION MODAL             */}
      {/* ======================================================== */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-card border border-rose-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-zinc-100">{pinModalTitle}</h3>
                <p className="text-[11px] text-zinc-400">Secondary Sensitive Password Required</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{pinModalDescription}</p>

            <form onSubmit={executePinAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Super Admin Sensitive Password
                </label>
                <div className="relative">
                  <input
                    type={showPinPassword ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter sensitive action password"
                    className="w-full px-4 py-2.5 pr-10 bg-dark-surface border border-rose-500/30 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinPassword(!showPinPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    {showPinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPinAction || !pinInput.trim()}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-zinc-100 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {isSubmittingPinAction ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Authorize & Proceed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminControlPage;
