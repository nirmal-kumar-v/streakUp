import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Camera,
  Upload,
  ImageIcon,
  Compass,
  Play,
  Plus,
  Gamepad2,
  Trophy,
  Download,
  RotateCcw,
  UserPlus,
  UserCheck,
  Activity,
} from 'lucide-react';
import {
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
  recoverUserAccountByAdmin,
  adminUpdateTaskFull,
  adminUpdateGroupFull,
  unfreezeUserDate,
  adminDeleteReminderSchedule,
  overrideLeaderboardLimit,
  overrideReminderLimit,
  overrideTaskReminderLimit,
  overrideDiscoverGroupsLimit,
  overrideProfileImageLimit,
  adminUpdateUserProfileImage,
  searchGroupsForAdmin,
  adminToggleGroupDiscoverability,
  getUserReminderSettings,
  adminUpdateOverallReminders,
  adminUpdateTaskReminders,
  adminSendTestReminder,
  adminTriggerManualReminderCheck,
  adminUpdateUserPreferences,
  getMemberLinkedInGamesAdmin,
  adminCorrectLinkedInGameStreak,
  adminGrantLinkedInGameDate,
  adminSetLinkedInGameCommitment,
  adminToggleGroupSpecialMode,
  adminSetSpecialActivityCommitment,
  fetchAdminUserRequests,
  adminResetUserMilestones,
  adminCreateReminderSchedule,
  AdminUser,
  AdminAuditLogItem,
  AdminGroupItem,
  AdminUserReminderSettings,
} from '../api/admin';
import { NotificationPreference } from '../api/notifications';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';
import { AdminLogin } from '../components/AdminLogin';
import { isLinkedInName, LINKEDIN_GAMES_LIST } from '../utils/linkedin';
import { AdminUserRequestsTab } from '../components/admin/AdminUserRequestsTab';
import { AdminManagersTab } from '../components/admin/AdminManagersTab';
import { AdminSendMessageTab } from '../components/admin/AdminSendMessageTab';
import { AdminPlatformStatsBar } from '../components/admin/AdminPlatformStatsBar';
import { AdminUserFriendsTab } from '../components/admin/AdminUserFriendsTab';
import { AdminUserNotificationsTab } from '../components/admin/AdminUserNotificationsTab';
import { AdminGroupManageModal } from '../components/admin/AdminGroupManageModal';
import { AdminCreateTaskModal } from '../components/admin/AdminCreateTaskModal';
import { AdminUncompleteTaskModal } from '../components/admin/AdminUncompleteTaskModal';
import { AdminSystemTab } from '../components/admin/AdminSystemTab';

export const AdminControlPage: React.FC = () => {
  const toast = useToast();

  // ------------------------------------------
  // Admin Auth State
  // ------------------------------------------
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [activeAdmin, setActiveAdmin] = useState<any>(null);

  // ------------------------------------------
  // Primary Tabs: users | groups | friends | notifications | requests | managers | messages | system | audit | security
  // ------------------------------------------
  const [primaryTab, setPrimaryTab] = useState<
    'users' | 'groups' | 'friends' | 'notifications' | 'requests' | 'managers' | 'messages' | 'system' | 'audit' | 'security'
  >('users');

  // Friends Primary Tab State
  const [friendSearchUserQuery, setFriendSearchUserQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<AdminUser[]>([]);
  const [isSearchingUserForFriends, setIsSearchingUserForFriends] = useState(false);
  const [selectedFriendUser, setSelectedFriendUser] = useState<AdminUser | null>(null);

  // Notifications Primary Tab State
  const [notifSearchUserQuery, setNotifSearchUserQuery] = useState('');
  const [notifSearchResults, setNotifSearchResults] = useState<AdminUser[]>([]);
  const [isSearchingUserForNotif, setIsSearchingUserForNotif] = useState(false);
  const [selectedNotifUser, setSelectedNotifUser] = useState<AdminUser | null>(null);

  const handleSearchUserForFriends = async () => {
    if (!friendSearchUserQuery.trim()) return;
    try {
      setIsSearchingUserForFriends(true);
      const res = await searchAdminUsers(friendSearchUserQuery.trim());
      if (res.success) {
        setFriendSearchResults(res.users);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSearchingUserForFriends(false);
    }
  };

  const handleSearchUserForNotif = async () => {
    if (!notifSearchUserQuery.trim()) return;
    try {
      setIsSearchingUserForNotif(true);
      const res = await searchAdminUsers(notifSearchUserQuery.trim());
      if (res.success) {
        setNotifSearchResults(res.users);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSearchingUserForNotif(false);
    }
  };

  // ------------------------------------------
  // User Search & Selected User State
  // ------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'deleted'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Sub-tabs inside Selected User Control Center
  const [userTab, setUserTab] = useState<
    'overview' | 'username_email' | 'streaks' | 'points' | 'reminders' | 'limits' | 'tasks_groups' | 'friends' | 'notifications' | 'danger'
  >('overview');

  // Modal states for new full-power admin controls
  const [selectedGroupForManage, setSelectedGroupForManage] = useState<any | null>(null);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [uncompleteModalTask, setUncompleteModalTask] = useState<any | null>(null);

  // New Custom Reminder Schedule Form State
  const [customReminderTime, setCustomReminderTime] = useState('');
  const [customReminderType, setCustomReminderType] = useState<'OVERALL' | 'TASK'>('OVERALL');
  const [customReminderTaskId, setCustomReminderTaskId] = useState('');
  const [customReminderInApp, setCustomReminderInApp] = useState(true);
  const [customReminderEmail, setCustomReminderEmail] = useState(false);
  const [customReminderReason, setCustomReminderReason] = useState('');
  const [isCreatingCustomReminder, setIsCreatingCustomReminder] = useState(false);

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
  const [dayModalSelectedTaskIds, setDayModalSelectedTaskIds] = useState<string[]>([]);
  const [dayModalNote, setDayModalNote] = useState('');
  const [dayModalReason, setDayModalReason] = useState('');
  const [isSubmittingDayAction, setIsSubmittingDayAction] = useState(false);

  // ------------------------------------------
  // Form States for Controls
  // ------------------------------------------
  // Profile Picture Control
  const [profileImageModalOpen, setProfileImageModalOpen] = useState(false);
  const [profileImageMode, setProfileImageMode] = useState<'UPLOAD' | 'URL' | 'REMOVE'>('UPLOAD');
  const [profileImageInput, setProfileImageInput] = useState('');
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [profileImageReason, setProfileImageReason] = useState('');
  const [isSubmittingProfileImage, setIsSubmittingProfileImage] = useState(false);

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
  const [streakApplyToOverall, setStreakApplyToOverall] = useState(false);
  const [adminGameApplyToOverall, setAdminGameApplyToOverall] = useState(false);
  const [adminGameGrantApplyToOverall, setAdminGameGrantApplyToOverall] = useState(false);

  // Freeze Shield Balance & Shelf Recharge Control (Scope Isolated)
  const [freezeScope, setFreezeScope] = useState<'overall' | string>('overall');
  const [newFreezeCapacity, setNewFreezeCapacity] = useState<number>(1);
  const [newFreezeBalance, setNewFreezeBalance] = useState<number>(0);
  const [newFreezeRechargeDays, setNewFreezeRechargeDays] = useState<number>(0);
  const [freezeControlReason, setFreezeControlReason] = useState('');

  // Groups Discovery Management State
  const [adminGroupsList, setAdminGroupsList] = useState<AdminGroupItem[]>([]);
  const [isLoadingAdminGroups, setIsLoadingAdminGroups] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupDiscoverFilter, setGroupDiscoverFilter] = useState<'ALL' | 'DISCOVERABLE' | 'NON_DISCOVERABLE'>('ALL');

  // Reminders Management State
  const [userReminderSettings, setUserReminderSettings] = useState<AdminUserReminderSettings | null>(null);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [overallReminderEnabled, setOverallReminderEnabled] = useState(true);
  const [overallReminderTimes, setOverallReminderTimes] = useState<string[]>(['20:00']);
  const [newOverallReminderTime, setNewOverallReminderTime] = useState<string>('08:00');
  const [overallReminderDays, setOverallReminderDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [overallReminderTimezone, setOverallReminderTimezone] = useState('Asia/Kolkata');
  const [taskRemindersState, setTaskRemindersState] = useState<Record<string, { reminderTimes: string[]; isReminderActive: boolean }>>({});
  const [newTaskReminderTime, setNewTaskReminderTime] = useState<Record<string, string>>({});
  const [isSavingOverallReminders, setIsSavingOverallReminders] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [manualCheckLogs, setManualCheckLogs] = useState<any | null>(null);
  const [isRunningManualCheck, setIsRunningManualCheck] = useState(false);
  const [adminNotificationPreferences, setAdminNotificationPreferences] = useState<NotificationPreference | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSendingTestReminder, setIsSendingTestReminder] = useState(false);

  // Staging for Applied Changes (Single Password Save)
  const [appliedChanges, setAppliedChanges] = useState<
    Record<
      string,
      {
        id: string;
        label: string;
        description?: string;
        applyFn: (pin: string) => Promise<any>;
      }
    >
  >({});
  const [isSavingAllApplied, setIsSavingAllApplied] = useState(false);

  // Points
  const [pointsDelta, setPointsDelta] = useState<number | ''>('');
  const [pointsReason, setPointsReason] = useState('');

  // Limits & Quotas
  const [newStarredLimit, setNewStarredLimit] = useState<number>(15);
  const [limitReason, setLimitReason] = useState('');

  const [newLeaderboardLimit, setNewLeaderboardLimit] = useState<number>(10);
  const [leaderboardReason, setLeaderboardReason] = useState('');

  const [newReminderLimit, setNewReminderLimit] = useState<number>(3);
  const [reminderLimitReason, setReminderLimitReason] = useState('');

  const [newTaskReminderLimit, setNewTaskReminderLimit] = useState<number>(1);
  const [taskReminderLimitReason, setTaskReminderLimitReason] = useState('');

  const [newDiscoverGroupsLimit, setNewDiscoverGroupsLimit] = useState<number>(5);
  const [discoverGroupsReason, setDiscoverGroupsReason] = useState('');

  const [newProfileImageLimitMb, setNewProfileImageLimitMb] = useState<number>(5);
  const [profileImageLimitReason, setProfileImageLimitReason] = useState('');

  // Submission Statuses linked to isSavingAllApplied
  const isSubmittingStreak = isSavingAllApplied;
  const isSubmittingFreezeControl = isSavingAllApplied;
  const isSubmittingPoints = isSavingAllApplied;
  const isSubmittingLimit = isSavingAllApplied;
  const isSubmittingLeaderboardLimit = isSavingAllApplied;
  const isSubmittingReminderLimit = isSavingAllApplied;
  const isSubmittingTaskReminderLimit = isSavingAllApplied;
  const isSubmittingDiscoverGroupsLimit = isSavingAllApplied;
  const isSubmittingProfileImageLimit = isSavingAllApplied;

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
  // Admin Security State (Separated Forms)
  // ------------------------------------------
  const [loginCurrentPassword, setLoginCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [isSubmittingLoginPassword, setIsSubmittingLoginPassword] = useState(false);

  const [sensitiveCurrentPassword, setSensitiveCurrentPassword] = useState('');
  const [newAdminSensitivePin, setNewAdminSensitivePin] = useState('');
  const [confirmAdminSensitivePin, setConfirmAdminSensitivePin] = useState('');
  const [isSubmittingSensitivePin, setIsSubmittingSensitivePin] = useState(false);

  // ------------------------------------------
  // LinkedIn Group Games Super Admin State
  // ------------------------------------------
  const [adminLinkedInGames, setAdminLinkedInGames] = useState<any[]>([]);
  const [isLoadingAdminLinkedInGames, setIsLoadingAdminLinkedInGames] = useState(false);
  const [selectedAdminGameId, setSelectedAdminGameId] = useState<string>('pinpoint');
  const [adminGameCurrentStreak, setAdminGameCurrentStreak] = useState<number>(0);
  const [adminGameLongestStreak, setAdminGameLongestStreak] = useState<number>(0);
  const [adminGameStreakReason, setAdminGameStreakReason] = useState<string>('');
  const [adminGameGrantDate, setAdminGameGrantDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [adminGameGrantNote, setAdminGameGrantNote] = useState<string>('');
  const [adminGameGrantReason, setAdminGameGrantReason] = useState<string>('');
  const [adminGameCommitmentReason, setAdminGameCommitmentReason] = useState<string>('');

  const isSubmittingAdminGameStreak = isSavingAllApplied;
  const isSubmittingAdminGameGrant = isSavingAllApplied;
  const isSubmittingAdminGameCommitment = isSavingAllApplied;

  // ------------------------------------------
  const ADMIN_INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes inactivity timeout (Admin alone)

  // ------------------------------------------
  // Verify token & inactivity on mount
  // ------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem('streakup_admin_token');
    const lastActivityStr = localStorage.getItem('streakup_admin_last_activity');
    const now = Date.now();

    if (token) {
      if (lastActivityStr && now - Number(lastActivityStr) > ADMIN_INACTIVITY_LIMIT_MS) {
        localStorage.removeItem('streakup_admin_token');
        localStorage.removeItem('streakup_admin_last_activity');
        setIsAdminAuth(false);
        toast.error('Admin session expired due to 5 minutes of inactivity. Please log in again.');
        return;
      }

      fetchAdminProfile()
        .then((res) => {
          if (res.success) {
            localStorage.setItem('streakup_admin_last_activity', String(Date.now()));
            setIsAdminAuth(true);
            setActiveAdmin(res.admin);
            handleSearchUsers('');
          }
        })
        .catch(() => {
          localStorage.removeItem('streakup_admin_token');
          localStorage.removeItem('streakup_admin_last_activity');
          setIsAdminAuth(false);
        });
    }
  }, []);

  // ------------------------------------------
  // Admin-only 5-minute inactivity tracker
  // ------------------------------------------
  useEffect(() => {
    if (!isAdminAuth) return;

    const recordActivity = () => {
      localStorage.setItem('streakup_admin_last_activity', String(Date.now()));
    };

    // Track user interactions within the admin panel
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    // Periodic check every 5 seconds
    const interval = setInterval(() => {
      const lastActivity = Number(localStorage.getItem('streakup_admin_last_activity') || Date.now());
      if (Date.now() - lastActivity > ADMIN_INACTIVITY_LIMIT_MS) {
        localStorage.removeItem('streakup_admin_token');
        localStorage.removeItem('streakup_admin_last_activity');
        setIsAdminAuth(false);
        setActiveAdmin(null);
        setSelectedUserId(null);
        setSelectedUserDetails(null);
        toast.error('Admin session expired due to 5 minutes of inactivity. Please log in again.');
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      clearInterval(interval);
    };
  }, [isAdminAuth]);

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
  const handleAdminLogout = () => {
    localStorage.removeItem('streakup_admin_token');
    localStorage.removeItem('streakup_admin_last_activity');
    setIsAdminAuth(false);
    setActiveAdmin(null);
    setSelectedUserId(null);
    setSelectedUserDetails(null);
    toast.info('Signed out of Super Admin Panel.');
  };

  // ------------------------------------------
  // User Search & Selection
  // ------------------------------------------
  const handleSearchUsers = async (q: string = searchQuery, filter: 'all' | 'deleted' = userFilterTab) => {
    setIsSearching(true);
    try {
      const res = await searchAdminUsers(q.trim(), filter === 'deleted' ? 'deleted' : undefined);
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
    if (selectedUserId !== user.id) {
      setAppliedChanges({});
      setPointsDelta('');
      setPointsReason('');
    }
    setSelectedUserId(user.id);
    setIsLoadingDetails(true);
    try {
      const res = await fetchAdminUserDetails(user.id);
      if (res.success) {
        const u = res.user;
        setSelectedUserDetails(u);

        // Pre-fill fields for smooth experience
        if (streakTargetType === 'TASK' && selectedTaskId) {
          const currentT = u.tasks?.find((x: any) => x.id === selectedTaskId);
          if (currentT) {
            setNewCurrentStreak(currentT.currentStreak || 0);
            setNewLongestStreak(currentT.longestStreak || 0);
          } else if (u.tasks && u.tasks.length > 0) {
            setSelectedTaskId(u.tasks[0].id);
            setNewCurrentStreak(u.tasks[0].currentStreak || 0);
            setNewLongestStreak(u.tasks[0].longestStreak || 0);
          }
        } else {
          setNewCurrentStreak(u.currentStreak || 0);
          setNewLongestStreak(u.longestStreak || 0);
          if (u.tasks && u.tasks.length > 0 && !selectedTaskId) {
            setSelectedTaskId(u.tasks[0].id);
          }
        }
        setNewStarredLimit(u.maxStarredNotifications || 15);
        setNewLeaderboardLimit(u.leaderboardLimit || 10);
        setNewReminderLimit(u.reminderLimit || 3);
        setNewTaskReminderLimit(u.taskReminderLimit || 1);
        setNewDiscoverGroupsLimit(u.discoverGroupsLimit || 5);
        setNewProfileImageLimitMb(u.profileImageLimitMb || 5);
        setFreezeScope('overall');
        setNewFreezeCapacity(u.overallFreezeCapacity || 1);
        setNewFreezeBalance(u.overallFreezeBalance || 0);
        setNewFreezeRechargeDays(u.overallFreezeRechargeDays || 0);
        setSelectedTimezone(u.timezone || 'Asia/Kolkata');
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
  // Pending User Requests Counter
  // ------------------------------------------
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  const loadPendingRequestsCount = useCallback(async () => {
    try {
      const res = await fetchAdminUserRequests({ status: 'PENDING' });
      if (res.success) {
        setPendingRequestsCount(res.count ?? (res.requests ? res.requests.length : 0));
      }
    } catch {
      // background polling safe fallback
    }
  }, []);

  useEffect(() => {
    if (isAdminAuth) {
      loadPendingRequestsCount();
      const interval = setInterval(loadPendingRequestsCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdminAuth, loadPendingRequestsCount]);

  useEffect(() => {
    if (isAdminAuth && primaryTab === 'requests') {
      loadPendingRequestsCount();
    }
  }, [isAdminAuth, primaryTab, loadPendingRequestsCount]);

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

  // Save All Applied Changes with a Single Sensitive Password Prompt
  const handleSaveAllAppliedChanges = () => {
    const changesList = Object.values(appliedChanges);
    if (changesList.length === 0) {
      toast.info('No changes applied yet. Modify any section and click "Apply" first.');
      return;
    }

    const summary = changesList.map((c) => c.label).join(', ');

    openPinPrompt(
      `Save ${changesList.length} Applied Modification${changesList.length > 1 ? 's' : ''}`,
      `Enter Super Admin Sensitive Password once to commit all applied modifications: ${summary}.`,
      async (pin) => {
        setIsSavingAllApplied(true);
        try {
          for (const item of changesList) {
            await item.applyFn(pin);
          }
          toast.success(`Successfully saved all ${changesList.length} modification${changesList.length > 1 ? 's' : ''}!`);
          setAppliedChanges({});
          setPointsDelta('');
          setPointsReason('');
          setStreakReason('');
          setFreezeControlReason('');
          setLimitReason('');
          setLeaderboardReason('');
          setReminderLimitReason('');
          setTaskReminderLimitReason('');
          setAdminGameStreakReason('');
          setAdminGameGrantReason('');
          setAdminGameGrantNote('');
          setAdminGameCommitmentReason('');

          if (selectedUserId && linkedInGroup?.id) {
            await loadAdminLinkedInGames(selectedUserId, linkedInGroup.id);
          }
          refreshCurrentUser();
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to save some applied modifications.'));
        } finally {
          setIsSavingAllApplied(false);
        }
      }
    );
  };

  // E. Streak Correction (Apply to staging per task / overall)
  const handleStreakCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!streakReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const targetType = streakTargetType;
    const taskId = targetType === 'TASK' ? selectedTaskId : undefined;
    const taskObj = targetType === 'TASK' ? selectedUserDetails?.tasks?.find((x: any) => x.id === taskId) : null;
    const taskTitle = taskObj?.title || 'Habit';
    const curr = Number(newCurrentStreak) || 0;
    const long = Number(newLongestStreak) || 0;
    const reason = streakReason.trim();
    const applyToOverall = targetType === 'TASK' ? streakApplyToOverall : undefined;
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    const changeKey = targetType === 'OVERALL' ? 'streak_overall' : `streak_task_${taskId}`;
    const displayLabel = targetType === 'OVERALL'
      ? `Overall Streak: ${curr}d curr / ${long}d best`
      : `Streak (${taskTitle}): ${curr}d curr / ${long}d best`;

    setAppliedChanges((prev) => ({
      ...prev,
      [changeKey]: {
        id: changeKey,
        label: displayLabel,
        description: `Set ${targetType === 'OVERALL' ? 'overall' : taskTitle} streak to ${curr}d current, ${long}d longest`,
        applyFn: async (pin: string) => {
          return correctUserStreak(selectedUserId, {
            type: targetType,
            taskId,
            currentStreak: curr,
            longestStreak: long,
            reason,
            applyToOverall,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success(`${displayLabel} applied! Click "Save" at the top to commit.`);
  };

  // ------------------------------------------
  // LinkedIn Group Games Super Admin Handlers
  // ------------------------------------------
  const linkedInGroup = useMemo(() => {
    if (!selectedUserDetails) return null;
    const fromMembership = selectedUserDetails.groupMemberships?.find((m: any) =>
      isLinkedInName(m.group?.name)
    )?.group;
    if (fromMembership) return fromMembership;
    const fromOwned = selectedUserDetails.ownedGroups?.find((g: any) =>
      isLinkedInName(g.name)
    );
    if (fromOwned) return fromOwned;
    const fromTasks = selectedUserDetails.tasks?.find((t: any) =>
      t.isGroupTask && isLinkedInName(t.title || t.group?.name)
    )?.group;
    return fromTasks || null;
  }, [selectedUserDetails]);

  const loadAdminLinkedInGames = useCallback(async (userId: string, groupId: string) => {
    setIsLoadingAdminLinkedInGames(true);
    try {
      const res = await getMemberLinkedInGamesAdmin(userId, groupId);
      if (res.success && res.games) {
        setAdminLinkedInGames(res.games);
        const cur = res.games.find((g: any) => g.id === selectedAdminGameId) || res.games[0];
        if (cur) {
          setAdminGameCurrentStreak(cur.currentStreak || 0);
          setAdminGameLongestStreak(cur.longestStreak || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load member LinkedIn games:', err);
    } finally {
      setIsLoadingAdminLinkedInGames(false);
    }
  }, [selectedAdminGameId]);

  useEffect(() => {
    if (selectedUserId && linkedInGroup?.id) {
      loadAdminLinkedInGames(selectedUserId, linkedInGroup.id);
    } else {
      setAdminLinkedInGames([]);
    }
  }, [selectedUserId, linkedInGroup?.id, loadAdminLinkedInGames]);

  useEffect(() => {
    const cur = adminLinkedInGames.find((g: any) => g.id === selectedAdminGameId || g.gameId === selectedAdminGameId);
    if (cur) {
      setAdminGameCurrentStreak(cur.currentStreak || 0);
      setAdminGameLongestStreak(cur.longestStreak || 0);
    }
  }, [selectedAdminGameId, adminLinkedInGames]);

  const handleAdminCorrectGameStreak = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !linkedInGroup?.id) return;
    const game = LINKEDIN_GAMES_LIST.find((g) => g.id === selectedAdminGameId);
    const gameName = game ? game.name : selectedAdminGameId;
    const gameId = selectedAdminGameId;
    const curr = Number(adminGameCurrentStreak);
    const long = Number(adminGameLongestStreak);
    const reason = adminGameStreakReason.trim() || `Admin corrected ${gameName} streak for @${selectedUserDetails?.username}`;
    const applyToOverall = adminGameApplyToOverall;
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;
    const groupId = linkedInGroup.id;

    const changeKey = `linkedin_streak_${gameId}`;
    const displayLabel = `LinkedIn ${gameName} Streak: ${curr}d curr / ${long}d best`;

    setAppliedChanges((prev) => ({
      ...prev,
      [changeKey]: {
        id: changeKey,
        label: displayLabel,
        description: `Correct ${gameName} streak to ${curr}d curr, ${long}d best`,
        applyFn: async (pin: string) => {
          return adminCorrectLinkedInGameStreak(selectedUserId, groupId, {
            gameId,
            currentStreak: curr,
            longestStreak: long,
            reason,
            applyToOverall,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success(`${displayLabel} applied! Click "Save" at the top to commit.`);
  };

  const handleAdminGrantGameDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !linkedInGroup?.id || !adminGameGrantDate) return;
    const game = LINKEDIN_GAMES_LIST.find((g) => g.id === selectedAdminGameId);
    const gameName = game ? game.name : selectedAdminGameId;
    const gameId = selectedAdminGameId;
    const grantDate = adminGameGrantDate;
    const note = adminGameGrantNote.trim() || undefined;
    const reason = adminGameGrantReason.trim() || `Admin granted ${gameName} completion on ${grantDate}`;
    const applyToOverall = adminGameGrantApplyToOverall;
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;
    const groupId = linkedInGroup.id;

    const changeKey = `linkedin_grant_${gameId}_${grantDate}`;
    const displayLabel = `LinkedIn ${gameName} Grant: ${grantDate}`;

    setAppliedChanges((prev) => ({
      ...prev,
      [changeKey]: {
        id: changeKey,
        label: displayLabel,
        description: `Grant completion for ${gameName} on ${grantDate}`,
        applyFn: async (pin: string) => {
          return adminGrantLinkedInGameDate(selectedUserId, groupId, {
            gameId,
            date: grantDate,
            studyNote: note,
            reason,
            applyToOverall,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success(`${displayLabel} applied! Click "Save" at the top to commit.`);
  };

  const handleAdminSetGameCommitment = (gameId: string, isCommitted: boolean) => {
    if (!selectedUserId || !linkedInGroup?.id) return;
    const game = LINKEDIN_GAMES_LIST.find((g) => g.id === gameId);
    const gameName = game ? game.name : gameId;
    const actionLabel = isCommitted ? 'Commit' : 'Uncommit';
    const reason =
      adminGameCommitmentReason.trim() ||
      `Admin set ${gameName} commitment to ${actionLabel.toUpperCase()} for @${selectedUserDetails?.username}`;
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;
    const groupId = linkedInGroup.id;

    const changeKey = `linkedin_commitment_${gameId}`;
    const displayLabel = `LinkedIn ${gameName}: ${actionLabel}`;

    setAppliedChanges((prev) => ({
      ...prev,
      [changeKey]: {
        id: changeKey,
        label: displayLabel,
        description: `Set commitment for ${gameName} to ${actionLabel.toUpperCase()}`,
        applyFn: async (pin: string) => {
          return adminSetLinkedInGameCommitment(selectedUserId, groupId, {
            gameId,
            isCommitted,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success(`${displayLabel} applied! Click "Save" at the top to commit.`);
  };

  // G. Points Adjustment (Apply to staging)
  const handlePointsAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const delta = typeof pointsDelta === 'number' ? pointsDelta : parseInt(String(pointsDelta), 10);
    if (!delta || isNaN(delta)) {
      toast.error('Points adjustment cannot be zero.');
      return;
    }
    if (!pointsReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const currentDelta = delta;
    const currentReason = pointsReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      points: {
        id: 'points',
        label: `Points: ${currentDelta > 0 ? '+' : ''}${currentDelta} pts`,
        description: `Adjust points by ${currentDelta > 0 ? '+' : ''}${currentDelta} pts`,
        applyFn: async (pin: string) => {
          return adjustUserPoints(selectedUserId, {
            pointsDelta: Number(currentDelta),
            reason: currentReason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success(`Points adjustment of ${currentDelta > 0 ? '+' : ''}${currentDelta} pts applied! Click "Save" at the top to commit.`);
  };

  // H. Limit of 15 (Starred Notifications) Override (Apply to staging)
  const handleLimitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!limitReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newStarredLimit);
    const reason = limitReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      starredLimit: {
        id: 'starredLimit',
        label: `Starred Limit: ${limitVal}`,
        description: `Set starred notifications limit to ${limitVal}`,
        applyFn: async (pin: string) => {
          return overrideUserLimit15(selectedUserId, {
            maxStarredNotifications: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Starred notifications limit applied! Click "Save" at the top to commit.');
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
            const hasExistingTasks = selectedUserDetails?.tasks && selectedUserDetails.tasks.length > 0;
            if (hasExistingTasks && dayModalSelectedTaskIds.length === 0) {
              toast.error('Please select at least one task to complete on this day.');
              return;
            }
            const res = await grantDayStreak(selectedUserId, {
              date: dayModalDate,
              taskId: dayModalSelectedTaskIds[0] || dayModalTaskId || undefined,
              taskIds: dayModalSelectedTaskIds.length > 0 ? dayModalSelectedTaskIds : undefined,
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

  // Leaderboard Cohort Limit Override (Apply to staging)
  const handleOverrideLeaderboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!leaderboardReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newLeaderboardLimit);
    const reason = leaderboardReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      leaderboardLimit: {
        id: 'leaderboardLimit',
        label: `Leaderboard Limit: Top ${limitVal}`,
        description: `Set leaderboard cohort limit to Top ${limitVal}`,
        applyFn: async (pin: string) => {
          return overrideLeaderboardLimit(selectedUserId, {
            leaderboardLimit: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Leaderboard limit applied! Click "Save" at the top to commit.');
  };

  // Scheduled Reminders Quota Override (Apply to staging)
  const handleOverrideReminderLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!reminderLimitReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newReminderLimit);
    const reason = reminderLimitReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      reminderLimit: {
        id: 'reminderLimit',
        label: `Reminders Quota: ${limitVal}`,
        description: `Set reminder quota to ${limitVal}`,
        applyFn: async (pin: string) => {
          return overrideReminderLimit(selectedUserId, {
            reminderLimit: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Reminders quota applied! Click "Save" at the top to commit.');
  };

  // Per-Task Scheduled Reminders Quota Override (Apply to staging)
  const handleOverrideTaskReminderLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!taskReminderLimitReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newTaskReminderLimit);
    const reason = taskReminderLimitReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      taskReminderLimit: {
        id: 'taskReminderLimit',
        label: `Habit Reminders Quota: ${limitVal}/habit`,
        description: `Set per-habit reminders quota to ${limitVal}`,
        applyFn: async (pin: string) => {
          return overrideTaskReminderLimit(selectedUserId, {
            taskReminderLimit: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Per-task reminders quota applied! Click "Save" at the top to commit.');
  };

  // Top Discover Groups Display Limit Override (Apply to staging)
  const handleOverrideDiscoverGroupsLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!discoverGroupsReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newDiscoverGroupsLimit);
    const reason = discoverGroupsReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      discoverGroupsLimit: {
        id: 'discoverGroupsLimit',
        label: `Discover Groups Limit: Top ${limitVal}`,
        description: `Set discover top groups quota to Top ${limitVal}`,
        applyFn: async (pin: string) => {
          return overrideDiscoverGroupsLimit(selectedUserId, {
            discoverGroupsLimit: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Discover groups limit applied! Click "Save" at the top to commit.');
  };

  // Profile Picture Upload Limit Override (Apply to staging)
  const handleOverrideProfileImageLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!profileImageLimitReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const limitVal = Number(newProfileImageLimitMb);
    const reason = profileImageLimitReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    setAppliedChanges((prev) => ({
      ...prev,
      profileImageLimit: {
        id: 'profileImageLimit',
        label: `Avatar Quota: ${limitVal}MB`,
        description: `Set max profile picture size to ${limitVal}MB`,
        applyFn: async (pin: string) => {
          return overrideProfileImageLimit(selectedUserId, {
            profileImageLimitMb: limitVal,
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          });
        },
      },
    }));

    toast.success('Profile picture quota applied! Click "Save" at the top to commit.');
  };

  // Freeze Shield Scope Switching
  const handleFreezeScopeChange = (scope: string) => {
    setFreezeScope(scope);
    if (scope === 'overall') {
      setNewFreezeCapacity(selectedUserDetails?.overallFreezeCapacity || 1);
      setNewFreezeBalance(selectedUserDetails?.overallFreezeBalance || 0);
      setNewFreezeRechargeDays(selectedUserDetails?.overallFreezeRechargeDays || 0);
    } else {
      const targetTask = selectedUserDetails?.tasks?.find((t: any) => t.id === scope);
      if (targetTask) {
        setNewFreezeCapacity(targetTask.freezeCapacity || 1);
        setNewFreezeBalance(targetTask.freezeBalance || 0);
        setNewFreezeRechargeDays(targetTask.freezeRechargeDays || 0);
      }
    }
  };

  // Freeze Shield Balance & Shelf Recharge Control (Apply to staging)
  const handleUpdateFreezeControl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!freezeControlReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const scope = freezeScope;
    const taskObj = scope !== 'overall' ? selectedUserDetails?.tasks?.find((t: any) => t.id === scope) : null;
    const taskTitle = taskObj?.title || 'Habit';
    const cap = Number(newFreezeCapacity);
    const bal = Number(newFreezeBalance);
    const rech = Number(newFreezeRechargeDays);
    const reason = freezeControlReason.trim();
    const sendInApp = notifyInApp;
    const sendEmail = notifyEmail;
    const includeReason = notifyIncludeReason;
    const includeChanges = notifyIncludeChanges;

    const changeKey = scope === 'overall' ? 'freeze_overall' : `freeze_task_${scope}`;
    const displayLabel = scope === 'overall'
      ? `Overall Freezes: ${bal}/${cap} shields`
      : `Freezes (${taskTitle}): ${bal}/${cap} shields`;

    setAppliedChanges((prev) => ({
      ...prev,
      [changeKey]: {
        id: changeKey,
        label: displayLabel,
        description: `Set ${scope === 'overall' ? 'overall' : taskTitle} freeze balance to ${bal}/${cap}, recharge ${rech}/7d`,
        applyFn: async (pin: string) => {
          const payload: any = {
            reason,
            sensitivePin: pin,
            sendInApp,
            sendEmail,
            includeReason,
            includeChanges,
          };

          if (scope === 'overall') {
            payload.overallFreezeCapacity = cap;
            payload.overallFreezeBalance = bal;
            payload.overallFreezeRechargeDays = rech;
          } else {
            payload.taskId = scope;
            payload.freezeCapacity = cap;
            payload.freezeBalance = bal;
            payload.freezeRechargeDays = rech;
          }

          return adjustUserFreezes(selectedUserId, payload);
        },
      },
    }));

    toast.success(`${displayLabel} applied! Click "Save" at the top to commit.`);
  };

  // Group Discovery Functions
  const loadAdminGroups = async (query = groupSearchQuery) => {
    setIsLoadingAdminGroups(true);
    try {
      const res = await searchGroupsForAdmin(query);
      if (res.success) {
        setAdminGroupsList(res.groups || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to fetch groups.'));
    } finally {
      setIsLoadingAdminGroups(false);
    }
  };

  const handleToggleGroupDiscoverability = (group: AdminGroupItem) => {
    const nextState = !group.isDiscoverable;
    openPinPrompt(
      nextState ? 'Enable Public Discoverability' : 'Make Group Non-Discoverable',
      `Enter Super Admin Sensitive Password to mark group "${group.name}" (${group.joinCode}) as ${
        nextState ? 'Publicly Discoverable' : 'Non-Discoverable (Direct search/code only)'
      }. Existing members and search by name/code remain active.`,
      async (pin) => {
        try {
          const res = await adminToggleGroupDiscoverability(group.id, {
            isDiscoverable: nextState,
            reason: `Admin toggled group "${group.name}" discoverability to ${nextState ? 'Discoverable' : 'Non-discoverable'}`,
            sensitivePin: pin,
          });
          if (res.success) {
            toast.info(res.message);
            loadAdminGroups();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update group discoverability.'));
        }
      }
    );
  };

  const handleToggleSpecialMode = (group: AdminGroupItem, nextState: boolean) => {
    openPinPrompt(
      nextState ? 'Enable Special Group Features' : 'Disable Special Group Features',
      `Enter Super Admin Sensitive Password to ${
        nextState ? 'ENABLE' : 'DISABLE'
      } special tracking for group "${group.name}". ${
        nextState
          ? 'Eligible activities (Daily, POTD, etc.) will be tracked with dedicated streaks.'
          : 'Group will behave as an ordinary group. Historical streaks and completions remain safely preserved.'
      }`,
      async (pin) => {
        try {
          const res = await adminToggleGroupSpecialMode(group.id, {
            isSpecialGroup: nextState,
            reason: `Admin toggled special mode to ${nextState ? 'ENABLED' : 'DISABLED'} for group "${group.name}"`,
            sensitivePin: pin,
          });
          if (res.success) {
            toast.info(res.message);
            loadAdminGroups();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update special mode.'));
        }
      }
    );
  };

  const handleAdminTogglePotdCommitment = (groupId: string, targetUserId: string, currentVal: boolean) => {
    openPinPrompt(
      currentVal ? 'Disable Member POTD Commitment' : 'Enable Member POTD Commitment',
      `Enter Super Admin Sensitive Password to change POTD commitment for this user. Historical completion records and streaks are safely preserved.`,
      async (pin) => {
        try {
          const res = await adminSetSpecialActivityCommitment(targetUserId, groupId, {
            isPotdCommitted: !currentVal,
            sensitivePin: pin,
            reason: `Admin toggled POTD commitment to ${!currentVal ? 'ENABLED' : 'DISABLED'} for user`,
          });
          if (res.success) {
            toast.info(res.message);
            refreshCurrentUser();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update member POTD commitment.'));
        }
      }
    );
  };

  // Reminder Management Functions
  const loadUserReminders = async (userId: string) => {
    setIsLoadingReminders(true);
    try {
      const res = await getUserReminderSettings(userId);
      if (res.success) {
        setUserReminderSettings(res);
        setOverallReminderEnabled(res.overall?.isEnabled ?? true);
        const overallTimes = (res.overall?.schedules || []).map((s: any) => s.time);
        setOverallReminderTimes(overallTimes.length > 0 ? overallTimes : ['20:00']);
        setOverallReminderTimezone(res.timezone || 'Asia/Kolkata');
        if (res.preferences) {
          setAdminNotificationPreferences(res.preferences);
        }

        const initialTasks: Record<string, { reminderTimes: string[]; isReminderActive: boolean }> = {};
        const defaultTaskInputs: Record<string, string> = {};
        for (const t of res.tasks || []) {
          const taskTimes = t.schedules && t.schedules.length > 0 ? t.schedules.map((s: any) => s.time) : [];
          initialTasks[t.taskId] = {
            reminderTimes: taskTimes,
            isReminderActive: t.taskRemindersEnabled ?? true,
          };
          defaultTaskInputs[t.taskId] = '09:00';
        }
        setTaskRemindersState(initialTasks);
        setNewTaskReminderTime(defaultTaskInputs);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to fetch user reminder settings.'));
    } finally {
      setIsLoadingReminders(false);
    }
  };

  const handleAddOverallReminder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newOverallReminderTime) return;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newOverallReminderTime)) {
      toast.error('Invalid time format. Please use HH:mm in 24hr format.');
      return;
    }
    const [h, m] = newOverallReminderTime.split(':');
    const formatted = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    if (overallReminderTimes.includes(formatted)) {
      toast.error(`Time ${formatted} is already in the overall reminders list.`);
      return;
    }
    const quota = userReminderSettings?.quotaLimit || selectedUserDetails?.reminderLimit || 3;
    if (overallReminderTimes.length >= quota) {
      toast.error(`User overall reminder limit reached (${quota} max). Increase quota first.`);
      return;
    }
    setOverallReminderTimes([...overallReminderTimes, formatted].sort());
    toast.info(`Added ${formatted}. Click "Save Overall Reminder Settings" to apply.`);
  };

  const handleRemoveOverallReminder = (timeToRemove: string) => {
    setOverallReminderTimes((prev) => prev.filter((t) => t !== timeToRemove));
  };

  const handleAddTaskReminderTime = (taskId: string) => {
    const timeVal = newTaskReminderTime[taskId] || '09:00';
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeVal)) {
      toast.error('Invalid time format. Please use HH:mm in 24hr format.');
      return;
    }
    const [h, m] = timeVal.split(':');
    const formatted = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    const taskConfig = taskRemindersState[taskId] || { reminderTimes: [], isReminderActive: true };
    if (taskConfig.reminderTimes.includes(formatted)) {
      toast.error(`Time ${formatted} is already configured for this task.`);
      return;
    }
    const taskQuota =
      userReminderSettings?.tasks?.find((t) => t.taskId === taskId)?.maxAllowed ||
      userReminderSettings?.taskQuotaLimit ||
      selectedUserDetails?.taskReminderLimit ||
      1;
    if (taskConfig.reminderTimes.length >= taskQuota) {
      toast.error(`Tasks support a maximum of ${taskQuota} reminder ${taskQuota === 1 ? 'time' : 'times'}.`);
      return;
    }
    setTaskRemindersState({
      ...taskRemindersState,
      [taskId]: {
        ...taskConfig,
        reminderTimes: [...taskConfig.reminderTimes, formatted].sort(),
      },
    });
    toast.info(`Added ${formatted} for this task. Click "Save Task Reminders" to apply.`);
  };

  const handleRemoveTaskReminderTime = (taskId: string, timeToRemove: string) => {
    const taskConfig = taskRemindersState[taskId];
    if (!taskConfig) return;
    setTaskRemindersState({
      ...taskRemindersState,
      [taskId]: {
        ...taskConfig,
        reminderTimes: taskConfig.reminderTimes.filter((t) => t !== timeToRemove),
      },
    });
  };

  const handleSaveOverallReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const quota = userReminderSettings?.quotaLimit || selectedUserDetails?.reminderLimit || 3;
    if (overallReminderTimes.length > quota) {
      toast.error(`Cannot save ${overallReminderTimes.length} reminder times. User quota limit is ${quota}.`);
      return;
    }
    openPinPrompt(
      'Authorize Overall Reminder Update',
      `Enter Super Admin Sensitive Password to configure overall reminder schedule (${overallReminderTimes.join(', ') || 'No times'}) for @${selectedUserDetails?.username}.`,
      async (pin) => {
        setIsSavingOverallReminders(true);
        try {
          const res = await adminUpdateOverallReminders(selectedUserId, {
            times: overallReminderTimes,
            isEnabled: overallReminderEnabled,
            reason: `Admin updated overall reminder schedule (${overallReminderTimes.join(', ') || 'cleared'})`,
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            loadUserReminders(selectedUserId);
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update overall reminders.'));
        } finally {
          setIsSavingOverallReminders(false);
        }
      }
    );
  };

  const handleSaveTaskReminders = async (taskId: string, taskTitle: string) => {
    if (!selectedUserId) return;
    const taskConfig = taskRemindersState[taskId];
    if (!taskConfig) return;
    if (taskConfig.reminderTimes.length > 2) {
      toast.error('Tasks support a maximum of 2 reminder times.');
      return;
    }

    openPinPrompt(
      'Authorize Task Reminder Update',
      `Enter Super Admin Sensitive Password to configure reminder times (${taskConfig.reminderTimes.join(', ') || 'No times'}) for task "${taskTitle}".`,
      async (pin) => {
        setSavingTaskId(taskId);
        try {
          const res = await adminUpdateTaskReminders(selectedUserId, taskId, {
            times: taskConfig.reminderTimes,
            isEnabled: taskConfig.isReminderActive,
            reason: `Admin configured reminders for task "${taskTitle}" (${taskConfig.reminderTimes.join(', ') || 'cleared'})`,
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            loadUserReminders(selectedUserId);
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update task reminders.'));
        } finally {
          setSavingTaskId(null);
        }
      }
    );
  };

  const handleTriggerManualReminderCheck = async () => {
    setIsRunningManualCheck(true);
    try {
      const res = await adminTriggerManualReminderCheck();
      if (res.success) {
        toast.info(res.message || 'Reminder check executed successfully.');
        setManualCheckLogs(res);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to trigger manual reminder check.'));
    } finally {
      setIsRunningManualCheck(false);
    }
  };

  const handleAdminTogglePref = (key: keyof NotificationPreference) => {
    if (!adminNotificationPreferences) return;
    setAdminNotificationPreferences({
      ...adminNotificationPreferences,
      [key]: !adminNotificationPreferences[key],
    });
  };

  const handleSaveAdminPreferences = async () => {
    if (!selectedUserId || !adminNotificationPreferences) return;

    openPinPrompt(
      'Authorize Notification Channel Updates',
      `Enter Super Admin Sensitive Password to save notification delivery channels for @${selectedUserDetails?.username}.`,
      async (pin) => {
        setIsSavingPreferences(true);
        try {
          const res = await adminUpdateUserPreferences(selectedUserId, {
            preferences: adminNotificationPreferences,
            reason: `Admin updated notification channel preferences for @${selectedUserDetails?.username}`,
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setAdminNotificationPreferences(res.preferences);
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update notification channel preferences.'));
        } finally {
          setIsSavingPreferences(false);
        }
      }
    );
  };

  const handleSendTestReminder = (scope: 'OVERALL' | 'TASK', taskId?: string, taskTitle?: string) => {
    if (!selectedUserId) return;
    openPinPrompt(
      'Authorize Test Reminder Delivery',
      `Enter Super Admin Sensitive Password to dispatch a live test ${
        scope === 'TASK' ? `task reminder for "${taskTitle}"` : 'overall streak reminder'
      } to @${selectedUserDetails?.username} via In-App and Email.`,
      async (pin) => {
        setIsSendingTestReminder(true);
        try {
          const res = await adminSendTestReminder(selectedUserId, {
            scope,
            taskId,
            reason: `Super Admin test reminder dispatch (${scope})`,
            sensitivePin: pin,
          });
          if (res.success) {
            toast.success(res.message);
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to dispatch test reminder.'));
        } finally {
          setIsSendingTestReminder(false);
        }
      }
    );
  };

  // Handle Profile Picture File Change
  const handleProfileImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported image format. Allowed formats are JPEG, PNG, and WebP.');
      return;
    }

    const limitMb = selectedUserDetails?.profileImageLimitMb || 5;
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`File size exceeds the ${limitMb} MB limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Profile Picture Update / Remove
  const handleUpdateProfileImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!profileImageReason.trim()) {
      toast.error('An administrative reason is mandatory for audit logging.');
      return;
    }

    const isRemoving = profileImageMode === 'REMOVE';
    const payloadImage = isRemoving ? null : (profileImagePreview || profileImageInput.trim());

    if (!isRemoving && !payloadImage) {
      toast.error('Please upload an image or provide a valid image URL.');
      return;
    }

    openPinPrompt(
      isRemoving ? 'Authorize Profile Picture Removal' : 'Authorize Profile Picture Update',
      `Enter Super Admin Sensitive Password to ${isRemoving ? 'remove' : 'update'} profile picture for @${selectedUserDetails?.username}.`,
      async (pin) => {
        setIsSubmittingProfileImage(true);
        try {
          const res = await adminUpdateUserProfileImage(selectedUserId, {
            profileImage: payloadImage,
            remove: isRemoving,
            reason: profileImageReason.trim(),
            sensitivePin: pin,
            sendInApp: notifyInApp,
            sendEmail: notifyEmail,
            includeReason: notifyIncludeReason,
            includeChanges: notifyIncludeChanges,
          });
          if (res.success) {
            toast.info(res.message);
            setProfileImageModalOpen(false);
            setProfileImageInput('');
            setProfileImagePreview(null);
            setProfileImageReason('');
            refreshCurrentUser();
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to update user profile picture.'));
        } finally {
          setIsSubmittingProfileImage(false);
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

  // CSV Export for Audit Trail
  const handleExportAuditLogsCsv = () => {
    if (!auditLogs || auditLogs.length === 0) {
      toast.error('No audit records available in current view to export.');
      return;
    }
    const headers = ['Timestamp', 'Admin', 'Action', 'Target User', 'Target User ID', 'Reason'];
    const rows = auditLogs.map((log) => [
      `"${new Date(log.createdAt).toISOString()}"`,
      `"${log.adminUsername || ''}"`,
      `"${log.action || ''}"`,
      `"${(log.targetUser || '').replace(/"/g, '""')}"`,
      `"${log.targetUserId || ''}"`,
      `"${(log.reason || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `streakup_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${auditLogs.length} audit log entries as CSV.`);
  };

  // CSV Export for User Directory
  const handleExportUsersCsv = () => {
    if (!searchResults || searchResults.length === 0) {
      toast.error('No users in current view to export.');
      return;
    }
    const headers = [
      'User ID',
      'Name',
      'Username',
      'Email',
      'Verified',
      'Current Streak',
      'Longest Streak',
      'Points',
      'Status',
      'Created At',
    ];
    const rows = searchResults.map((u) => [
      `"${u.id}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${u.username}"`,
      `"${u.email}"`,
      `"${u.isEmailVerified ? 'YES' : 'NO'}"`,
      `"${u.currentStreak || 0}"`,
      `"${u.longestStreak || 0}"`,
      `"${u.points || 0}"`,
      `"${u.isDeleted ? 'DELETED' : 'ACTIVE'}"`,
      `"${u.createdAt || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `streakup_users_${userFilterTab}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${searchResults.length} users to CSV.`);
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

  // Recover User Account (Super Admin Action within 10-day recovery window)
  const handleRecoverUserAccount = (targetUserId: string, targetUsername?: string) => {
    const uname = targetUsername || selectedUserDetails?.username || 'user';
    openPinPrompt(
      `Recover Account for @${uname}`,
      `This will reactivate the deleted account for @${uname} and restore the user's login access with all data intact.`,
      async (pin: string) => {
        try {
          const res = await recoverUserAccountByAdmin(targetUserId, {
            reason: 'Account recovered by Super Admin',
            sensitivePin: pin,
          });
          if (res.success) {
            toast.info(res.message);
            handleSearchUsers(searchQuery);
            if (selectedUserId === targetUserId) {
              refreshCurrentUser();
            }
          }
        } catch (err: any) {
          toast.error(extractErrorMessage(err, 'Failed to recover account.'));
        }
      }
    );
  };

  // O. Admin Security: Separated Login Password & Sensitive PIN Handlers
  const handleUpdateLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCurrentPassword) {
      toast.error('Current admin password is required.');
      return;
    }
    if (!newAdminPassword) {
      toast.error('Please enter a new admin login password.');
      return;
    }
    if (newAdminPassword.length < 8) {
      toast.error('New admin login password must be at least 8 characters long.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      toast.error('New login password and confirmation do not match.');
      return;
    }

    setIsSubmittingLoginPassword(true);
    try {
      const res = await changeAdminCredentials({
        currentPassword: loginCurrentPassword,
        newPassword: newAdminPassword.trim(),
        reason: 'Super Admin login password update',
      });
      if (res.success) {
        toast.info(res.message);
        setLoginCurrentPassword('');
        setNewAdminPassword('');
        setConfirmAdminPassword('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update login password.'));
    } finally {
      setIsSubmittingLoginPassword(false);
    }
  };

  const handleUpdateSensitivePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitiveCurrentPassword) {
      toast.error('Current admin password is required to verify identity.');
      return;
    }
    if (!newAdminSensitivePin) {
      toast.error('Please enter a new sensitive action password / PIN.');
      return;
    }
    if (newAdminSensitivePin.length < 4) {
      toast.error('Sensitive PIN must be at least 4 digits or characters.');
      return;
    }
    if (newAdminSensitivePin !== confirmAdminSensitivePin) {
      toast.error('New sensitive action password and confirmation do not match.');
      return;
    }

    setIsSubmittingSensitivePin(true);
    try {
      const res = await changeAdminCredentials({
        currentPassword: sensitiveCurrentPassword,
        newSensitivePin: newAdminSensitivePin.trim(),
        reason: 'Super Admin sensitive action password update',
      });
      if (res.success) {
        toast.info(res.message);
        setSensitiveCurrentPassword('');
        setNewAdminSensitivePin('');
        setConfirmAdminSensitivePin('');
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update sensitive action password.'));
    } finally {
      setIsSubmittingSensitivePin(false);
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
      setDayModalSelectedTaskIds(selectedUserDetails.tasks.map((t: any) => t.id));
    } else {
      setDayModalTaskId('');
      setDayModalSelectedTaskIds([]);
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
      <AdminLogin
        onSuccess={(admin) => {
          setIsAdminAuth(true);
          setActiveAdmin(admin);
          toast.info('Super Admin authenticated successfully.');
          handleSearchUsers('');
        }}
      />
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
        {/* Live Platform Telemetry & Overview Bar */}
        <AdminPlatformStatsBar />

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
            onClick={() => setPrimaryTab('groups')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'groups'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Group Discoverability & Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('friends')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'friends'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Friends & Requests</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'notifications'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'requests'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>User Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-zinc-950 shadow-sm animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('managers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'managers'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Manager Access</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('messages')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'messages'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Send Message</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              primaryTab === 'system'
                ? 'bg-flame-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-card'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System & Diagnostics</span>
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
                  className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search Directory</span>
                </button>
              </form>

              <div className="flex items-center gap-2 pt-3 mt-3 border-t border-dark-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setUserFilterTab('all');
                    handleSearchUsers(searchQuery, 'all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    userFilterTab === 'all'
                      ? 'bg-flame-500 text-zinc-950 shadow-sm'
                      : 'bg-dark-surface hover:bg-dark-surface/80 text-zinc-400 hover:text-zinc-200 border border-dark-border'
                  }`}
                >
                  All Users
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserFilterTab('deleted');
                    handleSearchUsers(searchQuery, 'deleted');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    userFilterTab === 'deleted'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-dark-surface hover:bg-dark-surface/80 text-rose-400 hover:text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Deleted Accounts (Recovery Window)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportUsersCsv}
                  disabled={searchResults.length === 0}
                  className="ml-auto px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-xs font-bold text-zinc-300 hover:text-zinc-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Export Current Users View as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-flame-400" />
                  <span>Export Users CSV</span>
                </button>
              </div>
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
                          {u.isDeleted ? (
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                Deleted ({u.deletionDaysRemaining ?? 10}d left)
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRecoverUserAccount(u.id, u.username);
                                }}
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition-all cursor-pointer shadow-sm"
                                title="Recover this deleted user account"
                              >
                                Recover
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                u.isEmailVerified !== false
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {u.isEmailVerified !== false ? 'Verified' : 'Unverified'}
                            </span>
                          )}
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
                        <div className="relative group shrink-0">
                          <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 font-extrabold text-sm shrink-0 shadow-inner overflow-hidden">
                            {selectedUserDetails?.profileImage ? (
                              <img
                                src={selectedUserDetails.profileImage}
                                alt={selectedUserDetails.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              selectedUserDetails?.name
                                ? selectedUserDetails.name.slice(0, 2).toUpperCase()
                                : selectedUserDetails?.username?.slice(0, 2).toUpperCase() || 'U'
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileImageModalOpen(true);
                              setProfileImagePreview(selectedUserDetails?.profileImage || null);
                              setProfileImageInput(selectedUserDetails?.profileImage?.startsWith('http') ? selectedUserDetails.profileImage : '');
                              setProfileImageMode(selectedUserDetails?.profileImage ? 'UPLOAD' : 'UPLOAD');
                              setProfileImageReason(`Admin updated avatar for @${selectedUserDetails?.username}`);
                            }}
                            className="absolute -bottom-1 -right-1 p-1 bg-flame-500 hover:bg-flame-400 text-zinc-950 rounded-lg shadow-md transition-all scale-90 group-hover:scale-100"
                            title="Change or Remove Profile Picture"
                          >
                            <Camera className="w-3 h-3" />
                          </button>
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

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      {/* Save Button on Top */}
                      <button
                        type="button"
                        onClick={handleSaveAllAppliedChanges}
                        disabled={isSavingAllApplied || Object.keys(appliedChanges).length === 0}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                          Object.keys(appliedChanges).length > 0
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20 ring-2 ring-emerald-400/50 cursor-pointer animate-pulse'
                            : 'bg-dark-surface border border-dark-border text-zinc-500 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          Object.keys(appliedChanges).length > 0
                            ? `Save ${Object.keys(appliedChanges).length} applied change(s)`
                            : 'Modify and Apply changes below, then click Save'
                        }
                      >
                        {isSavingAllApplied ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Save{Object.keys(appliedChanges).length > 0 ? ` (${Object.keys(appliedChanges).length})` : ''}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileImageModalOpen(true);
                          setProfileImagePreview(selectedUserDetails?.profileImage || null);
                          setProfileImageInput(selectedUserDetails?.profileImage?.startsWith('http') ? selectedUserDetails.profileImage : '');
                          setProfileImageMode('UPLOAD');
                          setProfileImageReason(`Admin updated avatar for @${selectedUserDetails?.username}`);
                        }}
                        className="px-2.5 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 transition-colors"
                        title="Manage User Profile Picture"
                      >
                        <Camera className="w-3.5 h-3.5 text-flame-400" />
                        <span>Avatar</span>
                      </button>
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

                  {/* Applied Changes Staging Banner */}
                  {Object.keys(appliedChanges).length > 0 && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-extrabold">{Object.keys(appliedChanges).length} change(s) applied:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Object.values(appliedChanges).map((item) => (
                            <span key={item.id} className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 font-mono text-[11px]">
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedChanges({});
                            toast.info('Cleared all applied changes.');
                          }}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                          Clear All
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAllAppliedChanges}
                          disabled={isSavingAllApplied}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition-all"
                        >
                          Save All Now
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Account Deletion & Recovery Banner */}
                  {selectedUserDetails?.isDeleted && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-panel">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-rose-200">
                            Account Deleted ({selectedUserDetails.deletionDaysRemaining ?? 10} days remaining in recovery window)
                          </p>
                          <p className="text-[11px] text-zinc-300">
                            The user is locked out and cannot log in. You can recover this account to restore full login access with all data intact.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRecoverUserAccount(selectedUserDetails.id, selectedUserDetails.username)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 cursor-pointer self-start sm:self-auto"
                      >
                        Recover Account
                      </button>
                    </div>
                  )}

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
                <div className="flex flex-wrap items-center gap-2 border-b border-dark-border pb-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setUserTab('overview')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'overview'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('username_email')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'username_email'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Username & Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('streaks')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'streaks'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Streaks & Heatmap</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('points')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'points'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Points & Ledger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('reminders')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'reminders'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reminders & Schedules</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('limits')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'limits'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Limits & Quotas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('tasks_groups')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'tasks_groups'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Tasks & Groups</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('friends')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'friends'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Friends & Requests</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('notifications')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'notifications'
                        ? 'bg-dark-surface text-flame-400 border border-flame-500/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface/50'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Notifications Hub</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('danger')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      userTab === 'danger'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/5'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Danger Zone</span>
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
                        <div className="flex items-center justify-between py-1.5 border-b border-dark-border">
                          <span className="text-zinc-400">Profile Picture</span>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 font-bold text-[10px] overflow-hidden">
                              {selectedUserDetails?.profileImage ? (
                                <img src={selectedUserDetails.profileImage} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                selectedUserDetails?.username?.slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <span className="text-zinc-300 font-medium">
                              {selectedUserDetails?.profileImage ? 'Custom Photo' : 'System Default'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileImageModalOpen(true);
                                setProfileImagePreview(selectedUserDetails?.profileImage || null);
                                setProfileImageInput(selectedUserDetails?.profileImage?.startsWith('http') ? selectedUserDetails.profileImage : '');
                                setProfileImageMode(selectedUserDetails?.profileImage ? 'UPLOAD' : 'UPLOAD');
                                setProfileImageReason(`Admin updated avatar for @${selectedUserDetails?.username}`);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-flame-500/10 border border-flame-500/30 text-flame-400 hover:bg-flame-500/20 font-bold"
                            >
                              Edit / Remove
                            </button>
                          </div>
                        </div>
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
                                {selectedUserDetails?.tasks?.map((t: any) => {
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.isGroupTask ? `[Group: ${t.group?.name || 'Group'}] ` : '[Personal] '}
                                      {t.title} (Current: {t.currentStreak}d, Best: {t.longestStreak}d)
                                    </option>
                                  );
                                })}
                              </select>
                              {selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)?.isGroupTask && (
                                <p className="text-[10px] text-amber-400 mt-1">
                                  ✓ Member-Isolated: Modifying this group task alters only this member's streak.
                                  Other members retain independent completion histories.
                                </p>
                              )}
                              {isLinkedInName(
                                selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)?.title ||
                                selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)?.group?.name
                              ) && (
                                <p className="text-[10px] text-amber-300 mt-1 font-semibold flex items-center gap-1">
                                  <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                                  <span>LinkedIn Group Task: 8 individual games (Pinpoint, Crossclimb, Queens, etc.) are managed independently in the dedicated panel below.</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dark-border">
                                <input
                                  type="checkbox"
                                  id="streakApplyToOverall"
                                  checked={streakApplyToOverall}
                                  onChange={(e) => setStreakApplyToOverall(e.target.checked)}
                                  className="w-4 h-4 rounded border-dark-border bg-dark-surface text-flame-500 focus:ring-flame-500 cursor-pointer"
                                />
                                <label htmlFor="streakApplyToOverall" className="text-xs text-zinc-300 font-semibold cursor-pointer select-none">
                                  Affect Overall Streak (also reflect changes to user's overall streak & best streak)
                                </label>
                              </div>
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
                        <div className="p-3 bg-dark-surface rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-zinc-400">Before / After Preview:</span>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-zinc-400">
                              Current:{' '}
                              <strong className="text-zinc-200">
                                {streakTargetType === 'OVERALL'
                                  ? selectedUserDetails?.currentStreak || 0
                                  : selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)
                                      ?.currentStreak || 0}d
                              </strong>
                              {' → '}
                              <span className="text-flame-400 font-bold">{newCurrentStreak}d</span>
                            </span>
                            <span className="text-zinc-500">|</span>
                            <span className="text-zinc-400">
                              Longest:{' '}
                              <strong className="text-zinc-200">
                                {streakTargetType === 'OVERALL'
                                  ? selectedUserDetails?.longestStreak || 0
                                  : selectedUserDetails?.tasks?.find((x: any) => x.id === selectedTaskId)
                                      ?.longestStreak || 0}d
                              </strong>
                              {' → '}
                              <span className="text-amber-400 font-bold">{newLongestStreak}d</span>
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

                        {(() => {
                          const currentStreakChangeKey = streakTargetType === 'OVERALL' ? 'streak_overall' : `streak_task_${selectedTaskId}`;
                          const isStaged = !!appliedChanges[currentStreakChangeKey];
                          return (
                            <>
                              {isStaged && (
                                <div className="p-3 bg-flame-500/10 border border-flame-500/30 rounded-xl flex items-center justify-between text-xs text-flame-300">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-flame-400 shrink-0" />
                                    <span className="font-bold truncate">Applied: {appliedChanges[currentStreakChangeKey].label}</span>
                                    <span className="text-[11px] text-zinc-400 shrink-0">(Click "Save" on top to commit)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAppliedChanges((prev) => {
                                        const next = { ...prev };
                                        delete next[currentStreakChangeKey];
                                        return next;
                                      });
                                      toast.info('Streak correction unapplied.');
                                    }}
                                    className="text-zinc-400 hover:text-zinc-200 underline text-[11px] shrink-0 ml-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}

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
                                <span>{isStaged ? 'Re-apply Streak' : 'Apply'}</span>
                              </button>
                            </>
                          );
                        })()}
                      </form>
                    </div>

                    {/* Freeze Shield Balance & Shelf Recharge Engine */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <Snowflake className="w-4 h-4 text-sky-400" />
                          <span>Freeze Inventory, Capacity & Recharge Engine</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold">
                          SCOPE ISOLATED • APPROVED CAPACITIES 1-7
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Default capacity is strictly 1 shield per scope. Once full, recharge stops at 7/7. Super Admin can approve increased capacity (e.g. 2 shields), grant or correct shields, calibrate recharge progress, or apply date-specific administrative freezes.
                      </p>

                      {/* Scope Selector */}
                      <div className="bg-dark-surface p-3.5 rounded-xl border border-dark-border space-y-1">
                        <label className="block text-xs font-semibold text-zinc-300">
                          Target Freeze Scope (Separation Enforced)
                        </label>
                        <select
                          value={freezeScope}
                          onChange={(e) => handleFreezeScopeChange(e.target.value)}
                          className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
                        >
                          <option value="overall">
                            Overall Streak Scope (Current Capacity: {selectedUserDetails?.overallFreezeCapacity || 1}, Shields: {selectedUserDetails?.overallFreezeBalance || 0}/{selectedUserDetails?.overallFreezeCapacity || 1})
                          </option>
                          {selectedUserDetails?.tasks
                            ?.filter((t: any) => !isLinkedInName(t.title) && !isLinkedInName(t.group?.name))
                            .map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.isGroupTask ? `[Group Task: ${t.group?.name || 'Group'}] ` : '[Personal Task] '}
                                {t.title} (Cap: {t.freezeCapacity || 1}, Shields: {t.freezeBalance || 0}/{t.freezeCapacity || 1}, Recharge: {t.freezeRechargeDays || 0}/7d)
                              </option>
                            ))}
                        </select>
                        {freezeScope !== 'overall' && selectedUserDetails?.tasks?.find((t: any) => t.id === freezeScope)?.isGroupTask && (
                          <p className="text-[10px] text-amber-400 pt-1">
                            ✓ Scope Isolated: Modifying this group task freeze inventory affects only this selected member.
                          </p>
                        )}
                      </div>

                      {/* Prominent Current Status Card for Selected Scope */}
                      {(() => {
                        const targetTask = freezeScope !== 'overall' ? selectedUserDetails?.tasks?.find((t: any) => t.id === freezeScope) : null;
                        const currentCap = freezeScope === 'overall' ? (selectedUserDetails?.overallFreezeCapacity || 1) : (targetTask?.freezeCapacity || 1);
                        const currentBal = freezeScope === 'overall' ? (selectedUserDetails?.overallFreezeBalance || 0) : (targetTask?.freezeBalance || 0);
                        const currentRec = freezeScope === 'overall' ? (selectedUserDetails?.overallFreezeRechargeDays || 0) : (targetTask?.freezeRechargeDays || 0);

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-dark-surface border border-dark-border rounded-xl">
                            {/* Capacity */}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                  Approved Capacity
                                </span>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-2xl font-black text-purple-400 font-mono">
                                    {currentCap}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-400">
                                    {currentCap === 1 ? 'Shield (Default)' : 'Shields (Approved)'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Freeze Shields */}
                            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-dark-border/80 pt-3 sm:pt-0 sm:pl-4">
                              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                                <Snowflake className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                  Current Inventory
                                </span>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-2xl font-black text-sky-400 font-mono">
                                    {currentBal}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-400">/ {currentCap} Shields</span>
                                </div>
                              </div>
                            </div>

                            {/* Shelf Recharge Progress */}
                            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-dark-border/80 pt-3 sm:pt-0 sm:pl-4">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                <Clock className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                  Recharge Progress
                                </span>
                                <div className="flex items-baseline gap-1.5 mb-1.5">
                                  <span className="text-2xl font-black text-amber-400 font-mono">
                                    {currentRec}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-400">/ 7 Days {currentBal >= currentCap ? '(Capped)' : ''}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[0, 1, 2, 3, 4, 5, 6].map((pip) => (
                                    <div
                                      key={pip}
                                      className={`h-1.5 flex-1 rounded-full ${
                                        pip < currentRec
                                          ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                          : 'bg-dark-card border border-dark-border'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <form onSubmit={handleUpdateFreezeControl} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Permitted Max Capacity */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Permitted Max Capacity (1 - 7)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="7"
                              value={newFreezeCapacity}
                              onChange={(e) =>
                                setNewFreezeCapacity(Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1)))
                              }
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                              required
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              {[1, 2, 3, 5, 7].map((cap) => (
                                <button
                                  key={cap}
                                  type="button"
                                  onClick={() => setNewFreezeCapacity(cap)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                                    newFreezeCapacity === cap
                                      ? 'bg-purple-500 text-zinc-950 shadow-sm'
                                      : 'bg-dark-surface hover:bg-dark-border text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {cap} {cap === 1 ? 'def' : 'cap'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Set Freeze Balance */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Shield Balance (0 - {newFreezeCapacity})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={newFreezeCapacity}
                              value={newFreezeBalance}
                              onChange={(e) =>
                                setNewFreezeBalance(Math.max(0, Math.min(newFreezeCapacity, parseInt(e.target.value, 10) || 0)))
                              }
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
                              required
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              {[0, 1, 2, 3, 5, 7].filter((num) => num <= newFreezeCapacity).map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setNewFreezeBalance(num)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                                    newFreezeBalance === num
                                      ? 'bg-sky-500 text-zinc-950 shadow-sm'
                                      : 'bg-dark-surface hover:bg-dark-border text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Set Recharge Days */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Recharge Days (0 - 7 days)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="7"
                              value={newFreezeRechargeDays}
                              onChange={(e) =>
                                setNewFreezeRechargeDays(
                                  Math.max(0, Math.min(7, parseInt(e.target.value, 10) || 0))
                                )
                              }
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                              required
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              {[0, 3, 5, 6, 7].map((days) => (
                                <button
                                  key={days}
                                  type="button"
                                  onClick={() => setNewFreezeRechargeDays(days)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                                    newFreezeRechargeDays === days
                                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                                      : 'bg-dark-surface hover:bg-dark-border text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {days}/7d
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={freezeControlReason}
                            onChange={(e) => setFreezeControlReason(e.target.value)}
                            placeholder="e.g. Approved 2-shield capacity upgrade per streak milestone support ticket"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        {(() => {
                          const currentFreezeChangeKey = freezeScope === 'overall' ? 'freeze_overall' : `freeze_task_${freezeScope}`;
                          const isStaged = !!appliedChanges[currentFreezeChangeKey];
                          return (
                            <>
                              {isStaged && (
                                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center justify-between text-xs text-sky-300">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span className="font-bold truncate">Applied: {appliedChanges[currentFreezeChangeKey].label}</span>
                                    <span className="text-[11px] text-zinc-400 shrink-0">(Click "Save" on top to commit)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAppliedChanges((prev) => {
                                        const next = { ...prev };
                                        delete next[currentFreezeChangeKey];
                                        return next;
                                      });
                                      toast.info('Freeze adjustment unapplied.');
                                    }}
                                    className="text-zinc-400 hover:text-zinc-200 underline text-[11px] shrink-0 ml-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}

                              <button
                                type="submit"
                                disabled={isSubmittingFreezeControl}
                                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                              >
                                {isSubmittingFreezeControl ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span>{isStaged ? 'Re-apply Freezes' : 'Apply'}</span>
                              </button>
                            </>
                          );
                        })()}
                      </form>
                    </div>

                    {/* LinkedIn Group Games Super Admin Panel */}
                    {linkedInGroup && (
                      <div className="bg-dark-card border border-amber-500/30 rounded-2xl p-5 shadow-panel space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-dark-border">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                <Gamepad2 className="w-4 h-4" />
                              </div>
                              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                                <span>LinkedIn Group: 8 Independent Game Streaks</span>
                              </h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                                {linkedInGroup.name}
                              </span>
                            </div>
                            <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                              Each game (Pinpoint, Crossclimb, Queens, Tango, Zip, Mini Sudoku, Patches, Wend) maintains its own independent streak, freeze, and completion history. Any correction here modifies only @{selectedUserDetails?.username} for the selected game.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => selectedUserId && linkedInGroup?.id && loadAdminLinkedInGames(selectedUserId, linkedInGroup.id)}
                            disabled={isLoadingAdminLinkedInGames}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 text-xs font-semibold rounded-xl transition-colors shrink-0"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminLinkedInGames ? 'animate-spin text-amber-400' : ''}`} />
                            <span>Refresh Games</span>
                          </button>
                        </div>

                        {/* 8-Game Navigation Pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {LINKEDIN_GAMES_LIST.map((game) => {
                            const isSelected = selectedAdminGameId === game.id;
                            const record = adminLinkedInGames.find((g) => g.id === game.id || g.gameId === game.id);
                            const isCommitted = record?.isCommitted !== false;
                            const hasStagedForGame = Object.keys(appliedChanges).some(
                              (k) =>
                                k === `linkedin_streak_${game.id}` ||
                                k === `linkedin_commitment_${game.id}` ||
                                k.startsWith(`linkedin_grant_${game.id}_`)
                            );
                            return (
                              <button
                                key={game.id}
                                type="button"
                                onClick={() => setSelectedAdminGameId(game.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                  isSelected
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                                    : 'bg-dark-surface/60 border-dark-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs truncate">{game.name}</span>
                                  <div className="flex items-center gap-1">
                                    {hasStagedForGame && (
                                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500 text-zinc-950 font-mono">
                                        Applied
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                      isSelected ? 'bg-amber-500/30 text-amber-200' : 'bg-dark-card text-zinc-500'
                                    }`}>
                                      🔥 {record?.currentStreak ?? 0}d
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-dark-muted">
                                  <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                    isCommitted
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : 'text-zinc-500 bg-zinc-800'
                                  }`}>
                                    {isCommitted ? '✓ Committed' : 'off Uncommitted'}
                                  </span>
                                  <span>{record?.completedToday || record?.todayCompleted ? 'Done' : 'Pending'}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected Game Dashboard Stats */}
                        {(() => {
                          const activeGame = LINKEDIN_GAMES_LIST.find((g) => g.id === selectedAdminGameId);
                          const activeRecord = adminLinkedInGames.find((g) => g.id === selectedAdminGameId || g.gameId === selectedAdminGameId);
                          const isCommitted = activeRecord?.isCommitted !== false;
                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 bg-dark-surface rounded-xl border border-dark-border">
                                  <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                    Current Streak
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xl font-black text-amber-400">
                                    <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                                    <span>{activeRecord?.currentStreak ?? 0}d</span>
                                  </div>
                                </div>

                                <div className="p-3 bg-dark-surface rounded-xl border border-dark-border">
                                  <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                    Longest Streak
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xl font-black text-zinc-200">
                                    <Trophy className="w-5 h-5 text-amber-400" />
                                    <span>{activeRecord?.longestStreak ?? 0}d</span>
                                  </div>
                                </div>

                                <div className="p-3 bg-dark-surface rounded-xl border border-dark-border">
                                  <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                    Commitment
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 text-sm font-bold">
                                    {isCommitted ? (
                                      <span className="text-emerald-400 flex items-center gap-1 font-mono text-xs">
                                        <CheckCircle2 className="w-4 h-4" /> Committed
                                      </span>
                                    ) : (
                                      <span className="text-zinc-500 flex items-center gap-1 font-mono text-xs">
                                        <Clock className="w-4 h-4" /> Uncommitted
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3 bg-dark-surface rounded-xl border border-dark-border">
                                  <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">
                                    Today's Status
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 text-sm font-bold">
                                    {activeRecord?.completedToday || activeRecord?.todayCompleted ? (
                                      <span className="text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" /> Completed
                                      </span>
                                    ) : (
                                      <span className="text-zinc-500 flex items-center gap-1">
                                        <Clock className="w-4 h-4" /> Not Completed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Game Management Actions Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Form A: Commitment Control */}
                                <div className="p-4 bg-dark-surface rounded-xl border border-dark-border space-y-3 flex flex-col justify-between">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                                      <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>Commitment</span>
                                      </span>
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isCommitted
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-zinc-800 text-zinc-400'
                                      }`}>
                                        {isCommitted ? 'COMMITTED' : 'UNCOMMITTED'}
                                      </span>
                                    </h4>
                                    <p className="text-[11px] text-zinc-400">
                                      Include/exclude {activeGame?.name} in dashboard tick. Preserves history & streaks.
                                    </p>

                                    <div>
                                      <input
                                        type="text"
                                        value={adminGameCommitmentReason}
                                        onChange={(e) => setAdminGameCommitmentReason(e.target.value)}
                                        placeholder="Admin reason..."
                                        className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100"
                                      />
                                    </div>

                                    {renderNotificationOptions()}

                                    {appliedChanges[`linkedin_commitment_${selectedAdminGameId}`] && (
                                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          <span className="font-semibold text-[11px] truncate">
                                            Applied: {appliedChanges[`linkedin_commitment_${selectedAdminGameId}`].label}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAppliedChanges((prev) => {
                                              const next = { ...prev };
                                              delete next[`linkedin_commitment_${selectedAdminGameId}`];
                                              return next;
                                            });
                                            toast.info('Commitment change unapplied.');
                                          }}
                                          className="text-zinc-400 hover:text-zinc-200 underline text-[10px] shrink-0 ml-2"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleAdminSetGameCommitment(selectedAdminGameId, !isCommitted)}
                                    disabled={isSubmittingAdminGameCommitment}
                                    className={`w-full py-2 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-2 ${
                                      isCommitted
                                        ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-sm'
                                    }`}
                                  >
                                    {isSubmittingAdminGameCommitment ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : isCommitted ? (
                                      <>
                                        <X className="w-3.5 h-3.5" />
                                        <span>{appliedChanges[`linkedin_commitment_${selectedAdminGameId}`] ? `Re-apply Uncommit ${activeGame?.name}` : `Uncommit ${activeGame?.name}`}</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>{appliedChanges[`linkedin_commitment_${selectedAdminGameId}`] ? `Re-apply Commit ${activeGame?.name}` : `Commit ${activeGame?.name}`}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {/* Form A: Streak Value Correction */}
                                <div className="p-4 bg-dark-surface rounded-xl border border-dark-border space-y-3">
                                  <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                                    <Flame className="w-4 h-4 text-amber-400" />
                                    <span>Correct Streak Values</span>
                                  </h4>
                                  <p className="text-[11px] text-zinc-400">
                                    Modify active and longest streak for {activeGame?.name}.
                                  </p>

                                  <form onSubmit={handleAdminCorrectGameStreak} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] text-zinc-400 block mb-1">Current (days)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={adminGameCurrentStreak}
                                          onChange={(e) => setAdminGameCurrentStreak(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                          className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100 font-mono"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-zinc-400 block mb-1">Best (days)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={adminGameLongestStreak}
                                          onChange={(e) => setAdminGameLongestStreak(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                          className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100 font-mono"
                                          required
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <input
                                        type="text"
                                        value={adminGameStreakReason}
                                        onChange={(e) => setAdminGameStreakReason(e.target.value)}
                                        placeholder="Admin reason for correction..."
                                        className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100"
                                        required
                                      />
                                    </div>

                                    <div className="flex items-center gap-2 pt-1 pb-1">
                                      <input
                                        type="checkbox"
                                        id="adminGameApplyToOverall"
                                        checked={adminGameApplyToOverall}
                                        onChange={(e) => setAdminGameApplyToOverall(e.target.checked)}
                                        className="w-4 h-4 rounded border-dark-border bg-dark-card text-amber-500 focus:ring-amber-500 cursor-pointer"
                                      />
                                      <label htmlFor="adminGameApplyToOverall" className="text-xs text-zinc-300 font-medium cursor-pointer select-none">
                                        Affect Overall Streak (also update user's overall streak)
                                      </label>
                                    </div>

                                    {renderNotificationOptions()}

                                    {appliedChanges[`linkedin_streak_${selectedAdminGameId}`] && (
                                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-300">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                          <span className="font-semibold text-[11px] truncate">
                                            Applied: {appliedChanges[`linkedin_streak_${selectedAdminGameId}`].label}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAppliedChanges((prev) => {
                                              const next = { ...prev };
                                              delete next[`linkedin_streak_${selectedAdminGameId}`];
                                              return next;
                                            });
                                            toast.info('Streak change unapplied.');
                                          }}
                                          className="text-zinc-400 hover:text-zinc-200 underline text-[10px] shrink-0 ml-2"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}

                                    <button
                                      type="submit"
                                      disabled={isSubmittingAdminGameStreak}
                                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      {isSubmittingAdminGameStreak ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                      <span>{appliedChanges[`linkedin_streak_${selectedAdminGameId}`] ? 'Re-apply Streak Change' : 'Apply Streak Change'}</span>
                                    </button>
                                  </form>
                                </div>

                                {/* Form B: Historical Grant Date */}
                                <div className="p-4 bg-dark-surface rounded-xl border border-dark-border space-y-3">
                                  <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-emerald-400" />
                                    <span>Grant / Complete Date</span>
                                  </h4>
                                  <p className="text-[11px] text-zinc-400">
                                    Retroactively record completion for {activeGame?.name}.
                                  </p>

                                  <form onSubmit={handleAdminGrantGameDate} className="space-y-3">
                                    <div>
                                      <label className="text-[10px] text-zinc-400 block mb-1">Completion Date</label>
                                      <input
                                        type="date"
                                        value={adminGameGrantDate}
                                        onChange={(e) => setAdminGameGrantDate(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100 font-mono"
                                        required
                                      />
                                    </div>

                                    <div>
                                      <input
                                        type="text"
                                        value={adminGameGrantNote}
                                        onChange={(e) => setAdminGameGrantNote(e.target.value)}
                                        placeholder="Optional study / play note..."
                                        className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100"
                                      />
                                    </div>

                                    <div>
                                      <input
                                        type="text"
                                        value={adminGameGrantReason}
                                        onChange={(e) => setAdminGameGrantReason(e.target.value)}
                                        placeholder="Admin reason..."
                                        className="w-full px-2.5 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-zinc-100"
                                        required
                                      />
                                    </div>

                                    <div className="flex items-center gap-2 pt-1 pb-1">
                                      <input
                                        type="checkbox"
                                        id="adminGameGrantApplyToOverall"
                                        checked={adminGameGrantApplyToOverall}
                                        onChange={(e) => setAdminGameGrantApplyToOverall(e.target.checked)}
                                        className="w-4 h-4 rounded border-dark-border bg-dark-card text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <label htmlFor="adminGameGrantApplyToOverall" className="text-xs text-zinc-300 font-medium cursor-pointer select-none">
                                        Affect Overall Streak (also credit overall streak for this date)
                                      </label>
                                    </div>

                                    {renderNotificationOptions()}

                                    {appliedChanges[`linkedin_grant_${selectedAdminGameId}_${adminGameGrantDate}`] && (
                                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          <span className="font-semibold text-[11px] truncate">
                                            Applied: {appliedChanges[`linkedin_grant_${selectedAdminGameId}_${adminGameGrantDate}`].label}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAppliedChanges((prev) => {
                                              const next = { ...prev };
                                              delete next[`linkedin_grant_${selectedAdminGameId}_${adminGameGrantDate}`];
                                              return next;
                                            });
                                            toast.info('Grant date unapplied.');
                                          }}
                                          className="text-zinc-400 hover:text-zinc-200 underline text-[10px] shrink-0 ml-2"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}

                                    <button
                                      type="submit"
                                      disabled={isSubmittingAdminGameGrant}
                                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      {isSubmittingAdminGameGrant ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                      <span>{appliedChanges[`linkedin_grant_${selectedAdminGameId}_${adminGameGrantDate}`] ? 'Re-apply Grant Date' : 'Apply Grant Date'}</span>
                                    </button>
                                  </form>
                                </div>
                              </div>

                              {/* Recent Game Completions Table */}
                              <div className="p-4 bg-dark-surface rounded-xl border border-dark-border space-y-2">
                                <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                                  <span>Recent Completion History: {activeGame?.name}</span>
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {(activeRecord?.completionsHistory || activeRecord?.completions)?.length || 0} total records
                                  </span>
                                </h4>

                                {(!activeRecord?.completionsHistory && !activeRecord?.completions || (activeRecord?.completionsHistory || activeRecord?.completions).length === 0) ? (
                                  <p className="text-xs text-zinc-500 italic py-2">No completions recorded yet for this game.</p>
                                ) : (
                                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-dark-border text-zinc-400 text-[11px]">
                                          <th className="py-1.5 px-2">Date</th>
                                          <th className="py-1.5 px-2">Status</th>
                                          <th className="py-1.5 px-2">Note</th>
                                          <th className="py-1.5 px-2">Recorded At</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-dark-border">
                                        {(activeRecord.completionsHistory || activeRecord.completions).slice(0, 15).map((c: any, idx: number) => (
                                          <tr key={idx} className="text-zinc-300 hover:bg-dark-card/50">
                                            <td className="py-1.5 px-2 font-mono text-amber-300 font-bold">{c.completionDate || c.date}</td>
                                            <td className="py-1.5 px-2">
                                              {c.isFrozen ? (
                                                <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold">Frozen</span>
                                              ) : (
                                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">Completed</span>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-2 text-zinc-400 italic truncate max-w-xs">{c.studyNote || '—'}</td>
                                            <td className="py-1.5 px-2 text-zinc-500 text-[10px]">
                                              {c.completedAt ? new Date(c.completedAt).toLocaleString() : '—'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
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
                              (selectedUserDetails?.points || 0) + (typeof pointsDelta === 'number' ? pointsDelta : 0) >= 0
                                ? 'text-zinc-100'
                                : 'text-rose-400'
                            }`}
                          >
                            {Math.max(0, (selectedUserDetails?.points || 0) + (typeof pointsDelta === 'number' ? pointsDelta : 0)).toLocaleString()} pts
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
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setPointsDelta('');
                              } else {
                                const parsed = parseInt(val, 10);
                                setPointsDelta(isNaN(parsed) ? '' : parsed);
                              }
                            }}
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
                              {Math.max(0, (selectedUserDetails?.points || 0) + (typeof pointsDelta === 'number' ? pointsDelta : 0))} pts
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

                        {appliedChanges['points'] && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                              <span className="font-bold">Applied: {appliedChanges['points'].label}</span>
                              <span className="text-[11px] text-zinc-400">(Click "Save" on top to commit)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAppliedChanges((prev) => {
                                  const next = { ...prev };
                                  delete next['points'];
                                  return next;
                                });
                                toast.info('Points adjustment unapplied.');
                              }}
                              className="text-zinc-400 hover:text-zinc-200 underline text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmittingPoints || pointsDelta === '' || pointsDelta === 0}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingPoints ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>{appliedChanges['points'] ? 'Re-apply Points' : 'Apply'}</span>
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

                    {/* Milestone Badges & Reset Controls */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span>Milestone Events & Achievement Celebrations</span>
                          </h4>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Resetting milestone event records allows the user to re-trigger celebratory milestones and badges (e.g. 7, 30, 100 days) upon completing tasks.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            openPinPrompt(
                              'Reset Milestone Events',
                              `Wipe milestone event records for @${selectedUserDetails?.username}? This allows milestone notifications and badges to be re-earned.`,
                              async (pin) => {
                                const res = await adminResetUserMilestones(selectedUserDetails.id, {
                                  reason: `Admin reset milestone events for @${selectedUserDetails.username}`,
                                  sensitivePin: pin,
                                });
                                if (res.success) {
                                  toast.success(res.message);
                                }
                              }
                            );
                          }}
                          className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reset Milestones</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB: REMINDERS & SCHEDULES */}
                {userTab === 'reminders' && (
                  <div className="space-y-6">
                    {/* Header Card */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                              Authoritative Reminder Scheduling & Execution Engine
                            </h3>
                            <p className="text-xs text-zinc-400">
                              Admin Panel controls overall daily alerts and up to 2 independently configurable reminder times per personal or group task.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleTriggerManualReminderCheck}
                          disabled={isRunningManualCheck}
                          className="px-3.5 py-2 bg-dark-surface hover:bg-dark-border text-flame-400 border border-flame-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
                          title="Trigger immediate scheduler pass and review diagnostic logs"
                        >
                          {isRunningManualCheck ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>Trigger Manual Reminder Check</span>
                        </button>
                      </div>

                      {/* Diagnostic Logs Output if present */}
                      {manualCheckLogs && (
                        <div className="mt-3 p-3 bg-dark-surface/80 border border-dark-border rounded-xl text-xs space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-zinc-300 font-bold">
                            <span>Scheduler Diagnostic Run Results:</span>
                            <span className="text-emerald-400">Status: {manualCheckLogs.status}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-400 text-[11px] pt-1">
                            <div>Overall Checked: <strong className="text-zinc-200">{manualCheckLogs.overallSchedulesChecked}</strong></div>
                            <div>Overall Sent: <strong className="text-zinc-200">{manualCheckLogs.overallRemindersSent}</strong></div>
                            <div>Tasks Checked: <strong className="text-zinc-200">{manualCheckLogs.tasksChecked}</strong></div>
                            <div>Task Reminders Sent: <strong className="text-zinc-200">{manualCheckLogs.taskRemindersSent}</strong></div>
                          </div>
                          {manualCheckLogs.errors && manualCheckLogs.errors.length > 0 && (
                            <div className="text-rose-400 text-[11px] pt-1">
                              Errors: {manualCheckLogs.errors.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section 1: Overall Reminders */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-400" />
                          <span>Overall Daily Reminder Configuration</span>
                        </h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                          overallReminderEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                        }`}>
                          {overallReminderEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>

                      <form onSubmit={handleSaveOverallReminders} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Toggle Active */}
                          <div className="flex flex-col justify-center">
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Reminder State
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                              <input
                                type="checkbox"
                                checked={overallReminderEnabled}
                                onChange={(e) => setOverallReminderEnabled(e.target.checked)}
                                className="w-4 h-4 rounded text-flame-500 focus:ring-0 bg-dark-surface border-dark-border"
                              />
                              <span className="text-xs text-zinc-200 font-medium">
                                {overallReminderEnabled ? 'Active (Will trigger daily)' : 'Disabled'}
                              </span>
                            </label>
                          </div>

                          {/* Timezone */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              User Timezone
                            </label>
                            <input
                              type="text"
                              value={overallReminderTimezone}
                              onChange={(e) => setOverallReminderTimezone(e.target.value)}
                              placeholder="e.g. Asia/Kolkata or UTC"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-sky-500 font-mono"
                              required
                            />
                          </div>
                        </div>

                        {/* Configured Overall Reminder Times & Add Time */}
                        <div className="p-3.5 bg-dark-surface rounded-xl border border-dark-border space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-zinc-300">
                              Configured Overall Reminder Times
                            </label>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold">
                              {overallReminderTimes.length} / {userReminderSettings?.quotaLimit || selectedUserDetails?.reminderLimit || 3} Slots Used
                            </span>
                          </div>

                          {/* Existing Time Pills */}
                          {overallReminderTimes.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">No overall reminder times configured yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {overallReminderTimes.map((time) => (
                                <div
                                  key={time}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-sky-500/30 rounded-xl text-xs font-mono text-sky-300 shadow-sm"
                                >
                                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                                  <span className="font-bold">{time}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOverallReminder(time)}
                                    title="Remove this reminder time"
                                    className="p-0.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add New Time Input */}
                          {overallReminderTimes.length < (userReminderSettings?.quotaLimit || selectedUserDetails?.reminderLimit || 3) ? (
                            <div className="pt-2 border-t border-dark-border/60">
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                                Add Notification Time (HH:mm)
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={newOverallReminderTime}
                                  onChange={(e) => setNewOverallReminderTime(e.target.value)}
                                  className="px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddOverallReminder}
                                  className="px-3.5 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Time</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-dark-card/50 rounded-lg border border-dark-border/60 text-[11px] text-zinc-400">
                              Overall reminder limit reached ({userReminderSettings?.quotaLimit || selectedUserDetails?.reminderLimit || 3} max). Increase the user's quota limit above to allow more times.
                            </div>
                          )}
                        </div>

                        {/* Active Days */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Supported Active Days
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => {
                              const isSelected = overallReminderDays.includes(idx);
                              return (
                                <button
                                  key={dayName}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      if (overallReminderDays.length > 1) {
                                        setOverallReminderDays(overallReminderDays.filter((d) => d !== idx));
                                      }
                                    } else {
                                      setOverallReminderDays([...overallReminderDays, idx].sort());
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    isSelected
                                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                                      : 'bg-dark-surface text-zinc-400 border border-dark-border hover:bg-dark-border/40'
                                  }`}
                                >
                                  {dayName}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Next Scheduled Occurrence Banner */}
                        {userReminderSettings?.overall?.schedules?.[0]?.nextOccurrence?.nextDisplay && (
                          <div className="p-3 bg-dark-surface/60 rounded-xl border border-dark-border flex items-center justify-between text-xs">
                            <span className="text-zinc-400">Next Scheduled Occurrence:</span>
                            <span className="font-mono text-sky-400 font-bold">
                              {userReminderSettings.overall.schedules[0].nextOccurrence.nextDisplay} ({userReminderSettings.overall.schedules[0].nextOccurrence.relativeDisplay})
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            type="submit"
                            disabled={isSavingOverallReminders}
                            className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isSavingOverallReminders ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>Save Overall Reminder Settings</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendTestReminder('OVERALL')}
                            disabled={isSendingTestReminder}
                            className="px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                            title="Send an immediate test reminder to the user's In-App and Email inbox"
                          >
                            {isSendingTestReminder ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                            ) : (
                              <Bell className="w-4 h-4 text-sky-400" />
                            )}
                            <span>Send Test Reminder</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Section 2: Task Reminders (2 independently configurable times per task) */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <span>
                              Personal & Group Task Reminders (Max {userReminderSettings?.taskQuotaLimit || selectedUserDetails?.taskReminderLimit || 1} Per Task)
                            </span>
                          </h4>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Each task supports up to {userReminderSettings?.taskQuotaLimit || selectedUserDetails?.taskReminderLimit || 1} independently configurable reminder schedule(s). Changes persist directly into the database and scheduler.
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                          {selectedUserDetails?.tasks?.length || 0} TASKS
                        </span>
                      </div>

                      {isLoadingReminders ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
                          <RefreshCw className="w-4 h-4 animate-spin text-flame-400" />
                          <span>Loading reminder schedules...</span>
                        </div>
                      ) : !selectedUserDetails?.tasks || selectedUserDetails.tasks.length === 0 ? (
                        <p className="text-xs text-zinc-500 py-4">No tasks found for this user.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedUserDetails.tasks.map((task: any) => {
                            const taskState = taskRemindersState[task.id] || {
                              reminderTimes: task.reminderTimes && task.reminderTimes.length > 0 ? task.reminderTimes : [],
                              isReminderActive: task.isReminderActive ?? true,
                            };
                            const times = taskState.reminderTimes || [];

                            return (
                              <div
                                key={task.id}
                                className="p-4 bg-dark-surface border border-dark-border rounded-xl space-y-3 hover:border-dark-border/80 transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-zinc-100">{task.title}</span>
                                    {task.isGroupTask ? (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                        Group: {task.group?.name || 'Group Task'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                        Personal Task
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300 font-medium">
                                      <input
                                        type="checkbox"
                                        checked={taskState.isReminderActive}
                                        onChange={(e) => {
                                          setTaskRemindersState({
                                            ...taskRemindersState,
                                            [task.id]: {
                                              ...taskState,
                                              isReminderActive: e.target.checked,
                                            },
                                          });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-flame-500 focus:ring-0 bg-dark-card border-dark-border"
                                      />
                                      <span>Reminders Active</span>
                                    </label>
                                  </div>
                                </div>

                                {/* Configured Times & Add Time */}
                                <div className="p-3 bg-dark-card rounded-xl border border-dark-border space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                                      <span>Configured Reminder Times for this Task</span>
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold">
                                      {times.length} / {task.maxAllowed || userReminderSettings?.taskQuotaLimit || selectedUserDetails?.taskReminderLimit || 1} Times
                                    </span>
                                  </div>

                                  {times.length === 0 ? (
                                    <p className="text-xs text-zinc-500 italic">No reminder times configured for this task.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {times.map((time: string) => (
                                        <div
                                          key={time}
                                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-surface border border-purple-500/30 rounded-xl text-xs font-mono text-purple-300 shadow-sm"
                                        >
                                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                                          <span className="font-bold">{time}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveTaskReminderTime(task.id, time)}
                                            title="Remove this reminder time"
                                            className="p-0.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {times.length < (task.maxAllowed || userReminderSettings?.taskQuotaLimit || selectedUserDetails?.taskReminderLimit || 1) ? (
                                    <div className="pt-2 border-t border-dark-border/60">
                                      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                                        Add Notification Time (HH:mm)
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="time"
                                          value={newTaskReminderTime[task.id] || '09:00'}
                                          onChange={(e) =>
                                            setNewTaskReminderTime({
                                              ...newTaskReminderTime,
                                              [task.id]: e.target.value,
                                            })
                                          }
                                          className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-purple-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleAddTaskReminderTime(task.id)}
                                          className="px-3.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Add Time</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-2 bg-dark-surface/50 rounded-lg border border-dark-border/60 text-[11px] text-zinc-400">
                                      Task reminder limit reached ({task.maxAllowed || userReminderSettings?.taskQuotaLimit || selectedUserDetails?.taskReminderLimit || 1} max). Increase the user's per-task quota in the Limits tab to allow more times.
                                    </div>
                                  )}
                                </div>

                                {/* Save Button & Test Action */}
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSendTestReminder('TASK', task.id, task.title)}
                                    disabled={isSendingTestReminder}
                                    className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    title="Send a live test reminder for this task"
                                  >
                                    {isSendingTestReminder ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Bell className="w-3.5 h-3.5" />
                                    )}
                                    <span>Send Test</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTaskReminders(task.id, task.title)}
                                    disabled={savingTaskId === task.id}
                                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                  >
                                    {savingTaskId === task.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Save Task Reminders</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Section 3: User Notification Delivery Channels & Triggers */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-border pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-emerald-400" />
                            <span>Notification Delivery Channels & Triggers (Per-User)</span>
                          </h4>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Configure specifically which events trigger In-App updates and/or Email dispatches for @{selectedUserDetails?.username}.
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-zinc-400">
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-surface border border-dark-border text-zinc-300">
                            <Bell className="w-3.5 h-3.5 text-blue-400" /> In-App
                          </span>
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-surface border border-dark-border text-zinc-300">
                            <Mail className="w-3.5 h-3.5 text-flame-400" /> Email
                          </span>
                        </div>
                      </div>

                      {adminNotificationPreferences && (
                        <div className="divide-y divide-dark-border">
                          {/* 1. Overall Daily Streak Reminders */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-flame-500" />
                                Overall Daily Streak Reminders
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Automated reminders for daily overall completion
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('overallStreakRemindersInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.overallStreakRemindersInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.overallStreakRemindersInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('overallStreakRemindersEmail')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.overallStreakRemindersEmail !== false
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.overallStreakRemindersEmail !== false ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 2. Task Reminders */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-purple-400" />
                                Task Reminders
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Independent schedules for personal and group tasks
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('taskRemindersInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.taskRemindersInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.taskRemindersInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('taskRemindersEmail')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.taskRemindersEmail !== false
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.taskRemindersEmail !== false ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 3. Friend Overall Activity Alerts */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-blue-400" />
                                Friend Overall Activity Alerts
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Alerts when an accepted friend finishes today's overall activity
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendOverallActivityInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendOverallActivityInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendOverallActivityInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendOverallActivityAlerts')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendOverallActivityAlerts
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendOverallActivityAlerts ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 4. Friend Matching Task Alerts */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                Friend Matching Task Alerts
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Alerts when an accepted friend finishes a matching habit
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendTaskActivityInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendTaskActivityInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendTaskActivityInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendTaskActivityAlerts')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendTaskActivityAlerts
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendTaskActivityAlerts ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 5. Friend Overall Streak Milestones */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-purple-400" />
                                Friend Overall Streak Milestones
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Milestones when a friend hits 5, 10, 25, 50, 100+ day streaks
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendOverallMilestonesInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendOverallMilestonesInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendOverallMilestonesInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendOverallMilestones')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendOverallMilestones
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendOverallMilestones ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 6. Friend Task Streak Milestones */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-purple-400" />
                                Friend Task Streak Milestones
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Milestones when a friend reaches a streak on a matching task
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendTaskMilestonesInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendTaskMilestonesInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendTaskMilestonesInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('friendTaskMilestones')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.friendTaskMilestones
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.friendTaskMilestones ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 7. My Own Streak Milestones */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-flame-500" />
                                My Own Streak Milestones
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Celebratory alerts for unlocking streak milestones
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('myMilestonesInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.myMilestonesInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.myMilestonesInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('myMilestonesEmail')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.myMilestonesEmail
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.myMilestonesEmail ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>

                          {/* 8. Streak Freeze & Status Alerts */}
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                                Streak Freeze & Status Alerts
                              </span>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                Protection alerts when freeze saves a streak after a missed day
                              </span>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('freezeStatusInApp')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.freezeStatusInApp !== false
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Bell className="w-3 h-3 text-blue-400" />
                                <span>In-App</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.freezeStatusInApp !== false ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminTogglePref('freezeStatusNotifications')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                  adminNotificationPreferences.freezeStatusNotifications
                                    ? 'bg-flame-500/15 text-flame-300 border-flame-500/40'
                                    : 'bg-dark-surface text-zinc-500 border-dark-border hover:border-zinc-700'
                                }`}
                              >
                                <Mail className="w-3 h-3 text-flame-400" />
                                <span>Email</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${adminNotificationPreferences.freezeStatusNotifications ? 'bg-flame-400' : 'bg-zinc-600'}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveAdminPreferences}
                          disabled={isSavingPreferences || !adminNotificationPreferences}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                          {isSavingPreferences ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Save Notification Channel Preferences</span>
                        </button>
                      </div>
                    </div>

                    {/* Section 4: Direct Custom Reminder Schedule Creator */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                          <Plus className="w-4 h-4 text-emerald-400" />
                          <span>Direct Custom Reminder Schedule Creation</span>
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono">Bypasses Quotas & Restrictions</span>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!customReminderTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(customReminderTime)) {
                            toast.error('Valid 24h time in HH:mm format is required.');
                            return;
                          }
                          if (customReminderType === 'TASK' && !customReminderTaskId) {
                            toast.error('Please select a task for this schedule.');
                            return;
                          }
                          if (!customReminderReason.trim()) {
                            toast.error('Administrative reason is required.');
                            return;
                          }

                          openPinPrompt(
                            'Create Reminder Schedule',
                            `Create ${customReminderType} reminder at ${customReminderTime} for @${selectedUserDetails?.username}?`,
                            async (pin) => {
                              try {
                                setIsCreatingCustomReminder(true);
                                const res = await adminCreateReminderSchedule(selectedUserDetails.id, {
                                  time: customReminderTime,
                                  type: customReminderType,
                                  taskId: customReminderType === 'TASK' ? customReminderTaskId : undefined,
                                  sendInApp: customReminderInApp,
                                  sendEmail: customReminderEmail,
                                  reason: customReminderReason.trim(),
                                  sensitivePin: pin,
                                });
                                if (res.success) {
                                  toast.success(res.message);
                                  setCustomReminderTime('');
                                  setCustomReminderReason('');
                                  loadUserReminders(selectedUserDetails.id);
                                }
                              } finally {
                                setIsCreatingCustomReminder(false);
                              }
                            }
                          );
                        }}
                        className="space-y-4 text-xs"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold text-zinc-300 mb-1">Time (HH:mm, 24h) *</label>
                            <input
                              type="text"
                              value={customReminderTime}
                              onChange={(e) => setCustomReminderTime(e.target.value)}
                              placeholder="e.g. 21:00"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500 font-mono"
                              required
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-zinc-300 mb-1">Schedule Scope</label>
                            <select
                              value={customReminderType}
                              onChange={(e) => setCustomReminderType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
                            >
                              <option value="OVERALL">OVERALL (Platform Daily Reminder)</option>
                              <option value="TASK">TASK (Targeted Task Habit)</option>
                            </select>
                          </div>

                          {customReminderType === 'TASK' && (
                            <div>
                              <label className="block font-semibold text-zinc-300 mb-1">Select Task *</label>
                              <select
                                value={customReminderTaskId}
                                onChange={(e) => setCustomReminderTaskId(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
                                required
                              >
                                <option value="">Select a task...</option>
                                {selectedUserDetails?.tasks?.map((t: any) => (
                                  <option key={t.id} value={t.id}>
                                    {t.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-4 bg-dark-surface p-3 rounded-xl border border-dark-border">
                            <span className="text-zinc-400 font-semibold">Channels:</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customReminderInApp}
                                onChange={(e) => setCustomReminderInApp(e.target.checked)}
                                className="rounded border-dark-border text-flame-500"
                              />
                              <span className="text-zinc-200">In-App</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customReminderEmail}
                                onChange={(e) => setCustomReminderEmail(e.target.checked)}
                                className="rounded border-dark-border text-flame-500"
                              />
                              <span className="text-zinc-200">Email</span>
                            </label>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={customReminderReason}
                              onChange={(e) => setCustomReminderReason(e.target.value)}
                              placeholder="Administrative reason (e.g. Schedule request)..."
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isCreatingCustomReminder}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Create Reminder Schedule</span>
                          </button>
                        </div>
                      </form>
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

                        {appliedChanges['starredLimit'] && (
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs text-purple-300">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-purple-400" />
                              <span className="font-bold">Applied: {appliedChanges['starredLimit'].label}</span>
                              <span className="text-[11px] text-zinc-400">(Click "Save" on top to commit)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAppliedChanges((prev) => {
                                  const next = { ...prev };
                                  delete next['starredLimit'];
                                  return next;
                                });
                                toast.info('Starred notifications limit unapplied.');
                              }}
                              className="text-zinc-400 hover:text-zinc-200 underline text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

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
                          <span>{appliedChanges['starredLimit'] ? 'Re-apply Limit' : 'Apply'}</span>
                        </button>
                      </form>
                    </div>

                    {/* CARD 2: SCHEDULED REMINDERS QUOTA */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-flame-400" />
                          <span>Scheduled Reminders Quota (Default: 3 Reminders)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          {selectedUserDetails?.reminderSchedules?.length || 0} / {selectedUserDetails?.reminderLimit || 3} SCHEDULES
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, StreakUp limits users to 3 reminder times. You can <strong className="text-zinc-200">customize and increase the maximum reminders quota specifically for @{selectedUserDetails?.username}</strong> (e.g. to 5, 8, 10, or 15 schedules) so they can configure multiple alert schedules.
                      </p>

                      <form onSubmit={handleOverrideReminderLimit} className="space-y-4 p-4 bg-dark-surface rounded-xl border border-dark-border">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Override Maximum Reminders Quota Limit
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              Current Reminders Quota
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`Max ${selectedUserDetails?.reminderLimit || 3} reminder times allowed`}
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              New Quota Limit (Max 50)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={newReminderLimit}
                                onChange={(e) => setNewReminderLimit(parseInt(e.target.value, 10) || 3)}
                                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                                required
                              />
                              <div className="flex gap-1">
                                {[3, 5, 8, 10, 15].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setNewReminderLimit(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      newReminderLimit === preset
                                        ? 'bg-flame-500 text-zinc-950 border-flame-500'
                                        : 'bg-dark-card text-zinc-400 border-dark-border hover:border-flame-500/50'
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
                          <label className="block text-xs font-semibold text-zinc-400 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={reminderLimitReason}
                            onChange={(e) => setReminderLimitReason(e.target.value)}
                            placeholder="e.g. Increased reminder quota to 10 schedules upon user request"
                            className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingReminderLimit}
                          className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingReminderLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Reminders Quota ({newReminderLimit} Schedules)</span>
                        </button>
                      </form>

                      <div className="pt-2">
                        <span className="text-xs font-bold text-zinc-300 block mb-2">
                          Active Reminder Schedules ({selectedUserDetails?.reminderSchedules?.length || 0})
                        </span>
                        {(!selectedUserDetails?.reminderSchedules || selectedUserDetails.reminderSchedules.length === 0) ? (
                          <p className="text-xs text-zinc-500 py-2">No active reminder schedules found for this user.</p>
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
                  </div>

                    {/* CARD 2B: PER-TASK REMINDERS QUOTA */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-400" />
                          <span>Per-Task Reminders Quota (Default: 1 Reminder Per Task)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                          {selectedUserDetails?.taskReminderLimit || 1} PER TASK
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, StreakUp limits each personal and group habit to 1 reminder time. You can <strong className="text-zinc-200">customize and increase the per-task reminder quota specifically for @{selectedUserDetails?.username}</strong> (e.g. to 2, 3, 5, or 10 schedules per task) so they can configure multiple alert schedules per habit.
                      </p>

                      <form onSubmit={handleOverrideTaskReminderLimit} className="space-y-4 p-4 bg-dark-surface rounded-xl border border-dark-border">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Override Per-Task Reminders Quota Limit
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              Current Per-Task Quota
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`Max ${selectedUserDetails?.taskReminderLimit || 1} reminder time(s) allowed per task`}
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              New Per-Task Quota Limit (Max 50)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={newTaskReminderLimit}
                                onChange={(e) => setNewTaskReminderLimit(parseInt(e.target.value, 10) || 1)}
                                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
                                required
                              />
                              <div className="flex gap-1">
                                {[1, 2, 3, 5, 8].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setNewTaskReminderLimit(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      newTaskReminderLimit === preset
                                        ? 'bg-purple-500 text-zinc-950 border-purple-500'
                                        : 'bg-dark-card text-zinc-400 border-dark-border hover:border-purple-500/50'
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
                          <label className="block text-xs font-semibold text-zinc-400 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={taskReminderLimitReason}
                            onChange={(e) => setTaskReminderLimitReason(e.target.value)}
                            placeholder="e.g. Granted user permission for multiple reminder schedules per habit"
                            className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingTaskReminderLimit}
                          className="w-full py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSubmittingTaskReminderLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Per-Task Reminders Quota ({newTaskReminderLimit} Per Task)</span>
                        </button>
                      </form>
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

                    {/* CARD 5: TOP DISCOVER RANKING GROUPS DISPLAY QUOTA */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Users className="w-4 h-4 text-flame-400" />
                          <span>Top Discover Ranking Groups (Default: Top 5)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30">
                          TOP {selectedUserDetails?.discoverGroupsLimit || 5} VISIBLE
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, the global Discover communities page showcases the Top 5 most active ranking groups. As Super Admin, you can <strong className="text-zinc-200">grant @{selectedUserDetails?.username} permission to see any number of top groups</strong> on their Discover page (e.g. Top 10, 20, 50, or 100).
                      </p>

                      <form onSubmit={handleOverrideDiscoverGroupsLimit} className="space-y-4 p-4 bg-dark-surface rounded-xl border border-dark-border">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Override Visible Discover Groups Cohort
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              Current Discover Limit
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`Top ${selectedUserDetails?.discoverGroupsLimit || 5} active groups displayed`}
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              New Quota Limit (Max 100)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={newDiscoverGroupsLimit}
                                onChange={(e) => setNewDiscoverGroupsLimit(parseInt(e.target.value, 10) || 5)}
                                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                                required
                              />
                              <div className="flex gap-1">
                                {[5, 10, 20, 50, 100].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setNewDiscoverGroupsLimit(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      newDiscoverGroupsLimit === preset
                                        ? 'bg-flame-500 text-zinc-950 border-flame-500'
                                        : 'bg-dark-card text-zinc-400 border-dark-border hover:border-flame-500/50'
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
                          <label className="block text-xs font-semibold text-zinc-400 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={discoverGroupsReason}
                            onChange={(e) => setDiscoverGroupsReason(e.target.value)}
                            placeholder="e.g. Expanded group discovery quota to Top 20 for community leader"
                            className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingDiscoverGroupsLimit}
                          className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingDiscoverGroupsLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Discover Groups Quota (Top {newDiscoverGroupsLimit})</span>
                        </button>
                      </form>

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

                    {/* CARD 6: PROFILE PICTURE MAX UPLOAD FILE SIZE QUOTA */}
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                          <Camera className="w-4 h-4 text-flame-400" />
                          <span>Profile Picture Max File Size Quota (Default: 5 MB)</span>
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30 font-bold">
                          CURRENT: {selectedUserDetails?.profileImageLimitMb || 5} MB QUOTA
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        By default, all members are restricted to a maximum 5 MB avatar upload. As Super Admin, you can <strong className="text-zinc-200">customize the maximum upload size specifically for @{selectedUserDetails?.username}</strong> (e.g. 5 MB, 10 MB, 15 MB, 25 MB, or 50 MB) if they need high-resolution photo uploads.
                      </p>

                      <form onSubmit={handleOverrideProfileImageLimit} className="space-y-4 p-4 bg-dark-surface rounded-xl border border-dark-border">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Override Profile Picture Upload Limit
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              Current Upload Quota
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`${selectedUserDetails?.profileImageLimitMb || 5} MB Max File Size`}
                              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">
                              New Quota Limit (1 - 100 MB)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={newProfileImageLimitMb}
                                onChange={(e) => setNewProfileImageLimitMb(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 5)))}
                                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                                required
                              />
                              <div className="flex gap-1">
                                {[5, 10, 15, 25, 50].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setNewProfileImageLimitMb(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      newProfileImageLimitMb === preset
                                        ? 'bg-flame-500 text-zinc-950 border-flame-500'
                                        : 'bg-dark-card text-zinc-400 border-dark-border hover:border-flame-500/50'
                                    }`}
                                  >
                                    {preset}MB
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 mb-1">
                            Mandatory Administrative Reason
                          </label>
                          <input
                            type="text"
                            value={profileImageLimitReason}
                            onChange={(e) => setProfileImageLimitReason(e.target.value)}
                            placeholder="e.g. Expanded profile picture quota for HD photography per user request"
                            className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                            required
                          />
                        </div>

                        {renderNotificationOptions()}

                        <button
                          type="submit"
                          disabled={isSubmittingProfileImageLimit}
                          className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {isSubmittingProfileImageLimit ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Apply Profile Picture Quota ({newProfileImageLimitMb} MB)</span>
                        </button>
                      </form>
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCreateTaskModalOpen(true)}
                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create Task For User</span>
                          </button>
                          <span className="hidden sm:inline text-[10px] text-zinc-500 font-mono">Full Settings & Controls</span>
                        </div>
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
                                    onClick={() => setUncompleteModalTask(t)}
                                    className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                    title="Uncomplete Task for Date (-5 pts, recalculates streaks)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Uncomplete</span>
                                  </button>
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
                                  {isLinkedInName(m.group?.name) && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                                      <Gamepad2 className="w-3 h-3 text-amber-400" />
                                      <span>8 Game Streaks</span>
                                    </span>
                                  )}
                                  {m.group?.isSpecialGroup && m.group?.specialPlatform !== 'LINKEDIN' && (
                                    <>
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30 font-bold">
                                        ★ {m.group.specialPlatform} Special
                                      </span>
                                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                                        m.isPotdCommitted !== false
                                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                      }`}>
                                        POTD: {m.isPotdCommitted !== false ? 'Committed' : 'Paused'}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1">
                                  Group Members: {m.group?._count?.members || m.group?.members?.length || 1} • Joined:{' '}
                                  {new Date(m.joinedAt).toLocaleDateString()}
                                  {m.group?.description ? ` • "${m.group.description}"` : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {m.group?.isSpecialGroup && m.group?.specialPlatform !== 'LINKEDIN' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAdminTogglePotdCommitment(m.groupId, selectedUserId!, m.isPotdCommitted !== false)}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold cursor-pointer"
                                  >
                                    {m.isPotdCommitted !== false ? 'Disable POTD' : 'Enable POTD'}
                                  </button>
                                )}
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

                {/* SUB-TAB: FRIENDS & SOCIAL NETWORK */}
                {userTab === 'friends' && selectedUserDetails && (
                  <AdminUserFriendsTab
                    userId={selectedUserDetails.id}
                    username={selectedUserDetails.username}
                    onRequirePin={openPinPrompt}
                  />
                )}

                {/* SUB-TAB: NOTIFICATIONS HUB */}
                {userTab === 'notifications' && selectedUserDetails && (
                  <AdminUserNotificationsTab
                    userId={selectedUserDetails.id}
                    username={selectedUserDetails.username}
                    onRequirePin={openPinPrompt}
                  />
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

                    {selectedUserDetails?.isDeleted && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <h4 className="text-xs font-bold text-emerald-300">Account Currently in Deletion Recovery Window</h4>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                            {selectedUserDetails.deletionDaysRemaining ?? 10} Days Remaining
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300">
                          This user requested account deletion and is currently blocked from logging in. You can restore their account and full login access with all streaks, tasks, and history intact.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRecoverUserAccount(selectedUserDetails.id, selectedUserDetails.username)}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authorize & Recover Account</span>
                        </button>
                      </div>
                    )}

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
        {/* PRIMARY TAB: GROUP DISCOVERABILITY & DIRECTORY           */}
        {/* ======================================================== */}
        {primaryTab === 'groups' && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                  <Compass className="w-4 h-4 text-flame-400" />
                  <span>Group Discoverability & Directory Control</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Search groups across the platform and toggle public discovery visibility. Non-discoverable groups are hidden from discover feeds but remain fully searchable by name or code and accessible to existing members.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadAdminGroups()}
                disabled={isLoadingAdminGroups}
                className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border text-zinc-300 border border-dark-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminGroups ? 'animate-spin text-flame-400' : ''}`} />
                <span>Refresh Directory</span>
              </button>
            </div>

            {/* Search Bar & Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadAdminGroups(groupSearchQuery);
                    }
                  }}
                  placeholder="Search groups by name, join code, or creator..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => loadAdminGroups(groupSearchQuery)}
                disabled={isLoadingAdminGroups}
                className="px-4 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
              >
                {isLoadingAdminGroups ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search</span>
              </button>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-dark-surface p-1 rounded-xl border border-dark-border">
                {(['ALL', 'DISCOVERABLE', 'NON_DISCOVERABLE'] as const).map((filterMode) => (
                  <button
                    key={filterMode}
                    type="button"
                    onClick={() => setGroupDiscoverFilter(filterMode)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      groupDiscoverFilter === filterMode
                        ? 'bg-dark-card text-zinc-100 shadow-sm border border-dark-border'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {filterMode === 'ALL'
                      ? 'All Groups'
                      : filterMode === 'DISCOVERABLE'
                      ? 'Discoverable Only'
                      : 'Non-Discoverable Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Groups Table / List */}
            {isLoadingAdminGroups ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-zinc-400">
                <RefreshCw className="w-6 h-6 animate-spin text-flame-400" />
                <span>Searching groups directory...</span>
              </div>
            ) : adminGroupsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 bg-dark-surface/30 rounded-xl border border-dashed border-dark-border">
                No groups found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-dark-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-dark-surface/80 border-b border-dark-border text-zinc-400 font-semibold">
                      <th className="py-3 px-4">Group Name</th>
                      <th className="py-3 px-3">Join Code</th>
                      <th className="py-3 px-3">Creator / Owner</th>
                      <th className="py-3 px-3">Members</th>
                      <th className="py-3 px-3">Tasks</th>
                      <th className="py-3 px-3">Discoverability</th>
                      <th className="py-3 px-3">Special Mode</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {adminGroupsList
                      .filter((g) => {
                        if (groupDiscoverFilter === 'DISCOVERABLE') return g.isDiscoverable;
                        if (groupDiscoverFilter === 'NON_DISCOVERABLE') return !g.isDiscoverable;
                        return true;
                      })
                      .map((g) => (
                        <tr key={g.id} className="hover:bg-dark-surface/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-zinc-100 block">{g.name}</span>
                            {g.description && (
                              <span className="text-[11px] text-zinc-500 line-clamp-1 max-w-xs block">
                                {g.description}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {g.joinCode}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-300">
                            {g.owner ? (
                              <span>
                                {g.owner.name} <span className="text-zinc-500 font-mono">(@{g.owner.username})</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-300 font-medium">
                            {g.memberCount ?? 0}
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-300 font-medium">
                            {g.taskCount ?? 0}
                          </td>
                          <td className="py-3 px-3">
                            {g.isDiscoverable ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <Eye className="w-3 h-3" />
                                <span>Public Discoverable</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <EyeOff className="w-3 h-3" />
                                <span>Non-Discoverable</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {g.isSpecialGroup ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-flame-500/10 text-flame-400 border border-flame-500/30 font-mono">
                                <span>★ {g.specialPlatform || 'Special'}</span>
                              </span>
                            ) : g.detectedPlatform ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                <span>Ordinary ({g.detectedPlatform})</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">Ordinary</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {Boolean(g.detectedPlatform || g.specialPlatform) && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSpecialMode(g, !g.isSpecialGroup)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border inline-flex items-center gap-1 cursor-pointer ${
                                    g.isSpecialGroup
                                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                                      : 'bg-flame-500/10 hover:bg-flame-500/20 text-flame-400 border-flame-500/30'
                                  }`}
                                >
                                  <span>{g.isSpecialGroup ? 'Disable Special' : 'Enable Special'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedGroupForManage(g)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border inline-flex items-center gap-1.5 cursor-pointer bg-dark-card hover:bg-dark-border text-zinc-200 border-dark-border"
                              >
                                <Sliders className="w-3.5 h-3.5 text-flame-400" />
                                <span>Manage Group</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleGroupDiscoverability(g)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border inline-flex items-center gap-1.5 cursor-pointer ${
                                  g.isDiscoverable
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                {g.isDiscoverable ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Hide Discover</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Discoverable</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB: GLOBAL FRIENDSHIPS & SOCIAL NETWORK         */}
        {/* ======================================================== */}
        {primaryTab === 'friends' && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Global Friendship & Social Connections Administration</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Search any user to inspect and manage their friends and friend requests, or connect any two users directly.
                  </p>
                </div>
              </div>

              {/* User Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={friendSearchUserQuery}
                    onChange={(e) => setFriendSearchUserQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchUserForFriends();
                      }
                    }}
                    placeholder="Search user by username, name, or email to inspect friendships..."
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchUserForFriends}
                  disabled={isSearchingUserForFriends}
                  className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSearchingUserForFriends ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Find User</span>
                </button>
              </div>

              {friendSearchResults.length > 0 && (
                <div className="mt-3 bg-dark-surface border border-dark-border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                  {friendSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedFriendUser(u);
                        setFriendSearchResults([]);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-dark-card text-xs flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-zinc-200">{u.name}</span>
                        <span className="text-zinc-500 font-mono ml-2">@{u.username}</span>
                        <span className="text-zinc-400 ml-2">({u.email})</span>
                      </div>
                      <span className="text-[11px] font-bold text-flame-400">Select User</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFriendUser ? (
              <AdminUserFriendsTab
                userId={selectedFriendUser.id}
                username={selectedFriendUser.username}
                onRequirePin={openPinPrompt}
              />
            ) : selectedUserDetails ? (
              <AdminUserFriendsTab
                userId={selectedUserDetails.id}
                username={selectedUserDetails.username}
                onRequirePin={openPinPrompt}
              />
            ) : (
              <div className="p-12 text-center text-xs text-zinc-400 bg-dark-card border border-dark-border rounded-2xl">
                Search and select any user above to inspect their incoming/outgoing friend requests and friends list, or force-link friends directly.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB: GLOBAL NOTIFICATIONS HUB                    */}
        {/* ======================================================== */}
        {primaryTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <span>User Notification Management Hub</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Inspect in-app notification inboxes for any user, mark notifications as read, or purge spam messages.
                  </p>
                </div>
              </div>

              {/* User Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={notifSearchUserQuery}
                    onChange={(e) => setNotifSearchUserQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchUserForNotif();
                      }
                    }}
                    placeholder="Search user by username, name, or email to inspect notifications..."
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchUserForNotif}
                  disabled={isSearchingUserForNotif}
                  className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSearchingUserForNotif ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Find User</span>
                </button>
              </div>

              {notifSearchResults.length > 0 && (
                <div className="mt-3 bg-dark-surface border border-dark-border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                  {notifSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedNotifUser(u);
                        setNotifSearchResults([]);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-dark-card text-xs flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-zinc-200">{u.name}</span>
                        <span className="text-zinc-500 font-mono ml-2">@{u.username}</span>
                        <span className="text-zinc-400 ml-2">({u.email})</span>
                      </div>
                      <span className="text-[11px] font-bold text-flame-400">Select User</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedNotifUser ? (
              <AdminUserNotificationsTab
                userId={selectedNotifUser.id}
                username={selectedNotifUser.username}
                onRequirePin={openPinPrompt}
              />
            ) : selectedUserDetails ? (
              <AdminUserNotificationsTab
                userId={selectedUserDetails.id}
                username={selectedUserDetails.username}
                onRequirePin={openPinPrompt}
              />
            ) : (
              <div className="p-12 text-center text-xs text-zinc-400 bg-dark-card border border-dark-border rounded-2xl">
                Search and select any user above to inspect their notification inbox, mark all as read, or purge messages.
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB: USER REQUESTS & FEEDBACK                    */}
        {/* ======================================================== */}
        {primaryTab === 'requests' && (
          <AdminUserRequestsTab
            onSelectUserForInspection={(userId) => {
              setSelectedUserId(userId);
              setPrimaryTab('users');
              setUserTab('overview');
            }}
            onRequestResolved={loadPendingRequestsCount}
          />
        )}

        {/* ======================================================== */}
        {/* PRIMARY TAB: MANAGER ACCESS                              */}
        {/* ======================================================== */}
        {primaryTab === 'managers' && <AdminManagersTab />}

        {/* ======================================================== */}
        {/* PRIMARY TAB: SEND MESSAGE                                */}
        {/* ======================================================== */}
        {primaryTab === 'messages' && <AdminSendMessageTab />}

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
                  <option value="RECOVER_ACCOUNT">Account Recovery</option>
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
                  onClick={handleExportAuditLogsCsv}
                  disabled={auditLogs.length === 0}
                  className="px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-zinc-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Export Current Audit Logs as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-flame-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadAuditLogs(auditPage)}
                  disabled={isLoadingLogs}
                  className="p-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-zinc-300 text-xs cursor-pointer"
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
        {/* PRIMARY TAB: SYSTEM DIAGNOSTICS & PLATFORM POWERS        */}
        {/* ======================================================== */}
        {primaryTab === 'system' && <AdminSystemTab />}

        {/* ======================================================== */}
        {/* PRIMARY TAB 3: ADMIN SECURITY & SENSITIVE PASSWORD       */}
        {/* ======================================================== */}
        {primaryTab === 'security' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-zinc-100 tracking-tight">
                    Super Admin Security & Access Control
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Manage administrative credentials. Login password and sensitive action password are completely isolated and independent. Both updates require confirming your current administrator password.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CARD 1: SUPER ADMIN LOGIN PASSWORD */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-zinc-100">Login Password</h3>
                        <p className="text-[11px] text-zinc-400">Panel sign-in authentication</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-flame-500/10 text-flame-400 border border-flame-500/30 font-bold">
                      SIGN-IN
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Update the primary password used by <code className="text-flame-400 font-mono">@{activeAdmin?.username || 'admin'}</code> to access the Super Admin control panel. Minimum 8 characters.
                  </p>

                  <form id="admin-login-pwd-form" onSubmit={handleUpdateLoginPassword} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Current Admin Password <span className="text-flame-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={loginCurrentPassword}
                        onChange={(e) => setLoginCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        New Admin Password <span className="text-flame-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 font-mono"
                        required
                      />
                      <span className="text-[10px] text-zinc-500 mt-1 block">Must be at least 8 characters long</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Confirm New Admin Password <span className="text-flame-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={confirmAdminPassword}
                        onChange={(e) => setConfirmAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 font-mono"
                        required
                      />
                    </div>
                  </form>
                </div>

                <button
                  type="submit"
                  form="admin-login-pwd-form"
                  disabled={isSubmittingLoginPassword || !loginCurrentPassword || !newAdminPassword || !confirmAdminPassword}
                  className="w-full py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 pt-2"
                >
                  {isSubmittingLoginPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Login Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Update Login Password</span>
                    </>
                  )}
                </button>
              </div>

              {/* CARD 2: SENSITIVE ACTION PASSWORD / PIN */}
              <div className="bg-dark-card border border-rose-500/30 rounded-2xl p-6 shadow-panel flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-dark-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-zinc-100">Sensitive Action Password / PIN</h3>
                        <p className="text-[11px] text-rose-300/80">Secondary high-risk authorization</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                      ROOT OVERRIDES
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Required for high-risk operations: streak adjustments, freeze calibrations, quota overrides, and permanent audit log purging.
                  </p>

                  <form id="admin-sensitive-pwd-form" onSubmit={handleUpdateSensitivePassword} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Current Admin Password <span className="text-flame-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={sensitiveCurrentPassword}
                        onChange={(e) => setSensitiveCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400 font-mono"
                        required
                      />
                      <span className="text-[10px] text-zinc-500 mt-1 block">Verify administrator identity with your login password</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        New Sensitive Action Password / PIN <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={newAdminSensitivePin}
                        onChange={(e) => setNewAdminSensitivePin(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400 font-mono"
                        required
                      />
                      <span className="text-[10px] text-zinc-500 mt-1 block">Minimum 4 characters or PIN digits</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Confirm New Sensitive Password <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={confirmAdminSensitivePin}
                        onChange={(e) => setConfirmAdminSensitivePin(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-rose-400 font-mono"
                        required
                      />
                    </div>
                  </form>
                </div>

                <button
                  type="submit"
                  form="admin-sensitive-pwd-form"
                  disabled={isSubmittingSensitivePin || !sensitiveCurrentPassword || !newAdminSensitivePin || !confirmAdminSensitivePin}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-zinc-100 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 pt-2"
                >
                  {isSubmittingSensitivePin ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Sensitive Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Update Sensitive Action Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* FULL TASK SETTINGS & SUBSTRING PRIVACY MODAL             */}
      {/* ======================================================== */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-dark-card border border-flame-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
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

            <form onSubmit={handleSaveTaskFull} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-4 text-xs">
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

              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-dark-card border border-flame-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
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

            <form onSubmit={handleSaveGroupFull} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-4 text-xs">
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
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-dark-card border border-flame-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
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

            <form onSubmit={handleDayActionSubmit} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-4 text-xs">
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
                      🔥 <strong>Grant Streak (Multi-Task Selection):</strong> Select which tasks were completed on <strong>{dayModalDate}</strong>. Automatically awards <strong>+5 points per task</strong> (+{dayModalSelectedTaskIds.length * 5} pts), records completions, recalculates streaks, and updates heatmaps everywhere.
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

              {dayModalMode === 'STREAK' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Choose Completed Tasks for {dayModalDate}
                      </label>
                      {selectedUserDetails?.tasks && selectedUserDetails.tasks.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              setDayModalSelectedTaskIds(selectedUserDetails.tasks.map((t: any) => t.id))
                            }
                            className="text-flame-400 hover:text-flame-300 font-bold"
                          >
                            Select All
                          </button>
                          <span className="text-zinc-600">|</span>
                          <button
                            type="button"
                            onClick={() => setDayModalSelectedTaskIds([])}
                            className="text-zinc-400 hover:text-zinc-300 font-bold"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {(!selectedUserDetails?.tasks || selectedUserDetails.tasks.length === 0) ? (
                      <div className="p-3 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-400">
                        User has no existing tasks. A default 'Daily Productivity' habit will be created (+5 pts).
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-dark-surface border border-dark-border rounded-xl">
                        {selectedUserDetails.tasks.map((t: any) => {
                          const isSelected = dayModalSelectedTaskIds.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? 'bg-flame-500/10 border-flame-500/40 text-zinc-100'
                                  : 'bg-dark-card/50 border-dark-border/50 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDayModalSelectedTaskIds((prev) => [...prev, t.id]);
                                    } else {
                                      setDayModalSelectedTaskIds((prev) => prev.filter((id) => id !== t.id));
                                    }
                                  }}
                                  className="rounded border-dark-border text-flame-500 focus:ring-flame-500/20"
                                />
                                <span className="truncate text-xs font-medium">
                                  {t.isGroupTask ? `[Group: ${t.group?.name || 'Group'}] ` : '[Personal] '}
                                  {t.title}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] font-mono font-bold text-amber-400">
                                +5 pts
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Live Calculation Pill */}
                    <div className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-2 text-xs">
                      <span className="text-amber-200 font-medium">
                        Selected: <strong className="text-zinc-100">{dayModalSelectedTaskIds.length}</strong> task(s)
                      </span>
                      <span className="text-amber-400 font-extrabold font-mono">
                        +{dayModalSelectedTaskIds.length * 5} pts (+5 per task)
                      </span>
                    </div>
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
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
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
      {/* PROFILE PICTURE MANAGEMENT MODAL                         */}
      {/* ======================================================== */}
      {profileImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92vh] flex flex-col bg-dark-card border border-flame-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100">Profile Picture Permission & Control</h3>
                  <p className="text-[11px] text-zinc-400">Target: @{selectedUserDetails?.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileImageModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfileImage} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-4 text-xs">
                {/* Mode Switcher */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-dark-surface rounded-xl border border-dark-border text-xs">
                  <button
                    type="button"
                    onClick={() => setProfileImageMode('UPLOAD')}
                    className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                      profileImageMode === 'UPLOAD'
                        ? 'bg-flame-500 text-zinc-950 shadow-md shadow-flame-500/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileImageMode('URL')}
                    className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                      profileImageMode === 'URL'
                        ? 'bg-flame-500 text-zinc-950 shadow-md shadow-flame-500/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Image URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileImageMode('REMOVE')}
                    className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                      profileImageMode === 'REMOVE'
                        ? 'bg-rose-500 text-zinc-100 shadow-md shadow-rose-500/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                {/* Avatar Preview Section */}
                <div className="flex flex-col items-center justify-center p-4 bg-dark-surface rounded-2xl border border-dark-border gap-2.5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-dark-card border-2 border-flame-500/40 flex items-center justify-center text-flame-400 font-extrabold text-2xl overflow-hidden shadow-inner">
                      {profileImageMode === 'REMOVE' ? (
                        <span className="text-zinc-500 font-mono text-sm">Default</span>
                      ) : (profileImagePreview || profileImageInput) ? (
                        <img
                          src={profileImagePreview || profileImageInput}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                          onError={() => toast.error('Failed to load image preview from provided URL.')}
                        />
                      ) : selectedUserDetails?.profileImage ? (
                        <img
                          src={selectedUserDetails.profileImage}
                          alt="Current Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedUserDetails?.name?.slice(0, 2).toUpperCase() ||
                        selectedUserDetails?.username?.slice(0, 2).toUpperCase() ||
                        'U'
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    {profileImageMode === 'REMOVE'
                      ? 'Will revert to default initial avatar'
                      : (profileImagePreview || profileImageInput)
                      ? 'New Avatar Preview'
                      : 'Current Active Avatar'}
                  </span>
                </div>

                {profileImageMode === 'UPLOAD' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Upload Image File (JPEG, PNG, WebP • Max {selectedUserDetails?.profileImageLimitMb || 5}MB)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfileImageFileChange}
                      className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-flame-500 file:text-zinc-950 hover:file:bg-flame-400 cursor-pointer"
                    />
                  </div>
                )}

                {profileImageMode === 'URL' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Direct Image URL (HTTP / HTTPS)
                    </label>
                    <input
                      type="url"
                      value={profileImageInput}
                      onChange={(e) => {
                        setProfileImageInput(e.target.value);
                        setProfileImagePreview(null);
                      }}
                      placeholder="https://example.com/avatar.png"
                      className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                      required
                    />
                  </div>
                )}

                {profileImageMode === 'REMOVE' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 leading-relaxed">
                    Removing this profile picture will immediately clear custom photo data and restore default username initials across all leaderboards, groups, and friend feeds.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Mandatory Administrative Reason
                  </label>
                  <input
                    type="text"
                    value={profileImageReason}
                    onChange={(e) => setProfileImageReason(e.target.value)}
                    placeholder="e.g. Administrative profile image update upon verified user request"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                    required
                  />
                </div>

                {renderNotificationOptions()}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setProfileImageModalOpen(false)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProfileImage}
                  className={`flex-1 py-2.5 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                    profileImageMode === 'REMOVE'
                      ? 'bg-rose-500 hover:bg-rose-400 text-zinc-100'
                      : 'bg-flame-500 hover:bg-flame-400 text-zinc-950'
                  }`}
                >
                  {isSubmittingProfileImage ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : profileImageMode === 'REMOVE' ? (
                    <Trash2 className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {profileImageMode === 'REMOVE' ? 'Authorize & Remove Picture' : 'Authorize & Save Picture'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* GROUP MANAGEMENT HUB MODAL (MEMBERS, JOIN REQS, INVITES) */}
      {/* ======================================================== */}
      {selectedGroupForManage && (
        <AdminGroupManageModal
          group={selectedGroupForManage}
          onClose={() => setSelectedGroupForManage(null)}
          onRequirePin={openPinPrompt}
        />
      )}

      {/* ======================================================== */}
      {/* ADMIN CREATE TASK FOR USER MODAL                         */}
      {/* ======================================================== */}
      {createTaskModalOpen && selectedUserDetails && (
        <AdminCreateTaskModal
          userId={selectedUserDetails.id}
          username={selectedUserDetails.username}
          onClose={() => setCreateTaskModalOpen(false)}
          onSuccess={() => handleSelectUser({ id: selectedUserDetails.id })}
          onRequirePin={openPinPrompt}
        />
      )}

      {/* ======================================================== */}
      {/* ADMIN UNCOMPLETE TASK FOR DATE MODAL                     */}
      {/* ======================================================== */}
      {uncompleteModalTask && selectedUserDetails && (
        <AdminUncompleteTaskModal
          userId={selectedUserDetails.id}
          username={selectedUserDetails.username}
          task={uncompleteModalTask}
          onClose={() => setUncompleteModalTask(null)}
          onSuccess={() => handleSelectUser({ id: selectedUserDetails.id })}
          onRequirePin={openPinPrompt}
        />
      )}

      {/* ======================================================== */}
      {/* SENSITIVE ACTION PASSWORD CONFIRMATION MODAL             */}
      {/* ======================================================== */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92vh] flex flex-col bg-dark-card border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100">{pinModalTitle}</h3>
                  <p className="text-[11px] text-zinc-400">Secondary Sensitive Password Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={executePinAction} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-4 text-xs">
                <p className="text-xs text-zinc-300 leading-relaxed">{pinModalDescription}</p>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Super Admin Sensitive Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPinPassword ? 'text' : 'password'}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="off"
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
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
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
