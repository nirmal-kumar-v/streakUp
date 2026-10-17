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
exports.default = router;
