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
exports.getEmailChangeStatus = getEmailChangeStatus;
exports.requestChangeEmail = requestChangeEmail;
exports.verifyChangeEmail = verifyChangeEmail;
exports.deleteAccount = deleteAccount;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const streakService_1 = require("../services/streakService");
const client_1 = require("@prisma/client");
const otpService_1 = require("../services/otpService");
const emailService_1 = require("../services/emailService");
const adminConfigService_1 = require("../services/adminConfigService");
const imageValidator_1 = require("../utils/imageValidator");
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
                points: true,
                createdAt: true,
                _count: {
                    select: {
                        taskCompletions: true,
                        friendshipsAsUser1: true,
                        friendshipsAsUser2: true,
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
        const connectionsCount = (user._count?.friendshipsAsUser1 || 0) + (user._count?.friendshipsAsUser2 || 0);
        return res.json({
            success: true,
            profile: {
                id: user.id,
                name: user.name,
                username: user.username,
                profileImage: user.profileImage,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                points: user.points ?? 0,
                totalCompletedTasks: user._count.taskCompletions,
                connectionsCount,
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
        const buffer = Buffer.from(base64Data, 'base64');
        const sizeInBytes = buffer.length;
        const limitMb = (0, adminConfigService_1.getUserProfileImageLimitMb)(userId);
        const MAX_SIZE_BYTES = limitMb * 1024 * 1024;
        if (sizeInBytes > MAX_SIZE_BYTES) {
            return res.status(400).json({
                success: false,
                error: `File size exceeds your ${limitMb} MB limit. Your file is ${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB.`
            });
        }
        // Validate image file content, magic bytes, dimensions, and integrity
        const validation = (0, imageValidator_1.validateImageBuffer)(buffer, mimeType);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error || 'The uploaded file is empty or corrupted.'
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
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect.'
            });
        }
        // Hash new password
        const salt = await bcryptjs_1.default.genSalt(10);
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, salt);
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
/**
 * Get 14-day email change status and next allowed change date
 */
async function getEmailChangeStatus(req, res) {
    try {
        const userId = req.user.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { email: true, emailLastChangedAt: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        let canChangeNow = true;
        let nextAllowedChangeDate = null;
        let daysRemaining = 0;
        if (user.emailLastChangedAt) {
            const msElapsed = Date.now() - new Date(user.emailLastChangedAt).getTime();
            if (msElapsed < FOURTEEN_DAYS_MS) {
                canChangeNow = false;
                nextAllowedChangeDate = new Date(new Date(user.emailLastChangedAt).getTime() + FOURTEEN_DAYS_MS);
                daysRemaining = Math.ceil((FOURTEEN_DAYS_MS - msElapsed) / (24 * 60 * 60 * 1000));
            }
        }
        return res.json({
            success: true,
            currentEmail: user.email,
            emailLastChangedAt: user.emailLastChangedAt,
            canChangeNow,
            nextAllowedChangeDate,
            daysRemaining,
        });
    }
    catch (err) {
        console.error('getEmailChangeStatus error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve email change status.' });
    }
}
const requestChangeEmailSchema = zod_1.z.object({
    newEmail: zod_1.z.string().email('Please enter a valid new email address'),
});
/**
 * Request OTP to change registered email:
 * Enforces 14-day restriction, validates uniqueness, and sends plain-text OTP to the new email.
 */
async function requestChangeEmail(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = requestChangeEmailSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid new email address',
            });
        }
        const cleanNewEmail = parseResult.data.newEmail.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        if (cleanNewEmail === user.email.toLowerCase()) {
            return res.status(400).json({
                success: false,
                error: 'The new email address cannot be the same as your current registered email.',
            });
        }
        // Check 14-day restriction
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        if (user.emailLastChangedAt) {
            const msElapsed = Date.now() - new Date(user.emailLastChangedAt).getTime();
            if (msElapsed < FOURTEEN_DAYS_MS) {
                const nextDate = new Date(new Date(user.emailLastChangedAt).getTime() + FOURTEEN_DAYS_MS);
                const daysRemaining = Math.ceil((FOURTEEN_DAYS_MS - msElapsed) / (24 * 60 * 60 * 1000));
                return res.status(400).json({
                    success: false,
                    error: `You can only change your registered email once every 14 days. You can next change it on ${nextDate.toISOString().split('T')[0]} (in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}).`,
                    nextAllowedChangeDate: nextDate,
                    daysRemaining,
                });
            }
        }
        // Check if new email is already in use by another user
        const existing = await prisma_1.default.user.findUnique({
            where: { email: cleanNewEmail },
        });
        if (existing && existing.id !== userId) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email address already exists. Please choose a different email.',
            });
        }
        // Generate and store OTP
        const otpResult = await (0, otpService_1.createEmailOtp)({
            email: cleanNewEmail,
            purpose: client_1.OtpPurpose.CHANGE_REGISTERED_EMAIL,
            userId: user.id,
            targetData: cleanNewEmail,
        });
        if (!otpResult.success) {
            return res.status(429).json({
                success: false,
                error: otpResult.error,
                retryAfterSeconds: otpResult.retryAfterSeconds,
            });
        }
        // Dispatch plain-text verification email to the new address
        const emailData = (0, emailService_1.buildChangeEmailOtpEmail)({
            name: user.name,
            newEmail: cleanNewEmail,
            otp: otpResult.otp,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: cleanNewEmail,
            category: client_1.NotificationCategory.SYSTEM,
            subject: emailData.subject,
            text: emailData.text,
            idempotencyKey: `CHANGE_EMAIL_OTP:${user.id}:${Date.now()}`,
        });
        return res.json({
            success: true,
            message: `A 6-digit verification code has been sent to ${cleanNewEmail}. Please enter the code to confirm the change.`,
            newEmail: cleanNewEmail,
        });
    }
    catch (err) {
        console.error('requestChangeEmail error:', err);
        return res.status(500).json({ success: false, error: 'Failed to request email change.' });
    }
}
const verifyChangeEmailSchema = zod_1.z.object({
    newEmail: zod_1.z.string().email('Please enter a valid new email address'),
    otp: zod_1.z.string().min(6).max(6, '6-digit OTP code required'),
});
/**
 * Verify OTP to complete registered email change:
 * Sets the new email and updates emailLastChangedAt to current timestamp.
 */
async function verifyChangeEmail(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = verifyChangeEmailSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid verification data',
            });
        }
        const { newEmail, otp } = parseResult.data;
        const cleanNewEmail = newEmail.trim().toLowerCase();
        // Verify OTP
        const verification = await (0, otpService_1.verifyEmailOtp)({
            email: cleanNewEmail,
            purpose: client_1.OtpPurpose.CHANGE_REGISTERED_EMAIL,
            otp,
            userId,
        });
        if (!verification.success) {
            return res.status(400).json({
                success: false,
                error: verification.error,
                maxAttemptsExceeded: verification.maxAttemptsExceeded,
            });
        }
        // Double-check 14-day rule
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        if (user.emailLastChangedAt) {
            const msElapsed = Date.now() - new Date(user.emailLastChangedAt).getTime();
            if (msElapsed < FOURTEEN_DAYS_MS) {
                return res.status(400).json({
                    success: false,
                    error: 'Email change cannot be completed because the 14-day restriction is currently in effect.',
                });
            }
        }
        // Double-check uniqueness
        const conflict = await prisma_1.default.user.findUnique({ where: { email: cleanNewEmail } });
        if (conflict && conflict.id !== userId) {
            return res.status(409).json({
                success: false,
                error: 'This email address is already in use by another account.',
            });
        }
        // Update user registered email and record timestamp, ensuring verified status
        const now = new Date();
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                email: cleanNewEmail,
                isEmailVerified: true,
                emailLastChangedAt: now,
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                emailLastChangedAt: true,
                isEmailVerified: true,
            },
        });
        // Reset customNotificationEmail so all future notifications seamlessly route to the new verified registered email
        await prisma_1.default.notificationPreference.updateMany({
            where: { userId },
            data: {
                customNotificationEmail: null,
                isCustomEmailVerified: false,
            },
        });
        return res.json({
            success: true,
            message: 'Your registered email address has been updated successfully.',
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('verifyChangeEmail error:', err);
        return res.status(500).json({ success: false, error: 'Failed to verify email change.' });
    }
}
const deleteAccountSchema = zod_1.z.object({
    confirmation: zod_1.z.string().refine((val) => val === 'DELETE', {
        message: 'You must type DELETE to confirm account deletion'
    }),
    password: zod_1.z.string().optional()
});
/**
 * Permanently and irreversibly deletes the user account and all personal data (Requirement 4).
 * Handles group ownership transfers cleanly, and cascades all user data.
 */
async function deleteAccount(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = deleteAccountSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Please type DELETE to confirm'
            });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedGroups: {
                    include: {
                        members: {
                            where: { userId: { not: userId } },
                            orderBy: { joinedAt: 'asc' }
                        }
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // If password provided, verify it
        if (parseResult.data.password && user.passwordHash) {
            const isValid = await bcryptjs_1.default.compare(parseResult.data.password, user.passwordHash);
            if (!isValid) {
                return res.status(401).json({ success: false, error: 'Incorrect password entered.' });
            }
        }
        // Soft-delete account: preserve records for 10-day admin recovery window
        const { recordAccountDeletion } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        await recordAccountDeletion({
            userId,
            username: user.username,
            name: user.name,
            email: user.email,
            deletedBy: 'USER',
            reason: 'Deleted by user in settings',
        });
        // Clear any auth cookies if present
        res.clearCookie('token');
        res.clearCookie('jwt');
        return res.json({
            success: true,
            message: 'Your account has been deleted. An admin can recover your account within 10 days.',
        });
    }
    catch (err) {
        console.error('deleteAccount error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete account.' });
    }
}
