"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public timezones list
router.get('/timezones', userController_1.getTimezones);
// Public profile lookup with optional auth for friendship context
router.get('/profile/:username', authMiddleware_1.optionalAuth, userController_1.getPublicProfile);
// Authenticated settings update
router.put('/profile', authMiddleware_1.requireAuth, userController_1.updateProfile);
// Profile image upload and removal
router.post('/profile-image', authMiddleware_1.requireAuth, userController_1.uploadProfileImage);
router.delete('/profile-image', authMiddleware_1.requireAuth, userController_1.removeProfileImage);
// Account security updates
router.post('/change-password', authMiddleware_1.requireAuth, userController_1.changePassword);
router.post('/change-username', authMiddleware_1.requireAuth, userController_1.changeUsername);
// 14-day rate limited registered email change
router.get('/email-change-status', authMiddleware_1.requireAuth, userController_1.getEmailChangeStatus);
router.post('/change-email/request', authMiddleware_1.requireAuth, userController_1.requestChangeEmail);
router.post('/change-email/verify', authMiddleware_1.requireAuth, userController_1.verifyChangeEmail);
// Permanent Account Deletion (Requirement 4)
router.delete('/account', authMiddleware_1.requireAuth, userController_1.deleteAccount);
exports.default = router;
