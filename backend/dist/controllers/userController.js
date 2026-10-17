"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProfile = getPublicProfile;
exports.updateProfile = updateProfile;
exports.getTimezones = getTimezones;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const streakService_1 = require("../services/streakService");
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(50).optional(),
    profileImage: zod_1.z.string().max(500).optional().nullable(),
    timezone: zod_1.z.string().optional(),
});
/**
 * Get public profile by username
 */
async function getPublicProfile(req, res) {
    try {
        const { username } = req.params;
        const currentUserId = req.user?.userId;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required.' });
        }
        const normalizedUsername = username.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { normalizedUsername },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
                currentStreak: true,
                longestStreak: true,
                createdAt: true,
                _count: {
                    select: {
                        taskCompletions: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: `User @${username} not found.` });
        }
        // Determine relationship status relative to current user
        let relationshipStatus = 'NONE';
        let requestId = null;
        if (currentUserId) {
            if (currentUserId === user.id) {
                relationshipStatus = 'SELF';
            }
            else {
                const [u1, u2] = currentUserId < user.id ? [currentUserId, user.id] : [user.id, currentUserId];
                const friendship = await prisma_1.default.friendship.findUnique({
                    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
                });
                if (friendship) {
                    relationshipStatus = 'FRIENDS';
                }
                else {
                    const sent = await prisma_1.default.friendRequest.findFirst({
                        where: { senderId: currentUserId, receiverId: user.id, status: 'PENDING' }
                    });
                    if (sent) {
                        relationshipStatus = 'REQUEST_SENT';
                        requestId = sent.id;
                    }
                    else {
                        const received = await prisma_1.default.friendRequest.findFirst({
                            where: { senderId: user.id, receiverId: currentUserId, status: 'PENDING' }
                        });
                        if (received) {
                            relationshipStatus = 'REQUEST_RECEIVED';
                            requestId = received.id;
                        }
                    }
                }
            }
        }
        return res.json({
            success: true,
            profile: {
                id: user.id,
                name: user.name,
                username: user.username,
                profileImage: user.profileImage,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                totalCompletedTasks: user._count.taskCompletions,
                memberSince: user.createdAt,
                relationshipStatus,
                requestId
            }
        });
    }
    catch (err) {
        console.error('getPublicProfile error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve public profile.' });
    }
}
/**
 * Update user settings (display name, avatar, timezone)
 */
async function updateProfile(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = updateProfileSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid profile settings data'
            });
        }
        const { name, profileImage, timezone } = parseResult.data;
        const updateData = {};
        if (name !== undefined) {
            updateData.name = name.trim();
        }
        if (profileImage !== undefined) {
            updateData.profileImage = profileImage;
        }
        if (timezone !== undefined) {
            if (!(0, timezoneService_1.isValidTimezone)(timezone)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid timezone identifier: ${timezone}`
                });
            }
            updateData.timezone = timezone;
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                timezone: true,
                profileImage: true,
                currentStreak: true,
                longestStreak: true,
                createdAt: true,
            }
        });
        // If timezone changed, recalculate streak with new timezone boundaries
        if (timezone) {
            await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, timezone);
        }
        return res.json({
            success: true,
            message: 'Profile settings updated successfully.',
            user: updatedUser
        });
    }
    catch (err) {
        console.error('updateProfile error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update profile settings.' });
    }
}
/**
 * Get supported timezones
 */
async function getTimezones(_req, res) {
    return res.json({
        success: true,
        timezones: timezoneService_1.SUPPORTED_TIMEZONES,
        defaultTimezone: timezoneService_1.DEFAULT_TIMEZONE
    });
}
