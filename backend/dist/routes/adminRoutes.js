"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const userRequestController_1 = require("../controllers/userRequestController");
const adminAuthMiddleware_1 = require("../middleware/adminAuthMiddleware");
const router = (0, express_1.Router)();
// Public Admin Auth
router.post('/login', adminController_1.adminLogin);
// Protected Super Admin Endpoints
router.use(adminAuthMiddleware_1.requireAdminAuth);
router.get('/me', adminController_1.getAdminProfile);
router.post('/change-credentials', adminController_1.changeAdminCredentials);
// Audit Logs Management
router.get('/audit-logs', adminController_1.getAdminAuditLogs);
router.delete('/audit-logs/:logId', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.deleteAdminAuditLog);
router.delete('/audit-logs', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.clearAdminAuditLogs);
// User Inspection & Search
router.get('/users', adminController_1.searchUsersForAdmin);
router.get('/users/:userId', adminController_1.getUserDetailsForAdmin);
// Privileged Overrides & Controls (Protected with Secondary Sensitive Authentication)
router.post('/users/:userId/override-username-cooldown', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideUsernameCooldown);
router.post('/users/:userId/override-email-cooldown', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideEmailCooldown);
router.post('/users/:userId/toggle-email-verification', adminController_1.toggleUserEmailVerification);
router.post('/users/:userId/update-timezone', adminController_1.updateUserTimezone);
router.post('/users/:userId/correct-streak', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.correctStreaks);
router.post('/users/:userId/grant-day-streak', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.grantDayStreak);
router.post('/users/:userId/adjust-freezes', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adjustFreezes);
router.post('/users/:userId/adjust-points', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adjustPoints);
router.post('/users/:userId/override-starred-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideLimit15);
router.post('/users/:userId/override-leaderboard-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideLeaderboardLimit);
router.post('/users/:userId/override-reminder-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideReminderLimit);
router.post('/users/:userId/override-task-reminder-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideTaskReminderLimit);
router.post('/users/:userId/override-discover-groups-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideDiscoverGroupsLimit);
router.post('/users/:userId/override-profile-image-limit', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.overrideProfileImageLimit);
router.post('/users/:userId/profile-image', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminUpdateUserProfileImage);
router.post('/users/:userId/reset-nudge-cooldown', adminController_1.resetNudgeCooldown);
router.delete('/users/:userId/freeze/:date', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.unfreezeUserDate);
// Reminder Management & Scheduling Controls
router.get('/users/:userId/reminders', adminController_1.getUserReminderSettings);
router.post('/users/:userId/reminders/overall', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminUpdateOverallReminders);
router.post('/users/:userId/reminders/tasks/:taskId', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminUpdateTaskReminders);
router.post('/users/:userId/reminders/send-test', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminSendTestReminder);
router.delete('/reminders/:reminderId', adminController_1.adminDeleteReminderSchedule);
router.post('/reminders/run-check', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminTriggerManualReminderCheck);
router.put('/users/:userId/preferences', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminUpdateUserPreferences);
// Group Management & Discoverability Controls
router.get('/groups', adminController_1.searchGroupsForAdmin);
router.post('/groups/:groupId/discoverability', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminToggleGroupDiscoverability);
router.post('/groups/:groupId/special-mode', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminToggleGroupSpecialMode);
router.post('/groups/:groupId/manage-member', adminController_1.adminManageGroupMember);
router.post('/groups/:groupId/update-full', adminController_1.adminUpdateGroupFull);
// Dedicated Special Groups (LeetCode, GeeksforGeeks, etc.)
router.get('/users/:userId/special-groups/:groupId', adminController_1.getMemberSpecialActivitiesAdmin);
router.post('/users/:userId/special-groups/:groupId/correct', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminCorrectSpecialActivityStreak);
router.post('/users/:userId/special-groups/:groupId/grant-date', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminGrantSpecialActivityDate);
router.post('/users/:userId/special-groups/:groupId/commitment', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminSetSpecialActivityCommitment);
// Dedicated LinkedIn Group Member Games Control
router.get('/users/:userId/linkedin-games/:groupId', adminController_1.getMemberLinkedInGamesAdmin);
router.post('/users/:userId/linkedin-games/:groupId/correct', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminCorrectLinkedInGameStreak);
router.post('/users/:userId/linkedin-games/:groupId/grant-date', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminGrantLinkedInGameDate);
router.post('/users/:userId/linkedin-games/:groupId/freeze-date', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminFreezeLinkedInGameDate);
router.post('/users/:userId/linkedin-games/:groupId/commitment', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.adminSetLinkedInGameCommitment);
// Task Management
router.post('/tasks/:taskId/visibility', adminController_1.updateTaskVisibility);
router.post('/tasks/:taskId/update-full', adminController_1.adminUpdateTaskFull);
router.post('/tasks/:taskId/recover', adminController_1.adminRecoverGroupTask);
router.post('/completions/:completionId/moderate', adminController_1.adminModerateStudyNote);
// High-Risk Sensitive Operations (Requires Sensitive PIN confirmation)
router.post('/users/:userId/recover', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.recoverUserAccount);
router.delete('/users/:userId', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.deleteUserAccountByAdmin);
// User Requests & Feedback Management
router.get('/requests', userRequestController_1.getAdminRequests);
router.patch('/requests/:id/status', userRequestController_1.updateRequestStatus);
// Manager Access Management
router.get('/managers', adminController_1.getManagersAdmin);
router.post('/managers', adminController_1.grantManagerAdmin);
router.delete('/managers/:userId', adminController_1.revokeManagerAdmin);
router.patch('/managers/:userId/email', adminController_1.updateManagerEmailAdmin);
// Admin Direct Messaging to Users
router.post('/send-message', adminController_1.sendAdminMessage);
router.get('/messages', adminController_1.getAdminMessageLogsController);
exports.default = router;
