import { Router } from 'express';
import { getPublicProfile, updateProfile, getTimezones } from '../controllers/userController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Public timezones list
router.get('/timezones', getTimezones);

// Public profile lookup with optional auth for friendship context
router.get('/profile/:username', optionalAuth, getPublicProfile);

// Authenticated settings update
router.put('/profile', requireAuth, updateProfile);

export default router;
