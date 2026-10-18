import { Router } from 'express';
import {
  createGroup,
  searchGroups,
  requestToJoinGroup,
  cancelJoinRequest,
  getGroupJoinRequests,
  respondToJoinRequest,
  getUserGroups,
  getGroupDetails,
  getGroupLeaderboards,
  getGroupNotes,
  promoteMemberToAdmin,
  removeMemberFromGroup,
  leaveGroup,
} from '../controllers/groupController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/search', searchGroups);

router.post('/:id/join-request', requestToJoinGroup);
router.delete('/:id/join-request', cancelJoinRequest);

router.get('/:id/requests', getGroupJoinRequests);
router.post('/:id/requests/:requestId/respond', respondToJoinRequest);

router.get('/:id', getGroupDetails);
router.get('/:id/leaderboard', getGroupLeaderboards);
router.get('/:id/notes', getGroupNotes);

router.post('/:id/members/:targetUserId/promote', promoteMemberToAdmin);
router.delete('/:id/members/:targetUserId', removeMemberFromGroup);
router.post('/:id/leave', leaveGroup);

export default router;
