import { Router } from 'express';
import { toggleReaction, getReactions } from '../controllers/reactionController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.post('/:completionId', toggleReaction);
router.get('/:completionId', getReactions);

export default router;
