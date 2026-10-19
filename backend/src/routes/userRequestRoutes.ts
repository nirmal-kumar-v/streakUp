import { Router } from 'express';
import {
  submitRequest,
  checkManagerStatus,
  replyRequestAsManager,
} from '../controllers/userRequestController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Check if authenticated user is manager
router.get('/manager-check', requireAuth, checkManagerStatus);

// Submit a new request or feedback (Public or Authenticated)
router.post('/', optionalAuth, submitRequest);
router.post('/public', optionalAuth, submitRequest);

// Reply to a request or feedback (Manager only)
router.post('/:id/reply', requireAuth, replyRequestAsManager);

export default router;
