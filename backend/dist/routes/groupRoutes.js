"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const groupController_1 = require("../controllers/groupController");
const linkedInGameController_1 = require("../controllers/linkedInGameController");
const duolingoController_1 = require("../controllers/duolingoController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.requireAuth);
router.post('/', groupController_1.createGroup);
router.get('/', groupController_1.getUserGroups);
router.get('/search', groupController_1.searchGroups);
// Global group requests and invitations across user's groups
router.get('/all-requests', groupController_1.getAllOwnerJoinRequests);
router.get('/invitations', groupController_1.getUserGroupInvitations);
router.post('/invitations/:invitationId/respond', groupController_1.respondToGroupInvitation);
// Group-specific actions
router.get('/:id', groupController_1.getGroupDetails);
router.put('/:id', groupController_1.updateGroup);
router.put('/:id/member-privacy', groupController_1.updateMemberGroupPrivacy);
router.patch('/:id/commitment', groupController_1.updateMemberGroupCommitment);
router.put('/:id/commitment', groupController_1.updateMemberGroupCommitment);
router.post('/:id/join-request', groupController_1.requestToJoinGroup);
router.delete('/:id/join-request', groupController_1.cancelJoinRequest);
router.get('/:id/requests', groupController_1.getGroupJoinRequests);
router.post('/:id/requests/:requestId/respond', groupController_1.respondToJoinRequest);
router.post('/:id/invite', groupController_1.inviteToGroup);
router.post('/:id/make-task', groupController_1.makeGroupTask);
router.delete('/:id/task', groupController_1.removeGroupTask);
router.get('/:id/leaderboard', groupController_1.getGroupLeaderboards);
router.get('/:id/notes', groupController_1.getGroupNotes);
// Generic Special Groups (LeetCode, GeeksforGeeks, etc.)
router.get('/:id/special-activities', groupController_1.getGroupSpecialActivities);
router.post('/:id/special-activities/:activityType/complete', groupController_1.completeGroupSpecialActivity);
router.post('/:id/special-activities/:activityType/uncomplete', groupController_1.uncompleteGroupSpecialActivity);
// LinkedIn Group Dedicated Games Hub & Leaderboards
router.get('/:id/linkedin-games', linkedInGameController_1.getLinkedInGames);
router.get('/:id/linkedin-games/:gameId', linkedInGameController_1.getSingleLinkedInGame);
router.post('/:id/linkedin-games/:gameId/complete', linkedInGameController_1.completeLinkedInGame);
router.post('/:id/linkedin-games/:gameId/uncomplete', linkedInGameController_1.uncompleteLinkedInGame);
router.put('/:id/linkedin-games/:gameId/commitment', linkedInGameController_1.setLinkedInGameCommitment);
router.get('/:id/linkedin-games/:gameId/leaderboard', linkedInGameController_1.getLinkedInGameLeaderboard);
// Duolingo Special Group Hub
router.get('/:id/duolingo/courses', duolingoController_1.getDuolingoCourses);
router.get('/:id/duolingo/dashboard-streak', duolingoController_1.getDuolingoDashboardStreakEndpoint);
router.post('/:id/duolingo/commit', duolingoController_1.commitDuolingoCourse);
router.post('/:id/duolingo/uncommit', duolingoController_1.uncommitDuolingoCourse);
router.post('/:id/duolingo/complete-all', duolingoController_1.completeAllDuolingoCourses);
router.post('/:id/duolingo/uncomplete-all', duolingoController_1.uncompleteAllDuolingoCourses);
router.post('/:id/duolingo/courses/:courseId/complete', duolingoController_1.completeDuolingoCourse);
router.post('/:id/duolingo/courses/:courseId/uncomplete', duolingoController_1.uncompleteDuolingoCourse);
router.get('/:id/duolingo/leaderboard/:courseId', duolingoController_1.getDuolingoCourseLeaderboard);
router.post('/:id/members/:targetUserId/promote', groupController_1.promoteMemberToAdmin);
router.delete('/:id/members/:targetUserId', groupController_1.removeMemberFromGroup);
router.post('/:id/leave', groupController_1.leaveGroup);
exports.default = router;
