import { Router } from 'express';
import {
  adminLogin,
  getAdminProfile,
  changeAdminCredentials,
  getAdminAuditLogs,
  deleteAdminAuditLog,
  clearAdminAuditLogs,
  searchUsersForAdmin,
  getUserDetailsForAdmin,
  overrideUsernameCooldown,
  overrideEmailCooldown,
  toggleUserEmailVerification,
  updateUserTimezone,
  correctStreaks,
  grantDayStreak,
  adjustFreezes,
  adjustPoints,
  overrideLimit15,
  resetNudgeCooldown,
  updateTaskVisibility,
  adminManageGroupMember,
  adminRecoverGroupTask,
  adminModerateStudyNote,
  deleteUserAccountByAdmin,
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
  adminTriggerManualReminderCheck,
  adminUpdateUserPreferences,
  getMemberLinkedInGamesAdmin,
  adminCorrectLinkedInGameStreak,
  adminGrantLinkedInGameDate,
  adminFreezeLinkedInGameDate,
  adminSetLinkedInGameCommitment,
  getManagersAdmin,
  grantManagerAdmin,
  revokeManagerAdmin,
  updateManagerEmailAdmin,
  sendAdminMessage,
  getAdminMessageLogsController,
} from '../controllers/adminController';
import { getAdminRequests, updateRequestStatus } from '../controllers/userRequestController';
import { requireAdminAuth, requireSensitiveAuth } from '../middleware/adminAuthMiddleware';

const router = Router();

// Public Admin Auth
router.post('/login', adminLogin);

// Protected Super Admin Endpoints
router.use(requireAdminAuth);

router.get('/me', getAdminProfile);
router.post('/change-credentials', changeAdminCredentials);

// Audit Logs Management
router.get('/audit-logs', getAdminAuditLogs);
router.delete('/audit-logs/:logId', requireSensitiveAuth, deleteAdminAuditLog);
router.delete('/audit-logs', requireSensitiveAuth, clearAdminAuditLogs);

// User Inspection & Search
router.get('/users', searchUsersForAdmin);
router.get('/users/:userId', getUserDetailsForAdmin);

// Privileged Overrides & Controls (Protected with Secondary Sensitive Authentication)
router.post('/users/:userId/override-username-cooldown', requireSensitiveAuth, overrideUsernameCooldown);
router.post('/users/:userId/override-email-cooldown', requireSensitiveAuth, overrideEmailCooldown);
router.post('/users/:userId/toggle-email-verification', toggleUserEmailVerification);
router.post('/users/:userId/update-timezone', updateUserTimezone);
router.post('/users/:userId/correct-streak', requireSensitiveAuth, correctStreaks);
router.post('/users/:userId/grant-day-streak', requireSensitiveAuth, grantDayStreak);
router.post('/users/:userId/adjust-freezes', requireSensitiveAuth, adjustFreezes);
router.post('/users/:userId/adjust-points', requireSensitiveAuth, adjustPoints);
router.post('/users/:userId/override-starred-limit', requireSensitiveAuth, overrideLimit15);
router.post('/users/:userId/override-leaderboard-limit', requireSensitiveAuth, overrideLeaderboardLimit);
router.post('/users/:userId/override-reminder-limit', requireSensitiveAuth, overrideReminderLimit);
router.post('/users/:userId/override-task-reminder-limit', requireSensitiveAuth, overrideTaskReminderLimit);
router.post('/users/:userId/override-discover-groups-limit', requireSensitiveAuth, overrideDiscoverGroupsLimit);
router.post('/users/:userId/override-profile-image-limit', requireSensitiveAuth, overrideProfileImageLimit);
router.post('/users/:userId/profile-image', requireSensitiveAuth, adminUpdateUserProfileImage);
router.post('/users/:userId/reset-nudge-cooldown', resetNudgeCooldown);
router.delete('/users/:userId/freeze/:date', requireSensitiveAuth, unfreezeUserDate);
// Reminder Management & Scheduling Controls
router.get('/users/:userId/reminders', getUserReminderSettings);
router.post('/users/:userId/reminders/overall', requireSensitiveAuth, adminUpdateOverallReminders);
router.post('/users/:userId/reminders/tasks/:taskId', requireSensitiveAuth, adminUpdateTaskReminders);
router.delete('/reminders/:reminderId', adminDeleteReminderSchedule);
router.post('/reminders/run-check', requireSensitiveAuth, adminTriggerManualReminderCheck);
router.put('/users/:userId/preferences', requireSensitiveAuth, adminUpdateUserPreferences);

// Group Management & Discoverability Controls
router.get('/groups', searchGroupsForAdmin);
router.post('/groups/:groupId/discoverability', requireSensitiveAuth, adminToggleGroupDiscoverability);
router.post('/groups/:groupId/manage-member', adminManageGroupMember);
router.post('/groups/:groupId/update-full', adminUpdateGroupFull);

// Dedicated LinkedIn Group Member Games Control
router.get('/users/:userId/linkedin-games/:groupId', getMemberLinkedInGamesAdmin);
router.post('/users/:userId/linkedin-games/:groupId/correct', requireSensitiveAuth, adminCorrectLinkedInGameStreak);
router.post('/users/:userId/linkedin-games/:groupId/grant-date', requireSensitiveAuth, adminGrantLinkedInGameDate);
router.post('/users/:userId/linkedin-games/:groupId/freeze-date', requireSensitiveAuth, adminFreezeLinkedInGameDate);
router.post('/users/:userId/linkedin-games/:groupId/commitment', requireSensitiveAuth, adminSetLinkedInGameCommitment);

// Task Management
router.post('/tasks/:taskId/visibility', updateTaskVisibility);
router.post('/tasks/:taskId/update-full', adminUpdateTaskFull);
router.post('/tasks/:taskId/recover', adminRecoverGroupTask);
router.post('/completions/:completionId/moderate', adminModerateStudyNote);

// High-Risk Sensitive Operations (Requires Sensitive PIN confirmation)
router.delete('/users/:userId', requireSensitiveAuth, deleteUserAccountByAdmin);

// User Requests & Feedback Management
router.get('/requests', getAdminRequests);
router.patch('/requests/:id/status', updateRequestStatus);

// Manager Access Management
router.get('/managers', getManagersAdmin);
router.post('/managers', grantManagerAdmin);
router.delete('/managers/:userId', revokeManagerAdmin);
router.patch('/managers/:userId/email', updateManagerEmailAdmin);

// Admin Direct Messaging to Users
router.post('/send-message', sendAdminMessage);
router.get('/messages', getAdminMessageLogsController);

export default router;

