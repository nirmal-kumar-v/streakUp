import { Router } from 'express';
import {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendsList,
  removeFriend
} from '../controllers/friendController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// All friend routes require authentication
router.use(requireAuth);

router.get('/search', searchUsers);
router.get('/list', getFriendsList);
router.get('/requests', getFriendRequests);
router.post('/request', sendFriendRequest);
router.post('/requests/:requestId/accept', acceptFriendRequest);
router.post('/requests/:requestId/reject', rejectFriendRequest);
router.delete('/requests/:requestId/cancel', cancelFriendRequest);
router.delete('/:friendUserId', removeFriend);

export default router;
