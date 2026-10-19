import { Router } from 'express';
import { submitRequest } from '../controllers/userRequestController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Submit a new request or feedback (Authenticated user)
router.post('/', requireAuth, submitRequest);

export default router;
