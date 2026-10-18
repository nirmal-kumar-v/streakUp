"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const adminAuthMiddleware_1 = require("../middleware/adminAuthMiddleware");
const router = (0, express_1.Router)();
// Public Admin Auth
router.post('/login', adminController_1.adminLogin);
// Protected Super Admin Endpoints
router.use(adminAuthMiddleware_1.requireAdminAuth);
router.get('/me', adminController_1.getAdminProfile);
router.post('/change-credentials', adminController_1.changeAdminCredentials);
router.get('/audit-logs', adminController_1.getAdminAuditLogs);
// User Inspection & Search
router.get('/users', adminController_1.searchUsersForAdmin);
router.get('/users/:userId', adminController_1.getUserDetailsForAdmin);
// Privileged Overrides & Controls
router.post('/users/:userId/override-username-cooldown', adminController_1.overrideUsernameCooldown);
router.post('/users/:userId/correct-streak', adminController_1.correctStreaks);
router.post('/users/:userId/adjust-freezes', adminController_1.adjustFreezes);
router.post('/users/:userId/adjust-points', adminController_1.adjustPoints);
router.post('/users/:userId/override-starred-limit', adminController_1.overrideLimit15);
// High-Risk Sensitive Operations (Requires Sensitive PIN confirmation)
router.delete('/users/:userId', adminAuthMiddleware_1.requireSensitiveAuth, adminController_1.deleteUserAccountByAdmin);
exports.default = router;
