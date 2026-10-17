"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const friendController_1 = require("../controllers/friendController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All friend routes require authentication
router.use(authMiddleware_1.requireAuth);
router.get('/search', friendController_1.searchUsers);
router.get('/list', friendController_1.getFriendsList);
router.get('/requests', friendController_1.getFriendRequests);
router.post('/request', friendController_1.sendFriendRequest);
router.post('/requests/:requestId/accept', friendController_1.acceptFriendRequest);
router.post('/requests/:requestId/reject', friendController_1.rejectFriendRequest);
router.delete('/requests/:requestId/cancel', friendController_1.cancelFriendRequest);
router.delete('/:friendUserId', friendController_1.removeFriend);
exports.default = router;
