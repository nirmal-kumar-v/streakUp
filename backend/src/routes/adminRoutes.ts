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
} from '../controllers/adminController';
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
router.post('/users/:userId/reset-nudge-cooldown', resetNudgeCooldown);

// Task & Group Management
router.post('/tasks/:taskId/visibility', updateTaskVisibility);
router.post('/tasks/:taskId/recover', adminRecoverGroupTask);
router.post('/groups/:groupId/manage-member', adminManageGroupMember);
router.post('/completions/:completionId/moderate', adminModerateStudyNote);

// High-Risk Sensitive Operations (Requires Sensitive PIN confirmation)
router.delete('/users/:userId', requireSensitiveAuth, deleteUserAccountByAdmin);

export default router;

