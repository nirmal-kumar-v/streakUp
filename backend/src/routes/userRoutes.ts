import { Router } from 'express';
import {
  getPublicProfile,
  updateProfile,
  getTimezones,
  uploadProfileImage,
  removeProfileImage,
  changePassword,
  changeUsername
} from '../controllers/userController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Public timezones list
router.get('/timezones', getTimezones);

// Public profile lookup with optional auth for friendship context
router.get('/profile/:username', optionalAuth, getPublicProfile);

// Authenticated settings update
router.put('/profile', requireAuth, updateProfile);

// Profile image upload and removal
router.post('/profile-image', requireAuth, uploadProfileImage);
router.delete('/profile-image', requireAuth, removeProfileImage);

// Account security updates
router.post('/change-password', requireAuth, changePassword);
router.post('/change-username', requireAuth, changeUsername);

export default router;

