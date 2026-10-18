import { Router } from 'express';
import {
  adminLogin,
  getAdminProfile,
  changeAdminCredentials,
  getAdminAuditLogs,
  searchUsersForAdmin,
  getUserDetailsForAdmin,
  overrideUsernameCooldown,
  correctStreaks,
  adjustFreezes,
  adjustPoints,
  overrideLimit15,
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
router.get('/audit-logs', getAdminAuditLogs);

// User Inspection & Search
router.get('/users', searchUsersForAdmin);
router.get('/users/:userId', getUserDetailsForAdmin);

// Privileged Overrides & Controls
router.post('/users/:userId/override-username-cooldown', overrideUsernameCooldown);
router.post('/users/:userId/correct-streak', correctStreaks);
router.post('/users/:userId/adjust-freezes', adjustFreezes);
router.post('/users/:userId/adjust-points', adjustPoints);
router.post('/users/:userId/override-starred-limit', overrideLimit15);

// High-Risk Sensitive Operations (Requires Sensitive PIN confirmation)
router.delete('/users/:userId', requireSensitiveAuth, deleteUserAccountByAdmin);

export default router;
