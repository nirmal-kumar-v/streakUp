import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  searchGroups,
  requestToJoinGroup,
  cancelJoinRequest,
  getGroupJoinRequests,
  getAllOwnerJoinRequests,
  respondToJoinRequest,
  inviteToGroup,
  getUserGroupInvitations,
  respondToGroupInvitation,
  makeGroupTask,
  removeGroupTask,
  getUserGroups,
  getGroupDetails,
  getGroupLeaderboards,
  getGroupNotes,
  promoteMemberToAdmin,
  removeMemberFromGroup,
  leaveGroup,
  updateMemberGroupPrivacy,
} from '../controllers/groupController';
import {
  getLinkedInGames,
  getSingleLinkedInGame,
  completeLinkedInGame,
  uncompleteLinkedInGame,
  getLinkedInGameLeaderboard,
  setLinkedInGameCommitment,
} from '../controllers/linkedInGameController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/search', searchGroups);

// Global group requests and invitations across user's groups
router.get('/all-requests', getAllOwnerJoinRequests);
router.get('/invitations', getUserGroupInvitations);
router.post('/invitations/:invitationId/respond', respondToGroupInvitation);

// Group-specific actions
router.get('/:id', getGroupDetails);
router.put('/:id', updateGroup);
router.put('/:id/member-privacy', updateMemberGroupPrivacy);
router.post('/:id/join-request', requestToJoinGroup);
router.delete('/:id/join-request', cancelJoinRequest);

router.get('/:id/requests', getGroupJoinRequests);
router.post('/:id/requests/:requestId/respond', respondToJoinRequest);
router.post('/:id/invite', inviteToGroup);
router.post('/:id/make-task', makeGroupTask);
router.delete('/:id/task', removeGroupTask);

router.get('/:id/leaderboard', getGroupLeaderboards);
router.get('/:id/notes', getGroupNotes);

// LinkedIn Group Dedicated Games Hub & Leaderboards
router.get('/:id/linkedin-games', getLinkedInGames);
router.get('/:id/linkedin-games/:gameId', getSingleLinkedInGame);
router.post('/:id/linkedin-games/:gameId/complete', completeLinkedInGame);
router.post('/:id/linkedin-games/:gameId/uncomplete', uncompleteLinkedInGame);
router.put('/:id/linkedin-games/:gameId/commitment', setLinkedInGameCommitment);
router.get('/:id/linkedin-games/:gameId/leaderboard', getLinkedInGameLeaderboard);

router.post('/:id/members/:targetUserId/promote', promoteMemberToAdmin);
router.delete('/:id/members/:targetUserId', removeMemberFromGroup);
router.post('/:id/leave', leaveGroup);

export default router;
