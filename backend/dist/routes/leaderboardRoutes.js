"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaderboardController_1 = require("../controllers/leaderboardController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Global leaderboard is public (with optional auth to highlight current user)
router.get('/global', authMiddleware_1.optionalAuth, leaderboardController_1.getGlobalLeaderboard);
// Friends leaderboard requires authentication
router.get('/friends', authMiddleware_1.requireAuth, leaderboardController_1.getFriendsLeaderboard);
exports.default = router;
