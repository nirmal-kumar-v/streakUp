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
exports.getPublicProfile = getPublicProfile;
exports.updateProfile = updateProfile;
exports.uploadProfileImage = uploadProfileImage;
exports.removeProfileImage = removeProfileImage;
exports.changePassword = changePassword;
exports.changeUsername = changeUsername;
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
 * Upload profile image (JPEG, PNG, WebP - max 5MB)
 * Supports persistent Base64 Data URI storage in PostgreSQL (zero-dependency cloud persistence)
 */
async function uploadProfileImage(req, res) {
    try {
        const userId = req.user.userId;
        const { imageBase64 } = req.body;
        if (!imageBase64 || typeof imageBase64 !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Please select an image file to upload.'
            });
        }
        // Validate Data URI format and MIME type: jpeg, png, webp
        const match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
        if (!match) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported image format. Allowed formats are JPEG, PNG, and WebP.'
            });
        }
        const mimeType = match[1].toLowerCase();
        const base64Data = match[2];
        // Check size limit: max 5MB (Base64 string ~ 7MB)
        const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
        const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
        if (sizeInBytes > MAX_SIZE_BYTES) {
            return res.status(400).json({
                success: false,
                error: `File size exceeds the 5 MB limit. Your file is ${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB.`
            });
        }
        // Validate minimum content size (empty or corrupt images)
        if (sizeInBytes < 64) {
            return res.status(400).json({
                success: false,
                error: 'The uploaded file is empty or corrupted.'
            });
        }
        // Save persistent image data in PostgreSQL
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { profileImage: imageBase64 },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
                updatedAt: true
            }
        });
        return res.json({
            success: true,
            message: 'Profile image updated successfully.',
            profileImage: updatedUser.profileImage,
            user: updatedUser
        });
    }
    catch (err) {
        console.error('uploadProfileImage error:', err);
        return res.status(500).json({ success: false, error: 'Failed to upload profile image.' });
    }
}
/**
 * Remove profile image
 */
async function removeProfileImage(req, res) {
    try {
        const userId = req.user.userId;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { profileImage: null },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true
            }
        });
        return res.json({
            success: true,
            message: 'Profile image removed.',
            profileImage: null,
            user: updatedUser
        });
    }
    catch (err) {
        console.error('removeProfileImage error:', err);
        return res.status(500).json({ success: false, error: 'Failed to remove profile image.' });
    }
}
/**
 * Change Password
 */
async function changePassword(req, res) {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Both current password and new password are required.'
            });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 8 characters long.'
            });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // Verify current password
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect.'
            });
        }
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });
        return res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    }
    catch (err) {
        console.error('changePassword error:', err);
        return res.status(500).json({ success: false, error: 'Failed to change password.' });
    }
}
/**
 * Change Username (case-insensitive uniqueness check, once every 14 days limit)
 */
async function changeUsername(req, res) {
    try {
        const userId = req.user.userId;
        const { newUsername } = req.body;
        if (!newUsername || typeof newUsername !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'New username is required.'
            });
        }
        const trimmedUsername = newUsername.trim();
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
            return res.status(400).json({
                success: false,
                error: 'Username must be between 3 and 30 characters and contain only letters, numbers, and underscores.'
            });
        }
        const normalizedNew = trimmedUsername.toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                normalizedUsername: true,
                lastUsernameChangeAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // If username is unchanged
        if (user.normalizedUsername === normalizedNew) {
            return res.status(400).json({
                success: false,
                error: 'New username is the same as your current username.'
            });
        }
        // Check 14-day rate limit
        if (user.lastUsernameChangeAt) {
            const now = new Date();
            const diffMs = now.getTime() - new Date(user.lastUsernameChangeAt).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays < 14) {
                const remainingDays = Math.ceil(14 - diffDays);
                return res.status(400).json({
                    success: false,
                    error: `Username can only be changed once every 14 days. You can change your username in ${remainingDays} day${remainingDays > 1 ? 's' : ''}.`
                });
            }
        }
        // Check if new username is already taken
        const existing = await prisma_1.default.user.findUnique({
            where: { normalizedUsername: normalizedNew }
        });
        if (existing && existing.id !== userId) {
            return res.status(400).json({
                success: false,
                error: `@${trimmedUsername} is already taken. Please choose another username.`
            });
        }
        // Update username, normalizedUsername, and timestamp
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                username: trimmedUsername,
                normalizedUsername: normalizedNew,
                lastUsernameChangeAt: new Date()
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                profileImage: true,
                timezone: true,
                currentStreak: true,
                longestStreak: true,
                lastUsernameChangeAt: true
            }
        });
        return res.json({
            success: true,
            message: 'Username changed successfully.',
            user: updatedUser
        });
    }
    catch (err) {
        console.error('changeUsername error:', err);
        return res.status(500).json({ success: false, error: 'Failed to change username.' });
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
