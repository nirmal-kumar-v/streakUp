import { Router } from 'express';
import { getGlobalLeaderboard, getFriendsLeaderboard } from '../controllers/leaderboardController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Global leaderboard is public (with optional auth to highlight current user)
router.get('/global', optionalAuth, getGlobalLeaderboard);

// Friends leaderboard requires authentication
router.get('/friends', requireAuth, getFriendsLeaderboard);

export default router;
