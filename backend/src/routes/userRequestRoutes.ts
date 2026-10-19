import { Router } from 'express';
import {
  submitRequest,
  checkManagerStatus,
  replyRequestAsManager,
} from '../controllers/userRequestController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Check if authenticated user is manager
router.get('/manager-check', requireAuth, checkManagerStatus);

// Submit a new request or feedback (Authenticated user)
router.post('/', requireAuth, submitRequest);

// Reply to a request or feedback (Manager only)
router.post('/:id/reply', requireAuth, replyRequestAsManager);

export default router;
