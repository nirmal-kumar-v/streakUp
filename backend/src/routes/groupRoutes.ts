import { Router } from 'express';
import {
  createGroup,
  joinGroup,
  getUserGroups,
  getGroupDetails,
  leaveGroup,
  getGroupLeaderboards
} from '../controllers/groupController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.post('/', createGroup);
router.post('/join', joinGroup);
router.get('/', getUserGroups);
router.get('/:id', getGroupDetails);
router.post('/:id/leave', leaveGroup);
router.get('/:id/leaderboard', getGroupLeaderboards);

export default router;
