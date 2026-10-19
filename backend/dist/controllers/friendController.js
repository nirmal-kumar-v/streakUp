"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchUsers = searchUsers;
exports.sendFriendRequest = sendFriendRequest;
exports.getFriendRequests = getFriendRequests;
exports.acceptFriendRequest = acceptFriendRequest;
exports.rejectFriendRequest = rejectFriendRequest;
exports.cancelFriendRequest = cancelFriendRequest;
exports.getFriendsList = getFriendsList;
exports.removeFriend = removeFriend;
exports.nudgeFriend = nudgeFriend;
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
/**
 * Helper to ensure canonical ordering for Friendship table
 */
function getCanonicalPair(userIdA, userIdB) {
    return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}
/**
 * Search users by username (safe search without private info)
 */
async function searchUsers(req, res) {
    try {
        const currentUserId = req.user.userId;
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!query || query.length < 1) {
            return res.json({ success: true, users: [] });
        }
        const normalizedQuery = query.toLowerCase();
        // Find users whose username or name starts with query (strict prefix search)
        const matchingUsers = await prisma_1.default.user.findMany({
            where: {
                OR: [
                    { normalizedUsername: { startsWith: normalizedQuery } },
                    { username: { startsWith: normalizedQuery, mode: 'insensitive' } },
                    { name: { startsWith: normalizedQuery, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
                currentStreak: true,
                longestStreak: true,
            },
            take: 20
        });
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const activeUsers = matchingUsers.filter((u) => !isAccountDeleted(u.id).isDeleted);
        // Check relationship status for each user relative to current user
        const usersWithStatus = await Promise.all(activeUsers.map(async (target) => {
            if (target.id === currentUserId) {
                return { ...target, status: 'SELF' };
            }
            const [u1, u2] = getCanonicalPair(currentUserId, target.id);
            const friendship = await prisma_1.default.friendship.findUnique({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
            });
            if (friendship) {
                return { ...target, status: 'FRIENDS' };
            }
            // Check if pending request exists
            const sentRequest = await prisma_1.default.friendRequest.findFirst({
                where: {
                    senderId: currentUserId,
                    receiverId: target.id,
                    status: 'PENDING'
                }
            });
            if (sentRequest) {
                return { ...target, status: 'REQUEST_SENT', requestId: sentRequest.id };
            }
            const receivedRequest = await prisma_1.default.friendRequest.findFirst({
                where: {
                    senderId: target.id,
                    receiverId: currentUserId,
                    status: 'PENDING'
                }
            });
            if (receivedRequest) {
                return { ...target, status: 'REQUEST_RECEIVED', requestId: receivedRequest.id };
            }
            return { ...target, status: 'NONE' };
        }));
        return res.json({
            success: true,
            users: usersWithStatus
        });
    }
    catch (err) {
        console.error('searchUsers error:', err);
        return res.status(500).json({ success: false, error: 'User search failed.' });
    }
}
/**
 * Send a friend request
 */
async function sendFriendRequest(req, res) {
    try {
        const senderId = req.user.userId;
        const { targetUserId } = req.body;
        if (!targetUserId || typeof targetUserId !== 'string') {
            return res.status(400).json({ success: false, error: 'Target user ID is required.' });
        }
        if (senderId === targetUserId) {
            return res.status(400).json({ success: false, error: 'You cannot send a friend request to yourself.' });
        }
        // Verify target user exists
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true }
        });
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'Target user does not exist.' });
        }
        // Check if already friends
        const [u1, u2] = getCanonicalPair(senderId, targetUserId);
        const existingFriendship = await prisma_1.default.friendship.findUnique({
            where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
        });
        if (existingFriendship) {
            return res.status(400).json({ success: false, error: 'You are already friends with this user.' });
        }
        // Check if reverse request is pending from target user -> auto-accept
        const incomingPending = await prisma_1.default.friendRequest.findFirst({
            where: {
                senderId: targetUserId,
                receiverId: senderId,
                status: 'PENDING'
            }
        });
        if (incomingPending) {
            // Auto-accept the reciprocal request
            await prisma_1.default.$transaction([
                prisma_1.default.friendRequest.update({
                    where: { id: incomingPending.id },
                    data: { status: 'ACCEPTED' }
                }),
                prisma_1.default.friendship.create({
                    data: { user1Id: u1, user2Id: u2 }
                })
            ]);
            return res.json({
                success: true,
                message: `Accepted existing request from @${targetUser.username}! You are now friends.`,
                status: 'FRIENDS'
            });
        }
        // Check if request already sent
        const existingRequest = await prisma_1.default.friendRequest.findFirst({
            where: {
                senderId,
                receiverId: targetUserId
            }
        });
        if (existingRequest) {
            if (existingRequest.status === 'PENDING') {
                return res.status(400).json({ success: false, error: 'Friend request already pending.' });
            }
            // Re-open if previously rejected or cancelled
            const updated = await prisma_1.default.friendRequest.update({
                where: { id: existingRequest.id },
                data: { status: 'PENDING', updatedAt: new Date() }
            });
            return res.json({
                success: true,
                message: `Friend request sent to @${targetUser.username}.`,
                request: updated
            });
        }
        // Create new request
        const request = await prisma_1.default.friendRequest.create({
            data: {
                senderId,
                receiverId: targetUserId,
                status: 'PENDING'
            }
        });
        return res.status(201).json({
            success: true,
            message: `Friend request sent to @${targetUser.username}.`,
            request
        });
    }
    catch (err) {
        console.error('sendFriendRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to send friend request.' });
    }
}
/**
 * Get received and sent friend requests
 */
async function getFriendRequests(req, res) {
    try {
        const userId = req.user.userId;
        const [received, sent] = await Promise.all([
            prisma_1.default.friendRequest.findMany({
                where: {
                    receiverId: userId,
                    status: 'PENDING'
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profileImage: true,
                            currentStreak: true,
                            longestStreak: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.friendRequest.findMany({
                where: {
                    senderId: userId,
                    status: 'PENDING'
                },
                include: {
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profileImage: true,
                            currentStreak: true,
                            longestStreak: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const activeReceived = received.filter((r) => !isAccountDeleted(r.sender.id).isDeleted);
        const activeSent = sent.filter((s) => !isAccountDeleted(s.receiver.id).isDeleted);
        return res.json({
            success: true,
            received: activeReceived,
            sent: activeSent,
            pendingCount: activeReceived.length
        });
    }
    catch (err) {
        console.error('getFriendRequests error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve friend requests.' });
    }
}
/**
 * Accept a friend request
 */
async function acceptFriendRequest(req, res) {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;
        const request = await prisma_1.default.friendRequest.findUnique({
            where: { id: requestId }
        });
        if (!request || request.receiverId !== userId || request.status !== 'PENDING') {
            return res.status(404).json({ success: false, error: 'Friend request not found or already handled.' });
        }
        const [u1, u2] = getCanonicalPair(request.senderId, request.receiverId);
        // Update request status and insert friendship in a transaction
        await prisma_1.default.$transaction([
            prisma_1.default.friendRequest.update({
                where: { id: requestId },
                data: { status: 'ACCEPTED' }
            }),
            prisma_1.default.friendship.upsert({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
                update: {},
                create: { user1Id: u1, user2Id: u2 }
            })
        ]);
        return res.json({
            success: true,
            message: 'Friend request accepted!'
        });
    }
    catch (err) {
        console.error('acceptFriendRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to accept friend request.' });
    }
}
/**
 * Reject a friend request
 */
async function rejectFriendRequest(req, res) {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;
        const request = await prisma_1.default.friendRequest.findUnique({
            where: { id: requestId }
        });
        if (!request || request.receiverId !== userId) {
            return res.status(404).json({ success: false, error: 'Friend request not found.' });
        }
        await prisma_1.default.friendRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED' }
        });
        return res.json({
            success: true,
            message: 'Friend request rejected.'
        });
    }
    catch (err) {
        console.error('rejectFriendRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to reject friend request.' });
    }
}
/**
 * Cancel a sent friend request
 */
async function cancelFriendRequest(req, res) {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;
        const request = await prisma_1.default.friendRequest.findUnique({
            where: { id: requestId }
        });
        if (!request || request.senderId !== userId) {
            return res.status(404).json({ success: false, error: 'Friend request not found.' });
        }
        await prisma_1.default.friendRequest.delete({
            where: { id: requestId }
        });
        return res.json({
            success: true,
            message: 'Friend request cancelled.'
        });
    }
    catch (err) {
        console.error('cancelFriendRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to cancel friend request.' });
    }
}
/**
 * List all accepted friends
 */
async function getFriendsList(req, res) {
    try {
        const userId = req.user.userId;
        const friendships = await prisma_1.default.friendship.findMany({
            where: {
                OR: [{ user1Id: userId }, { user2Id: userId }]
            },
            include: {
                user1: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        profileImage: true,
                        currentStreak: true,
                        longestStreak: true,
                        timezone: true
                    }
                },
                user2: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        profileImage: true,
                        currentStreak: true,
                        longestStreak: true,
                        timezone: true
                    }
                }
            }
        });
        // Map to friend objects (excluding current user and soft-deleted accounts)
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const friends = friendships
            .map(f => (f.user1Id === userId ? f.user2 : f.user1))
            .filter(f => !isAccountDeleted(f.id).isDeleted);
        // Attach today's task completion count for each friend
        const friendsWithTodayStats = await Promise.all(friends.map(async (friend) => {
            const todayDateStr = (0, timezoneService_1.getLocalDateString)(friend.timezone || 'Asia/Kolkata');
            const tasksCompletedToday = await prisma_1.default.taskCompletion.count({
                where: {
                    userId: friend.id,
                    completionDate: todayDateStr
                }
            });
            return {
                id: friend.id,
                name: friend.name,
                username: friend.username,
                profileImage: friend.profileImage,
                currentStreak: friend.currentStreak,
                longestStreak: friend.longestStreak,
                tasksCompletedToday
            };
        }));
        // Sort by current streak desc
        friendsWithTodayStats.sort((a, b) => b.currentStreak - a.currentStreak);
        return res.json({
            success: true,
            friends: friendsWithTodayStats,
            count: friendsWithTodayStats.length
        });
    }
    catch (err) {
        console.error('getFriendsList error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve friends list.' });
    }
}
/**
 * Remove an existing friend
 */
async function removeFriend(req, res) {
    try {
        const userId = req.user.userId;
        const { friendUserId } = req.params;
        const [u1, u2] = getCanonicalPair(userId, friendUserId);
        // Delete friendship
        await prisma_1.default.friendship.deleteMany({
            where: { user1Id: u1, user2Id: u2 }
        });
        // Clean up friend requests between them
        await prisma_1.default.friendRequest.deleteMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: friendUserId },
                    { senderId: friendUserId, receiverId: userId }
                ]
            }
        });
        return res.json({
            success: true,
            message: 'Friend removed successfully.'
        });
    }
    catch (err) {
        console.error('removeFriend error:', err);
        return res.status(500).json({ success: false, error: 'Failed to remove friend.' });
    }
}
/**
 * Send an in-app encouragement nudge to an accepted friend (Requirement 5)
 */
async function nudgeFriend(req, res) {
    try {
        const senderId = req.user.userId;
        const { friendUserId } = req.params;
        if (!friendUserId || senderId === friendUserId) {
            return res.status(400).json({ success: false, error: 'You cannot nudge yourself.' });
        }
        // Verify friendship exists
        const [u1, u2] = getCanonicalPair(senderId, friendUserId);
        const friendship = await prisma_1.default.friendship.findUnique({
            where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
        });
        if (!friendship) {
            return res.status(403).json({ success: false, error: 'You can only nudge accepted friends.' });
        }
        // Sender details
        const sender = await prisma_1.default.user.findUnique({
            where: { id: senderId },
            select: { name: true, username: true }
        });
        // Rate limit cooldown: check if nudged in the last 12 hours
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const recentNudge = await prisma_1.default.notification.findFirst({
            where: {
                userId: friendUserId,
                friendId: senderId,
                category: 'FRIEND_NUDGE',
                createdAt: { gte: twelveHoursAgo }
            }
        });
        if (recentNudge) {
            return res.status(429).json({
                success: false,
                error: 'You have already nudged this friend recently. Please wait before nudging again!'
            });
        }
        // Create in-app notification (In-app only, NO email!)
        const notification = await prisma_1.default.notification.create({
            data: {
                userId: friendUserId,
                friendId: senderId,
                category: 'FRIEND_NUDGE',
                title: 'Streak Nudge 🔥',
                message: `${sender?.name || 'Your friend'} nudged you to keep your streak going!`,
                actionUrl: '/dashboard',
                eventKey: `NUDGE:${senderId}:${friendUserId}:${Date.now()}`
            }
        });
        return res.json({
            success: true,
            message: 'Nudge sent successfully! Your friend will see it in their notification center.',
            notificationId: notification.id
        });
    }
    catch (err) {
        console.error('nudgeFriend error:', err);
        return res.status(500).json({ success: false, error: 'Failed to send nudge.' });
    }
}
