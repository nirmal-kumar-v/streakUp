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
exports.cleanupOldAuditLogs = cleanupOldAuditLogs;
exports.dispatchAdminNotification = dispatchAdminNotification;
exports.adminLogin = adminLogin;
exports.getAdminProfile = getAdminProfile;
exports.changeAdminCredentials = changeAdminCredentials;
exports.getAdminAuditLogs = getAdminAuditLogs;
exports.deleteAdminAuditLog = deleteAdminAuditLog;
exports.clearAdminAuditLogs = clearAdminAuditLogs;
exports.searchUsersForAdmin = searchUsersForAdmin;
exports.getUserDetailsForAdmin = getUserDetailsForAdmin;
exports.overrideUsernameCooldown = overrideUsernameCooldown;
exports.correctStreaks = correctStreaks;
exports.grantDayStreak = grantDayStreak;
exports.adjustFreezes = adjustFreezes;
exports.adjustPoints = adjustPoints;
exports.overrideLimit15 = overrideLimit15;
exports.deleteUserAccountByAdmin = deleteUserAccountByAdmin;
exports.recoverUserAccount = recoverUserAccount;
exports.overrideEmailCooldown = overrideEmailCooldown;
exports.toggleUserEmailVerification = toggleUserEmailVerification;
exports.updateUserTimezone = updateUserTimezone;
exports.resetNudgeCooldown = resetNudgeCooldown;
exports.updateTaskVisibility = updateTaskVisibility;
exports.adminManageGroupMember = adminManageGroupMember;
exports.adminRecoverGroupTask = adminRecoverGroupTask;
exports.adminModerateStudyNote = adminModerateStudyNote;
exports.adminUpdateTaskFull = adminUpdateTaskFull;
exports.adminUpdateGroupFull = adminUpdateGroupFull;
exports.searchGroupsForAdmin = searchGroupsForAdmin;
exports.adminToggleGroupDiscoverability = adminToggleGroupDiscoverability;
exports.unfreezeUserDate = unfreezeUserDate;
exports.adminDeleteReminderSchedule = adminDeleteReminderSchedule;
exports.overrideLeaderboardLimit = overrideLeaderboardLimit;
exports.overrideReminderLimit = overrideReminderLimit;
exports.overrideTaskReminderLimit = overrideTaskReminderLimit;
exports.overrideDiscoverGroupsLimit = overrideDiscoverGroupsLimit;
exports.overrideProfileImageLimit = overrideProfileImageLimit;
exports.adminUpdateUserProfileImage = adminUpdateUserProfileImage;
exports.getUserReminderSettings = getUserReminderSettings;
exports.adminUpdateOverallReminders = adminUpdateOverallReminders;
exports.adminUpdateTaskReminders = adminUpdateTaskReminders;
exports.adminSendTestReminder = adminSendTestReminder;
exports.adminTriggerManualReminderCheck = adminTriggerManualReminderCheck;
exports.adminUpdateUserPreferences = adminUpdateUserPreferences;
exports.getMemberLinkedInGamesAdmin = getMemberLinkedInGamesAdmin;
exports.adminCorrectLinkedInGameStreak = adminCorrectLinkedInGameStreak;
exports.adminGrantLinkedInGameDate = adminGrantLinkedInGameDate;
exports.adminFreezeLinkedInGameDate = adminFreezeLinkedInGameDate;
exports.adminSetLinkedInGameCommitment = adminSetLinkedInGameCommitment;
exports.getManagersAdmin = getManagersAdmin;
exports.grantManagerAdmin = grantManagerAdmin;
exports.revokeManagerAdmin = revokeManagerAdmin;
exports.updateManagerEmailAdmin = updateManagerEmailAdmin;
exports.sendAdminMessage = sendAdminMessage;
exports.getAdminMessageLogsController = getAdminMessageLogsController;
exports.adminToggleGroupSpecialMode = adminToggleGroupSpecialMode;
exports.getMemberSpecialActivitiesAdmin = getMemberSpecialActivitiesAdmin;
exports.adminCorrectSpecialActivityStreak = adminCorrectSpecialActivityStreak;
exports.adminGrantSpecialActivityDate = adminGrantSpecialActivityDate;
exports.adminSetSpecialActivityCommitment = adminSetSpecialActivityCommitment;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const streakService_1 = require("../services/streakService");
const adminConfigService_1 = require("../services/adminConfigService");
const reminderSchedulerService_1 = require("../services/reminderSchedulerService");
const imageValidator_1 = require("../utils/imageValidator");
const linkedInGameService_1 = require("../services/linkedInGameService");
const managerService_1 = require("../services/managerService");
const adminMessageService_1 = require("../services/adminMessageService");
const specialGroupRegistry_1 = require("../services/specialGroupRegistry");
const specialGroupService_1 = require("../services/specialGroupService");
const JWT_SECRET = process.env.JWT_SECRET || 'streakup_super_secret_jwt_key_2026_change_in_production';
/**
 * Bootstrap or synchronize the default admin account with requested credentials
 * Username: admin
 * Password: Admin@123
 * Sensitive Password / PIN: Nirmal@31/08/2006
 */
async function ensureDefaultAdmin() {
    const defaultUsername = (process.env.ADMIN_INITIAL_USERNAME || 'admin').trim().toLowerCase();
    const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
    const defaultSensitivePin = process.env.ADMIN_SENSITIVE_PIN || 'Nirmal@31/08/2006';
    const existingAdmin = await prisma_1.default.adminAccount.findUnique({
        where: { username: defaultUsername },
    });
    if (!existingAdmin) {
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(defaultPassword, salt);
        const pinHash = await bcryptjs_1.default.hash(defaultSensitivePin, salt);
        await prisma_1.default.adminAccount.create({
            data: {
                username: defaultUsername,
                passwordHash,
                sensitivePinHash: pinHash,
                role: 'SUPER_ADMIN',
            },
        });
        console.log(`[Admin] Initial Super Admin account created: @${defaultUsername}`);
    }
}
/**
 * Automatically purges administrative audit logs older than 15 days
 */
async function cleanupOldAuditLogs() {
    try {
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        const result = await prisma_1.default.adminAuditLog.deleteMany({
            where: {
                createdAt: {
                    lt: fifteenDaysAgo,
                },
            },
        });
        if (result.count > 0) {
            console.log(`[AdminAuditLog] Cleaned up ${result.count} audit logs older than 15 days.`);
        }
        return result.count;
    }
    catch (err) {
        console.error('[AdminAuditLog] Failed to clean up old audit logs:', err);
        return 0;
    }
}
/**
 * Dispatches optional In-App and Email notifications to user about administrative adjustments
 */
async function dispatchAdminNotification(opts) {
    const { userId, actionTitle, reason, changesSummary, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = opts;
    if (!sendInApp && !shouldSendEmail)
        return;
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, username: true, email: true },
        });
        if (!user)
            return;
        const messageLines = [];
        if (includeChanges && changesSummary) {
            messageLines.push(changesSummary);
        }
        if (includeReason && reason) {
            messageLines.push(`Reason: ${reason}`);
        }
        if (messageLines.length === 0) {
            messageLines.push(`An administrative adjustment was applied to your account.`);
        }
        const fullMessage = messageLines.join('\n\n');
        const noticeTitle = `Account Notice: ${actionTitle}`;
        // 1. In-App Notification
        if (sendInApp) {
            await prisma_1.default.notification.create({
                data: {
                    userId,
                    category: client_1.NotificationCategory.SYSTEM,
                    title: noticeTitle,
                    message: fullMessage,
                },
            });
        }
        // 2. Email Notification
        if (shouldSendEmail && user.email) {
            const emailText = `Hello ${user.name || user.username},\n\nAn administrative update has been made to your StreakUp account:\n\n${fullMessage}\n\nIf you have any questions, please contact support.\n\nBest regards,\nStreakUp Administration Team`;
            await (0, emailService_1.sendEmail)({
                userId,
                recipientEmail: user.email,
                category: client_1.NotificationCategory.SYSTEM,
                subject: `[StreakUp Admin] ${noticeTitle}`,
                text: emailText,
                idempotencyKey: `admin-notice-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            });
        }
    }
    catch (err) {
        console.error('[Admin] Failed to dispatch admin notification:', err);
    }
}
/**
 * Helper to record administrative audit logs
 */
async function recordAuditLog(params) {
    try {
        await prisma_1.default.adminAuditLog.create({
            data: {
                adminUsername: params.adminUsername,
                action: params.action,
                targetUserId: params.targetUserId || null,
                targetUser: params.targetUser || null,
                reason: params.reason,
                beforeState: params.beforeState ? JSON.parse(JSON.stringify(params.beforeState)) : null,
                afterState: params.afterState ? JSON.parse(JSON.stringify(params.afterState)) : null,
                ipAddress: params.ipAddress || null,
            },
        });
    }
    catch (err) {
        console.error('[AdminAuditLog] Failed to record audit log:', err);
    }
}
// ==========================================
// AUTHENTICATION & SECURITY
// ==========================================
async function adminLogin(req, res) {
    try {
        await ensureDefaultAdmin();
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }
        const cleanUsername = String(username).trim().toLowerCase();
        const admin = await prisma_1.default.adminAccount.findUnique({
            where: { username: cleanUsername },
        });
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
        }
        const isMatch = await bcryptjs_1.default.compare(String(password), admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
        }
        // Update last login
        await prisma_1.default.adminAccount.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
        });
        const token = jsonwebtoken_1.default.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '12h' });
        return res.json({
            success: true,
            message: 'Admin authentication successful.',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                hasSensitivePin: Boolean(admin.sensitivePinHash),
                lastLoginAt: admin.lastLoginAt,
            },
        });
    }
    catch (err) {
        console.error('adminLogin error:', err);
        return res.status(500).json({ success: false, error: 'Internal error during admin login.' });
    }
}
async function getAdminProfile(req, res) {
    try {
        const adminId = req.admin.adminId;
        const admin = await prisma_1.default.adminAccount.findUnique({
            where: { id: adminId },
            select: { id: true, username: true, role: true, sensitivePinHash: true, lastLoginAt: true, createdAt: true },
        });
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin account not found.' });
        }
        return res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                hasSensitivePin: Boolean(admin.sensitivePinHash),
                lastLoginAt: admin.lastLoginAt,
                createdAt: admin.createdAt,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to retrieve admin profile.' });
    }
}
async function changeAdminCredentials(req, res) {
    try {
        const adminId = req.admin.adminId;
        const { currentPassword, newPassword, newSensitivePin, reason = 'Admin self credentials update' } = req.body;
        const admin = await prisma_1.default.adminAccount.findUnique({ where: { id: adminId } });
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin account not found.' });
        }
        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Current password is required to update credentials.' });
        }
        const isMatch = await bcryptjs_1.default.compare(String(currentPassword), admin.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
        }
        const updateData = {};
        if (newPassword) {
            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            updateData.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        }
        if (newSensitivePin) {
            if (typeof newSensitivePin !== 'string' || newSensitivePin.length < 4) {
                return res.status(400).json({ success: false, error: 'Sensitive PIN must be at least 4 digits or characters.' });
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            updateData.sensitivePinHash = await bcryptjs_1.default.hash(newSensitivePin, salt);
        }
        await prisma_1.default.adminAccount.update({
            where: { id: adminId },
            data: updateData,
        });
        await recordAuditLog({
            adminUsername: admin.username,
            action: 'CHANGE_ADMIN_CREDENTIALS',
            reason,
            details: 'Updated admin password and/or sensitive action PIN.',
        });
        return res.json({
            success: true,
            message: 'Admin credentials updated successfully.',
        });
    }
    catch (err) {
        console.error('changeAdminCredentials error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update credentials.' });
    }
}
// ==========================================
// AUDIT LOGS
// ==========================================
async function getAdminAuditLogs(req, res) {
    try {
        // Automatically purge logs older than 15 days
        await cleanupOldAuditLogs();
        const { targetUserId, action, page = '1', limit = '30' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (targetUserId)
            where.targetUserId = String(targetUserId);
        if (action)
            where.action = String(action);
        const [logs, total] = await Promise.all([
            prisma_1.default.adminAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_1.default.adminAuditLog.count({ where }),
        ]);
        return res.json({
            success: true,
            logs,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
        });
    }
    catch (err) {
        console.error('getAdminAuditLogs error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve audit logs.' });
    }
}
async function deleteAdminAuditLog(req, res) {
    try {
        const { logId } = req.params;
        await prisma_1.default.adminAuditLog.delete({
            where: { id: logId },
        });
        return res.json({ success: true, message: 'Audit log entry deleted successfully.' });
    }
    catch (err) {
        console.error('deleteAdminAuditLog error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete audit log entry.' });
    }
}
async function clearAdminAuditLogs(req, res) {
    try {
        const { targetUserId } = req.query;
        const where = {};
        if (targetUserId)
            where.targetUserId = String(targetUserId);
        const deleted = await prisma_1.default.adminAuditLog.deleteMany({ where });
        return res.json({
            success: true,
            message: `Cleared ${deleted.count} audit log entries.`,
            count: deleted.count,
        });
    }
    catch (err) {
        console.error('clearAdminAuditLogs error:', err);
        return res.status(500).json({ success: false, error: 'Failed to clear audit logs.' });
    }
}
// ==========================================
// USER SEARCH & MANAGEMENT
// ==========================================
async function searchUsersForAdmin(req, res) {
    try {
        const q = (req.query.q || '').trim();
        const filter = (req.query.filter || '').trim().toLowerCase();
        const { getAllActiveDeletedAccounts, isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        let whereClause = {};
        if (filter === 'deleted') {
            const deletedRecords = getAllActiveDeletedAccounts();
            const userIds = Array.from(new Set(deletedRecords
                .map((r) => r.userId)
                .filter((id) => typeof id === 'string' && id.trim().length > 0)));
            // If no deleted accounts are in the active recovery window, return empty immediately
            if (userIds.length === 0) {
                return res.json({
                    success: true,
                    users: [],
                });
            }
            if (q) {
                const cleanQ = q.toLowerCase().replace(/^@/, '');
                whereClause = {
                    AND: [
                        { id: { in: userIds } },
                        {
                            OR: [
                                { id: { equals: q } },
                                { username: { contains: cleanQ, mode: 'insensitive' } },
                                { normalizedUsername: { contains: cleanQ } },
                                { name: { contains: q, mode: 'insensitive' } },
                                { email: { contains: cleanQ, mode: 'insensitive' } },
                            ],
                        },
                    ],
                };
            }
            else {
                whereClause = { id: { in: userIds } };
            }
        }
        else if (q) {
            const cleanQ = q.toLowerCase().replace(/^@/, '');
            whereClause = {
                OR: [
                    { id: { equals: q } },
                    { username: { contains: cleanQ, mode: 'insensitive' } },
                    { normalizedUsername: { contains: cleanQ } },
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: cleanQ, mode: 'insensitive' } },
                ],
            };
        }
        const users = await prisma_1.default.user.findMany({
            where: whereClause,
            take: filter === 'deleted' ? 100 : 25,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                timezone: true,
                currentStreak: true,
                longestStreak: true,
                points: true,
                overallFreezeBalance: true,
                overallFreezeRechargeDays: true,
                lastUsernameChangeAt: true,
                maxStarredNotifications: true,
                createdAt: true,
                _count: {
                    select: {
                        tasks: true,
                        taskCompletions: true,
                        groupMemberships: true,
                    },
                },
            },
        });
        const enrichedUsers = users.map((u) => {
            const del = isAccountDeleted(u.id);
            return {
                ...u,
                isDeleted: del.isDeleted,
                deletedAt: del.record?.deletedAt || null,
                deletedExpiresAt: del.record?.expiresAt || null,
                deletionDaysRemaining: del.daysRemaining ?? null,
                canRecover: del.canRecover ?? false,
            };
        });
        return res.json({
            success: true,
            users: enrichedUsers,
        });
    }
    catch (err) {
        console.error('searchUsersForAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to search users.' });
    }
}
async function getUserDetailsForAdmin(req, res) {
    try {
        const { userId } = req.params;
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                tasks: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        group: {
                            select: { id: true, name: true, joinCode: true, ownerId: true },
                        },
                        _count: { select: { completions: true } },
                    },
                },
                groupMemberships: {
                    include: {
                        group: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                joinCode: true,
                                ownerId: true,
                                isDiscoverable: true,
                                isSpecialGroup: true,
                                specialPlatform: true,
                                hiddenFrom: true,
                                visibleOnlyTo: true,
                                members: {
                                    include: { user: { select: { id: true, name: true, username: true, email: true } } },
                                },
                                _count: { select: { members: true } },
                            },
                        },
                    },
                },
                reminderSchedules: {
                    orderBy: { time: 'asc' },
                    include: { task: { select: { id: true, title: true } } },
                },
                notificationPreference: true,
                ownedGroups: {
                    include: {
                        members: {
                            include: { user: { select: { id: true, name: true, username: true, email: true } } },
                        },
                        _count: { select: { members: true, tasks: true } },
                    },
                },
                pointLedgers: {
                    take: 30,
                    orderBy: { createdAt: 'desc' },
                },
                freezeLogs: {
                    take: 100,
                    orderBy: { usedAt: 'desc' },
                },
                taskCompletions: {
                    where: { completionDate: { gte: oneYearAgo } },
                    select: {
                        id: true,
                        taskId: true,
                        completionDate: true,
                        studyNote: true,
                        completedAt: true,
                        reactions: {
                            select: { id: true, emoji: true, userId: true },
                        },
                    },
                    orderBy: { completionDate: 'desc' },
                },
                friendshipsAsUser1: {
                    include: {
                        user2: { select: { id: true, name: true, username: true } },
                    },
                },
                friendshipsAsUser2: {
                    include: {
                        user1: { select: { id: true, name: true, username: true } },
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // Strip passwordHash before returning
        const { passwordHash, ...safeUser } = user;
        safeUser.leaderboardLimit = (0, adminConfigService_1.getUserLeaderboardLimit)(userId);
        safeUser.reminderLimit = (0, adminConfigService_1.getUserReminderLimit)(userId);
        safeUser.taskReminderLimit = (0, adminConfigService_1.getUserTaskReminderLimit)(userId);
        safeUser.discoverGroupsLimit = (0, adminConfigService_1.getUserDiscoverGroupsLimit)(userId);
        safeUser.profileImageLimitMb = (0, adminConfigService_1.getUserProfileImageLimitMb)(userId);
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const del = isAccountDeleted(userId);
        safeUser.isDeleted = del.isDeleted;
        safeUser.deletedAt = del.record?.deletedAt || null;
        safeUser.deletedExpiresAt = del.record?.expiresAt || null;
        safeUser.deletionDaysRemaining = del.daysRemaining ?? null;
        safeUser.canRecover = del.canRecover ?? false;
        return res.json({
            success: true,
            user: safeUser,
        });
    }
    catch (err) {
        console.error('getUserDetailsForAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve user details.' });
    }
}
// ==========================================
// PRIVILEGED OVERRIDES & CORRECTIONS
// ==========================================
/**
 * Override 14-day username change cooldown
 */
async function overrideUsernameCooldown(req, res) {
    try {
        const { userId } = req.params;
        const { newUsername, resetCooldownOnly = false, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeState = {
            username: user.username,
            normalizedUsername: user.normalizedUsername,
            lastUsernameChangeAt: user.lastUsernameChangeAt,
        };
        let updatedUser;
        if (resetCooldownOnly || !newUsername) {
            // Just reset the cooldown so the user can change it immediately
            updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: { lastUsernameChangeAt: null },
                select: { id: true, username: true, lastUsernameChangeAt: true },
            });
        }
        else {
            const cleanUsername = String(newUsername).trim();
            if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username must be 3-30 characters containing only letters, numbers, and underscores.',
                });
            }
            const norm = cleanUsername.toLowerCase();
            const existing = await prisma_1.default.user.findUnique({ where: { normalizedUsername: norm } });
            if (existing && existing.id !== userId) {
                return res.status(400).json({ success: false, error: `@${cleanUsername} is already taken by another account.` });
            }
            updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    username: cleanUsername,
                    normalizedUsername: norm,
                    lastUsernameChangeAt: new Date(),
                },
                select: { id: true, username: true, lastUsernameChangeAt: true },
            });
        }
        const changesSummary = resetCooldownOnly
            ? `Username change cooldown restriction was reset. You can now update your username immediately.`
            : `Your username was updated to @${updatedUser.username}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'USERNAME_COOLDOWN_OVERRIDE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: updatedUser,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Username Settings Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: resetCooldownOnly
                ? `Username 14-day restriction has been cleared for @${user.username}. They can now change it immediately.`
                : `Username updated to @${updatedUser.username} by Admin override.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('overrideUsernameCooldown error:', err);
        return res.status(500).json({ success: false, error: 'Failed to override username cooldown.' });
    }
}
/**
 * Correct overall streak, personal task streak, or group task streak
 */
async function correctStreaks(req, res) {
    try {
        const { userId } = req.params;
        const { type, taskId, currentStreak, longestStreak, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, applyToOverall = false, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof currentStreak !== 'number' || currentStreak < 0) {
            return res.status(400).json({ success: false, error: 'Valid non-negative streak number is required.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        if (type === 'TASK') {
            if (!taskId) {
                return res.status(400).json({ success: false, error: 'Task ID is required for task streak correction.' });
            }
            const task = await prisma_1.default.task.findUnique({ where: { id: taskId } });
            if (!task || task.userId !== userId) {
                return res.status(404).json({ success: false, error: 'Task not found for this user.' });
            }
            const beforeState = { currentStreak: task.currentStreak, longestStreak: task.longestStreak };
            const newLongest = longestStreak !== undefined ? Math.max(longestStreak, currentStreak) : Math.max(task.longestStreak, currentStreak);
            const updatedTask = await prisma_1.default.task.update({
                where: { id: taskId },
                data: {
                    currentStreak,
                    longestStreak: newLongest,
                },
                select: { id: true, title: true, currentStreak: true, longestStreak: true },
            });
            if (task.groupId && (0, linkedInGameService_1.isLinkedInName)(task.title)) {
                try {
                    const allGames = await (0, linkedInGameService_1.getAllGamesForMember)(task.groupId, userId);
                    const committed = allGames.filter((g) => g.isCommitted);
                    const targetGame = committed.length > 0 ? committed[0] : allGames[0];
                    if (targetGame) {
                        await (0, linkedInGameService_1.adminCorrectGameStreak)(task.groupId, userId, targetGame.gameId, currentStreak, newLongest);
                    }
                }
                catch (e) {
                    console.error('[correctStreaks:LinkedIn] Error synchronizing primary game streak:', e);
                }
            }
            if (applyToOverall) {
                const nextUserLongest = Math.max(user.longestStreak || 0, newLongest);
                await prisma_1.default.user.update({
                    where: { id: userId },
                    data: {
                        currentStreak,
                        longestStreak: nextUserLongest,
                    },
                });
            }
            const changesSummary = `Task "${task.title}" streak updated: Current streak changed from ${beforeState.currentStreak} to ${currentStreak} days (longest: ${newLongest} days)${applyToOverall ? ' [Applied to user overall streak]' : ''}.`;
            await recordAuditLog({
                adminUsername: req.admin.username,
                action: 'TASK_STREAK_CORRECTION',
                targetUserId: userId,
                targetUser: `@${user.username}`,
                reason,
                beforeState,
                afterState: updatedTask,
            });
            await dispatchAdminNotification({
                userId,
                adminUsername: req.admin.username,
                actionTitle: 'Task Streak Corrected',
                reason,
                changesSummary,
                sendInApp,
                sendEmail: shouldSendEmail,
                includeReason,
                includeChanges,
            });
            return res.json({
                success: true,
                message: `Streak for task "${task.title}" updated to ${currentStreak} days.`,
                task: updatedTask,
            });
        }
        else {
            // OVERALL STREAK
            const beforeState = { currentStreak: user.currentStreak, longestStreak: user.longestStreak };
            const newLongest = longestStreak !== undefined ? Math.max(longestStreak, currentStreak) : Math.max(user.longestStreak, currentStreak);
            const updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    currentStreak,
                    longestStreak: newLongest,
                },
                select: { id: true, username: true, currentStreak: true, longestStreak: true },
            });
            const changesSummary = `Overall streak updated: Current streak changed from ${beforeState.currentStreak} to ${currentStreak} days (longest: ${newLongest} days).`;
            await recordAuditLog({
                adminUsername: req.admin.username,
                action: 'OVERALL_STREAK_CORRECTION',
                targetUserId: userId,
                targetUser: `@${user.username}`,
                reason,
                beforeState,
                afterState: updatedUser,
            });
            await dispatchAdminNotification({
                userId,
                adminUsername: req.admin.username,
                actionTitle: 'Overall Streak Corrected',
                reason,
                changesSummary,
                sendInApp,
                sendEmail: shouldSendEmail,
                includeReason,
                includeChanges,
            });
            return res.json({
                success: true,
                message: `Overall streak for @${user.username} updated to ${currentStreak} days.`,
                user: updatedUser,
            });
        }
    }
    catch (err) {
        console.error('correctStreaks error:', err);
        return res.status(500).json({ success: false, error: 'Failed to correct streak.' });
    }
}
/**
 * Grants a streak / task completion on a specific historical or current day for a user
 * Maintains full workflow: creates TaskCompletion, recalculates task & user streaks,
 * awards points, records audit log, and dispatches notifications if selected.
 */
async function grantDayStreak(req, res) {
    try {
        const { userId } = req.params;
        const { date, taskId, taskIds: rawTaskIds, studyNote, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, error: 'A valid date in YYYY-MM-DD format is required.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { tasks: { where: { status: 'ACTIVE' } } },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // Determine target tasks (from taskIds array, or single taskId, or fallback)
        let targetTaskIds = [];
        if (Array.isArray(rawTaskIds) && rawTaskIds.length > 0) {
            targetTaskIds = rawTaskIds;
        }
        else if (taskId) {
            targetTaskIds = [taskId];
        }
        else {
            if (user.tasks.length > 0) {
                targetTaskIds = [user.tasks[0].id];
            }
            else {
                const newTask = await prisma_1.default.task.create({
                    data: {
                        userId,
                        title: 'Daily Productivity',
                        recurrence: 'DAILY',
                        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
                        status: 'ACTIVE',
                    },
                });
                targetTaskIds = [newTask.id];
            }
        }
        const beforeState = {
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            points: user.points,
        };
        // Create or update TaskCompletion for each selected task on this date
        const completions = [];
        for (const tId of targetTaskIds) {
            const completion = await prisma_1.default.taskCompletion.upsert({
                where: {
                    taskId_completionDate: {
                        taskId: tId,
                        completionDate: date,
                    },
                },
                create: {
                    userId,
                    taskId: tId,
                    completionDate: date,
                    completedAt: new Date(`${date}T12:00:00Z`),
                    studyNote: studyNote || `Retroactively granted by admin on ${date}`,
                },
                update: {
                    studyNote: studyNote || undefined,
                },
            });
            completions.push(completion);
            // Recalculate streak for this task
            await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, tId, userId, user.timezone);
        }
        // Recalculate overall user streaks
        const updatedStreaks = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, user.timezone);
        // Award +5 points per selected task
        const pointsPerTask = 5;
        const pointsDelta = targetTaskIds.length * pointsPerTask;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { points: { increment: pointsDelta } },
            select: {
                id: true,
                username: true,
                currentStreak: true,
                longestStreak: true,
                points: true,
                overallFreezeBalance: true,
            },
        });
        const changesSummary = `Granted streak completion for ${targetTaskIds.length} habit(s) on ${date}. Current streak is now ${updatedUser.currentStreak} days (longest: ${updatedUser.longestStreak} days), points +${pointsDelta} (+5 per task).`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'GRANT_DAY_STREAK',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: {
                completionIds: completions.map((c) => c.id),
                date,
                taskIds: targetTaskIds,
                tasksCount: targetTaskIds.length,
                pointsDelta,
                currentStreak: updatedUser.currentStreak,
                longestStreak: updatedUser.longestStreak,
                points: updatedUser.points,
            },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `Streak Granted for ${date}`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Streak completion successfully applied for ${targetTaskIds.length} habit(s) on ${date} (+${pointsDelta} pts). Workflow and streaks updated everywhere.`,
            user: updatedUser,
            completions,
            pointsDelta,
        });
    }
    catch (err) {
        console.error('grantDayStreak error:', err);
        return res.status(500).json({ success: false, error: 'Failed to grant streak on selected day.' });
    }
}
/**
 * Adjust freezes (balance out of 7, capacity 1-7, recharge days, or historical freeze date protection)
 */
async function adjustFreezes(req, res) {
    try {
        const { userId } = req.params;
        const { overallFreezeBalance, overallFreezeRechargeDays, overallFreezeCapacity, freezeBalance, freezeRechargeDays, freezeCapacity, historicalFreezeDate, taskId, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                tasks: {
                    where: taskId ? { id: taskId } : undefined,
                    include: { group: true },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const targetTask = taskId ? user.tasks.find((t) => t.id === taskId) : null;
        if (taskId && !targetTask) {
            return res.status(404).json({ success: false, error: 'Target task not found for this user.' });
        }
        if (targetTask && ((0, linkedInGameService_1.isLinkedInName)(targetTask.title) || (targetTask.groupId && (0, linkedInGameService_1.isLinkedInName)(targetTask.group?.name || '')))) {
            return res.status(400).json({
                success: false,
                error: 'Streak freeze is disabled for LinkedIn games and LinkedIn groups.',
            });
        }
        const beforeState = taskId
            ? {
                scope: 'TASK',
                taskId,
                taskTitle: targetTask?.title,
                freezeBalance: targetTask?.freezeBalance ?? 0,
                freezeRechargeDays: targetTask?.freezeRechargeDays ?? 0,
                freezeCapacity: targetTask?.freezeCapacity ?? 1,
            }
            : {
                scope: 'OVERALL',
                overallFreezeBalance: user.overallFreezeBalance,
                overallFreezeRechargeDays: user.overallFreezeRechargeDays,
                overallFreezeCapacity: user.overallFreezeCapacity ?? 1,
            };
        const changesList = [];
        let updatedUser = user;
        let updatedTask = targetTask;
        if (taskId && targetTask) {
            // Task Scope Freeze Management
            const taskUpdateData = {};
            const newCapacity = typeof freezeCapacity === 'number'
                ? Math.max(1, Math.min(7, Math.round(freezeCapacity)))
                : (typeof overallFreezeCapacity === 'number' ? Math.max(1, Math.min(7, Math.round(overallFreezeCapacity))) : undefined);
            if (newCapacity !== undefined) {
                taskUpdateData.freezeCapacity = newCapacity;
                changesList.push(`Task freeze capacity set to ${newCapacity} shield(s) (was ${targetTask.freezeCapacity || 1}).`);
            }
            const effectiveCapacity = newCapacity ?? (targetTask.freezeCapacity || 1);
            const newBalance = typeof freezeBalance === 'number'
                ? Math.max(0, Math.min(effectiveCapacity, Math.round(freezeBalance)))
                : (typeof overallFreezeBalance === 'number' ? Math.max(0, Math.min(effectiveCapacity, Math.round(overallFreezeBalance))) : undefined);
            if (newBalance !== undefined) {
                taskUpdateData.freezeBalance = newBalance;
                changesList.push(`Task freeze balance set to ${newBalance}/${effectiveCapacity} (was ${targetTask.freezeBalance}/${targetTask.freezeCapacity || 1}).`);
            }
            const newRecharge = typeof freezeRechargeDays === 'number'
                ? Math.max(0, Math.min(7, Math.round(freezeRechargeDays)))
                : (typeof overallFreezeRechargeDays === 'number' ? Math.max(0, Math.min(7, Math.round(overallFreezeRechargeDays))) : undefined);
            if (newRecharge !== undefined) {
                taskUpdateData.freezeRechargeDays = newRecharge;
                changesList.push(`Task freeze recharge progress set to ${newRecharge}/7 days (was ${targetTask.freezeRechargeDays}/7 days).`);
            }
            if (Object.keys(taskUpdateData).length > 0) {
                updatedTask = await prisma_1.default.task.update({
                    where: { id: taskId },
                    data: taskUpdateData,
                });
            }
        }
        else {
            // Overall Scope Freeze Management
            const userUpdateData = {};
            if (typeof overallFreezeCapacity === 'number') {
                const cap = Math.max(1, Math.min(7, Math.round(overallFreezeCapacity)));
                userUpdateData.overallFreezeCapacity = cap;
                changesList.push(`Overall freeze inventory capacity set to ${cap} shield(s) (was ${user.overallFreezeCapacity || 1}).`);
            }
            const effectiveCapacity = userUpdateData.overallFreezeCapacity ?? (user.overallFreezeCapacity || 1);
            if (typeof overallFreezeBalance === 'number') {
                const bal = Math.max(0, Math.min(effectiveCapacity, Math.round(overallFreezeBalance)));
                userUpdateData.overallFreezeBalance = bal;
                changesList.push(`Freeze shield balance set to ${bal}/${effectiveCapacity} (was ${user.overallFreezeBalance}/${user.overallFreezeCapacity || 1}).`);
            }
            if (typeof overallFreezeRechargeDays === 'number' && overallFreezeRechargeDays >= 0) {
                const rech = Math.max(0, Math.min(7, Math.round(overallFreezeRechargeDays)));
                userUpdateData.overallFreezeRechargeDays = rech;
                changesList.push(`Shelf recharge progress set to ${rech}/7 days (was ${user.overallFreezeRechargeDays}/7 days).`);
            }
            if (Object.keys(userUpdateData).length > 0) {
                updatedUser = await prisma_1.default.user.update({
                    where: { id: userId },
                    data: userUpdateData,
                });
            }
        }
        // If historical freeze date protection requested (e.g. "2026-10-17")
        let historicalLog = null;
        if (historicalFreezeDate && typeof historicalFreezeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(historicalFreezeDate)) {
            historicalLog = await prisma_1.default.freezeLog.upsert({
                where: {
                    userId_scopeKey_protectedDate: {
                        userId,
                        scopeKey: taskId ? `TASK:${taskId}` : 'OVERALL',
                        protectedDate: historicalFreezeDate,
                    },
                },
                create: {
                    userId,
                    scope: taskId ? 'TASK' : 'OVERALL',
                    scopeKey: taskId ? `TASK:${taskId}` : 'OVERALL',
                    taskId: taskId || null,
                    protectedDate: historicalFreezeDate,
                },
                update: {},
            });
            // Recalculate streaks
            if (taskId) {
                await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, taskId, userId, user.timezone);
            }
            else {
                await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, user.timezone);
            }
            changesList.push(`Historical freeze protection recorded for date ${historicalFreezeDate} (${taskId ? `Task "${targetTask?.title}"` : 'Overall Streak'}).`);
        }
        const afterState = taskId
            ? {
                scope: 'TASK',
                taskId,
                freezeBalance: updatedTask?.freezeBalance,
                freezeRechargeDays: updatedTask?.freezeRechargeDays,
                freezeCapacity: updatedTask?.freezeCapacity,
                historicalLog,
            }
            : {
                scope: 'OVERALL',
                overallFreezeBalance: updatedUser.overallFreezeBalance,
                overallFreezeRechargeDays: updatedUser.overallFreezeRechargeDays,
                overallFreezeCapacity: updatedUser.overallFreezeCapacity,
                historicalLog,
            };
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'FREEZE_ADJUSTMENT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: taskId ? `Task Freeze Settings Adjusted (${targetTask?.title})` : 'Overall Freeze Settings Adjusted',
            reason,
            changesSummary: changesList.join(' ') || 'Freeze settings updated.',
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: 'Freeze settings updated successfully.',
            user: {
                id: updatedUser.id,
                overallFreezeBalance: updatedUser.overallFreezeBalance,
                overallFreezeRechargeDays: updatedUser.overallFreezeRechargeDays,
                overallFreezeCapacity: updatedUser.overallFreezeCapacity,
            },
            task: updatedTask
                ? {
                    id: updatedTask.id,
                    freezeBalance: updatedTask.freezeBalance,
                    freezeRechargeDays: updatedTask.freezeRechargeDays,
                    freezeCapacity: updatedTask.freezeCapacity,
                }
                : undefined,
            historicalFreezeApplied: Boolean(historicalLog),
        });
    }
    catch (err) {
        console.error('adjustFreezes error:', err);
        return res.status(500).json({ success: false, error: 'Failed to adjust freezes.' });
    }
}
/**
 * Adjust points with auditable ledger entry
 */
async function adjustPoints(req, res) {
    try {
        const { userId } = req.params;
        const { pointsDelta, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof pointsDelta !== 'number' || pointsDelta === 0) {
            return res.status(400).json({ success: false, error: 'pointsDelta must be a non-zero integer.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforePoints = user.points || 0;
        const afterPoints = Math.max(0, beforePoints + pointsDelta);
        const today = (0, timezoneService_1.getTodayInTimezone)(user.timezone || 'Asia/Kolkata');
        // Create ledger entry + update user atomically
        await prisma_1.default.$transaction(async (tx) => {
            await tx.pointLedger.create({
                data: {
                    userId,
                    points: pointsDelta,
                    reason: `ADMIN_CORRECTION: ${reason.slice(0, 80)}`,
                    date: today,
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { points: afterPoints },
            });
        });
        const changesSummary = `Points adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}. New point total: ${afterPoints} pts (was ${beforePoints} pts).`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'POINTS_ADJUSTMENT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { points: beforePoints },
            afterState: { points: afterPoints, pointsDelta },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Points Adjusted',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Points for @${user.username} adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}. New balance: ${afterPoints} pts.`,
            points: afterPoints,
        });
    }
    catch (err) {
        console.error('adjustPoints error:', err);
        return res.status(500).json({ success: false, error: 'Failed to adjust points.' });
    }
}
/**
 * Override the per-user limit of 15 (starred notifications limit)
 */
async function overrideLimit15(req, res) {
    try {
        const { userId } = req.params;
        const { maxStarredNotifications, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof maxStarredNotifications !== 'number' || maxStarredNotifications < 1) {
            return res.status(400).json({ success: false, error: 'maxStarredNotifications must be at least 1.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeState = { maxStarredNotifications: user.maxStarredNotifications || 15 };
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { maxStarredNotifications },
            select: { id: true, username: true, maxStarredNotifications: true },
        });
        const changesSummary = `Starred notifications limit updated from ${beforeState.maxStarredNotifications} to ${maxStarredNotifications}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_LIMIT_15',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: { maxStarredNotifications },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Starred Notification Limit Overridden',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Starred notifications limit for @${user.username} updated from ${beforeState.maxStarredNotifications} to ${maxStarredNotifications}.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('overrideLimit15 error:', err);
        return res.status(500).json({ success: false, error: 'Failed to override limit of 15.' });
    }
}
/**
 * Permanently delete a user account (Super Admin sensitive action)
 */
async function deleteUserAccountByAdmin(req, res) {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true, name: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User account not found.' });
        }
        // Execute cascade deletion
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete friendships
            await tx.friendship.deleteMany({
                where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
            });
            // 2. Delete friend requests
            await tx.friendRequest.deleteMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            });
            // 3. Delete group invitations & requests
            await tx.groupInvitation.deleteMany({
                where: { OR: [{ inviterId: userId }, { inviteeId: userId }] },
            });
            await tx.groupJoinRequest.deleteMany({ where: { userId } });
            await tx.groupMember.deleteMany({ where: { userId } });
            // 4. Delete user record (cascades tasks, completions, notifications, etc.)
            await tx.user.delete({ where: { id: userId } });
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'DELETE_USER_ACCOUNT',
            targetUserId: userId,
            targetUser: `@${user.username} (${user.email})`,
            reason,
            beforeState: user,
            afterState: { deleted: true },
        });
        return res.json({
            success: true,
            message: `User account @${user.username} (${user.email}) has been permanently deleted.`,
        });
    }
    catch (err) {
        console.error('deleteUserAccountByAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete user account.' });
    }
}
/**
 * Recover a deleted user account within the 10-day grace period (Super Admin action)
 */
async function recoverUserAccount(req, res) {
    try {
        const { userId } = req.params;
        const { reason = 'Account recovered by Super Admin' } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true, name: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User account not found.' });
        }
        const { recoverAccount, isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const delStatus = isAccountDeleted(userId);
        if (!delStatus.isDeleted) {
            return res.status(400).json({ success: false, error: 'This user account is not currently deleted.' });
        }
        const recoveryResult = await recoverAccount(userId, req.admin.username);
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'RECOVER_ACCOUNT',
            targetUserId: userId,
            targetUser: `@${user.username} (${user.email})`,
            reason,
            beforeState: { isDeleted: true, record: delStatus.record },
            afterState: { isDeleted: false, record: recoveryResult.record },
        });
        return res.json({
            success: true,
            message: `Account for @${user.username} has been recovered. The user can simply log in again.`,
            user,
        });
    }
    catch (err) {
        console.error('recoverUserAccount error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to recover account.' });
    }
}
/**
 * Override 14-day email change cooldown or update registered email directly
 */
async function overrideEmailCooldown(req, res) {
    try {
        const { userId } = req.params;
        const { newEmail, resetCooldownOnly = false, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeState = {
            email: user.email,
            emailLastChangedAt: user.emailLastChangedAt,
        };
        let updatedUser;
        if (resetCooldownOnly || !newEmail) {
            updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: { emailLastChangedAt: null },
                select: { id: true, email: true, emailLastChangedAt: true },
            });
        }
        else {
            const cleanEmail = String(newEmail).trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                return res.status(400).json({ success: false, error: 'Invalid email address format.' });
            }
            const existing = await prisma_1.default.user.findUnique({ where: { email: cleanEmail } });
            if (existing && existing.id !== userId) {
                return res.status(400).json({ success: false, error: `${cleanEmail} is already registered to another account.` });
            }
            updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    email: cleanEmail,
                    emailLastChangedAt: new Date(),
                },
                select: { id: true, email: true, emailLastChangedAt: true },
            });
            // Clear customNotificationEmail so notifications route to the newly assigned email
            await prisma_1.default.notificationPreference.updateMany({
                where: { userId },
                data: {
                    customNotificationEmail: null,
                    isCustomEmailVerified: false,
                },
            });
        }
        const changesSummary = resetCooldownOnly
            ? `Email 14-day restriction cleared. You can now update your registered email address immediately.`
            : `Your registered email address was updated to ${updatedUser.email}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'EMAIL_COOLDOWN_OVERRIDE',
            targetUserId: userId,
            targetUser: `@${user.username} (${user.email})`,
            reason,
            beforeState,
            afterState: updatedUser,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Email Settings Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: resetCooldownOnly
                ? `Email 14-day restriction cleared for @${user.username}. They can now update their email in settings.`
                : `Email updated to ${updatedUser.email} for @${user.username} by Admin override.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('overrideEmailCooldown error:', err);
        return res.status(500).json({ success: false, error: 'Failed to override email cooldown.' });
    }
}
/**
 * Toggle or update email verification status
 */
async function toggleUserEmailVerification(req, res) {
    try {
        const { userId } = req.params;
        const { isEmailVerified, reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const newStatus = typeof isEmailVerified === 'boolean' ? isEmailVerified : !user.isEmailVerified;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { isEmailVerified: newStatus },
            select: { id: true, username: true, isEmailVerified: true },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'TOGGLE_EMAIL_VERIFICATION',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { isEmailVerified: user.isEmailVerified },
            afterState: { isEmailVerified: newStatus },
        });
        return res.json({
            success: true,
            message: `Email verification for @${user.username} set to ${newStatus ? 'VERIFIED' : 'UNVERIFIED'}.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('toggleUserEmailVerification error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update email verification status.' });
    }
}
/**
 * Update user timezone with streak boundary recalculation notice
 */
async function updateUserTimezone(req, res) {
    try {
        const { userId } = req.params;
        const { timezone, reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (!timezone || typeof timezone !== 'string') {
            return res.status(400).json({ success: false, error: 'Valid IANA timezone string is required.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { timezone: timezone.trim() },
            select: { id: true, username: true, timezone: true },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_USER_TIMEZONE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { timezone: user.timezone },
            afterState: { timezone: updatedUser.timezone },
        });
        return res.json({
            success: true,
            message: `Timezone for @${user.username} updated to ${updatedUser.timezone}.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('updateUserTimezone error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update timezone.' });
    }
}
/**
 * Reset 12-hour friend nudge cooldown
 */
async function resetNudgeCooldown(req, res) {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const deleted = await prisma_1.default.notification.deleteMany({
            where: {
                userId,
                category: 'FRIEND_NUDGE',
            },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'RESET_NUDGE_COOLDOWN',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { deletedCount: deleted.count },
            afterState: { cleared: true },
        });
        return res.json({
            success: true,
            message: `Cleared ${deleted.count} nudge notifications. 12-hour nudge cooldown has been reset for @${user.username}.`,
        });
    }
    catch (err) {
        console.error('resetNudgeCooldown error:', err);
        return res.status(500).json({ success: false, error: 'Failed to reset nudge cooldown.' });
    }
}
/**
 * Update task privacy/visibility (hiddenFrom, visibleOnlyTo)
 */
async function updateTaskVisibility(req, res) {
    try {
        const { taskId } = req.params;
        const { hiddenFrom = [], visibleOnlyTo = [], reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const task = await prisma_1.default.task.findUnique({
            where: { id: taskId },
            include: { user: { select: { username: true } } },
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        const updatedTask = await prisma_1.default.task.update({
            where: { id: taskId },
            data: {
                hiddenFrom: Array.isArray(hiddenFrom) ? hiddenFrom : [],
                visibleOnlyTo: Array.isArray(visibleOnlyTo) ? visibleOnlyTo : [],
            },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_TASK_VISIBILITY',
            targetUserId: task.userId,
            targetUser: `@${task.user.username}`,
            reason,
            beforeState: { hiddenFrom: task.hiddenFrom, visibleOnlyTo: task.visibleOnlyTo },
            afterState: { hiddenFrom: updatedTask.hiddenFrom, visibleOnlyTo: updatedTask.visibleOnlyTo },
        });
        return res.json({
            success: true,
            message: `Visibility rules for task "${task.title}" updated.`,
            task: updatedTask,
        });
    }
    catch (err) {
        console.error('updateTaskVisibility error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update task visibility.' });
    }
}
/**
 * Manage group membership role & group ownership transfer
 */
async function adminManageGroupMember(req, res) {
    try {
        const { groupId } = req.params;
        const { targetUserId, role, reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (!['OWNER', 'ADMIN', 'MEMBER', 'REMOVE'].includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid group role. Must be OWNER, ADMIN, MEMBER, or REMOVE.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            include: { members: true },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        const member = group.members.find((m) => m.userId === targetUserId);
        if (!member) {
            return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
        }
        if (role === 'REMOVE') {
            if (member.role === 'OWNER') {
                return res.status(400).json({ success: false, error: 'Cannot remove group owner. Transfer ownership to another member first.' });
            }
            await prisma_1.default.groupMember.delete({
                where: { groupId_userId: { groupId, userId: targetUserId } },
            });
            await recordAuditLog({
                adminUsername: req.admin.username,
                action: 'REMOVE_GROUP_MEMBER',
                targetUserId,
                reason,
                beforeState: { groupId, groupName: group.name, role: member.role },
                afterState: { removed: true },
            });
            return res.json({
                success: true,
                message: `Member removed from group "${group.name}".`,
            });
        }
        await prisma_1.default.$transaction(async (tx) => {
            // If transferring ownership
            if (role === 'OWNER') {
                // Demote old owner to ADMIN in group members
                await tx.groupMember.updateMany({
                    where: { groupId, userId: group.ownerId },
                    data: { role: 'ADMIN' },
                });
                // Set new owner on group
                await tx.group.update({
                    where: { id: groupId },
                    data: { ownerId: targetUserId },
                });
                // Promote target user to OWNER in group members
                await tx.groupMember.update({
                    where: { groupId_userId: { groupId, userId: targetUserId } },
                    data: { role: 'OWNER' },
                });
            }
            else {
                await tx.groupMember.update({
                    where: { groupId_userId: { groupId, userId: targetUserId } },
                    data: { role: role },
                });
            }
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: role === 'OWNER' ? 'TRANSFER_GROUP_OWNERSHIP' : 'UPDATE_GROUP_MEMBER_ROLE',
            targetUserId,
            reason,
            beforeState: { groupId, groupName: group.name, oldRole: member.role, previousOwnerId: group.ownerId },
            afterState: { groupId, newRole: role, newOwnerId: role === 'OWNER' ? targetUserId : group.ownerId },
        });
        return res.json({
            success: true,
            message: role === 'OWNER'
                ? `Transferred ownership of group "${group.name}" to member.`
                : `Updated role in group "${group.name}" to ${role}.`,
        });
    }
    catch (err) {
        console.error('adminManageGroupMember error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update group member role.' });
    }
}
/**
 * Recover archived group task back to active dashboard
 */
async function adminRecoverGroupTask(req, res) {
    try {
        const { taskId } = req.params;
        const { reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const task = await prisma_1.default.task.findUnique({
            where: { id: taskId },
            include: { user: { select: { username: true } }, group: { select: { name: true } } },
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        const updatedTask = await prisma_1.default.task.update({
            where: { id: taskId },
            data: { status: 'ACTIVE' },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'RECOVER_GROUP_TASK',
            targetUserId: task.userId,
            targetUser: `@${task.user.username}`,
            reason,
            beforeState: { taskId, status: task.status },
            afterState: { taskId, status: 'ACTIVE' },
        });
        return res.json({
            success: true,
            message: `Task "${task.title}" has been restored to ACTIVE status on the dashboard.`,
            task: updatedTask,
        });
    }
    catch (err) {
        console.error('adminRecoverGroupTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to recover task.' });
    }
}
/**
 * Moderate study note or remove reactions without deleting streak completion
 */
async function adminModerateStudyNote(req, res) {
    try {
        const { completionId } = req.params;
        const { studyNote, clearReactions = false, reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const completion = await prisma_1.default.taskCompletion.findUnique({
            where: { id: completionId },
            include: {
                user: { select: { username: true } },
                task: { select: { title: true } },
                reactions: true,
            },
        });
        if (!completion) {
            return res.status(404).json({ success: false, error: 'Task completion record not found.' });
        }
        const beforeState = {
            studyNote: completion.studyNote,
            reactionsCount: completion.reactions.length,
        };
        if (clearReactions) {
            await prisma_1.default.studyNoteReaction.deleteMany({ where: { completionId } });
        }
        const updatedCompletion = await prisma_1.default.taskCompletion.update({
            where: { id: completionId },
            data: {
                studyNote: studyNote !== undefined ? (studyNote ? String(studyNote).trim() : null) : completion.studyNote,
            },
            include: { reactions: true },
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'MODERATE_STUDY_NOTE',
            targetUserId: completion.userId,
            targetUser: `@${completion.user.username}`,
            reason,
            beforeState,
            afterState: {
                studyNote: updatedCompletion.studyNote,
                reactionsCount: updatedCompletion.reactions.length,
            },
        });
        return res.json({
            success: true,
            message: 'Study note moderated successfully. Underlying completion record preserved.',
            completion: updatedCompletion,
        });
    }
    catch (err) {
        console.error('adminModerateStudyNote error:', err);
        return res.status(500).json({ success: false, error: 'Failed to moderate study note.' });
    }
}
/**
 * Full task settings and privacy update
 */
async function adminUpdateTaskFull(req, res) {
    try {
        const { taskId } = req.params;
        const { title, description, category, priority, recurrence, status, hiddenFrom, visibleOnlyTo, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const task = await prisma_1.default.task.findUnique({
            where: { id: taskId },
            include: { user: { select: { id: true, username: true, email: true } } },
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        const beforeState = {
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            recurrence: task.recurrence,
            status: task.status,
            hiddenFrom: task.hiddenFrom,
            visibleOnlyTo: task.visibleOnlyTo,
        };
        const updatedTask = await prisma_1.default.task.update({
            where: { id: taskId },
            data: {
                title: title ? String(title).trim() : task.title,
                description: description !== undefined ? description : task.description,
                category: category ? String(category).trim() : task.category,
                priority: priority || task.priority,
                recurrence: recurrence || task.recurrence,
                status: status || task.status,
                hiddenFrom: Array.isArray(hiddenFrom) ? hiddenFrom : task.hiddenFrom,
                visibleOnlyTo: Array.isArray(visibleOnlyTo) ? visibleOnlyTo : task.visibleOnlyTo,
            },
        });
        const changesSummary = `Task "${beforeState.title}" updated: title="${updatedTask.title}", category="${updatedTask.category}", status="${updatedTask.status}".`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_TASK_FULL',
            targetUserId: task.userId,
            targetUser: `@${task.user.username}`,
            reason,
            beforeState,
            afterState: updatedTask,
        });
        await dispatchAdminNotification({
            userId: task.userId,
            adminUsername: req.admin.username,
            actionTitle: `Task "${updatedTask.title}" Updated by Admin`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Task "${updatedTask.title}" settings successfully updated.`,
            task: updatedTask,
        });
    }
    catch (err) {
        console.error('adminUpdateTaskFull error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update task settings.' });
    }
}
/**
 * Full group settings, privacy, and ownership update
 */
async function adminUpdateGroupFull(req, res) {
    try {
        const { groupId } = req.params;
        const { name, description, joinCode, ownerId, hiddenFrom, visibleOnlyTo, isDiscoverable, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            include: {
                owner: { select: { id: true, username: true, email: true } },
                members: { include: { user: { select: { id: true, username: true } } } },
            },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        const beforeState = {
            name: group.name,
            description: group.description,
            joinCode: group.joinCode,
            ownerId: group.ownerId,
            isDiscoverable: group.isDiscoverable,
            hiddenFrom: group.hiddenFrom,
            visibleOnlyTo: group.visibleOnlyTo,
        };
        const updateData = {};
        if (name)
            updateData.name = String(name).trim();
        if (description !== undefined)
            updateData.description = description;
        if (joinCode)
            updateData.joinCode = String(joinCode).trim().toUpperCase();
        if (typeof isDiscoverable === 'boolean')
            updateData.isDiscoverable = isDiscoverable;
        if (Array.isArray(hiddenFrom))
            updateData.hiddenFrom = hiddenFrom;
        if (Array.isArray(visibleOnlyTo))
            updateData.visibleOnlyTo = visibleOnlyTo;
        // If transferring ownership
        if (ownerId && ownerId !== group.ownerId) {
            updateData.ownerId = ownerId;
            await prisma_1.default.groupMember.upsert({
                where: { groupId_userId: { groupId, userId: ownerId } },
                create: { groupId, userId: ownerId, role: 'OWNER' },
                update: { role: 'OWNER' },
            });
            await prisma_1.default.groupMember.updateMany({
                where: { groupId, userId: group.ownerId },
                data: { role: 'ADMIN' },
            });
        }
        const updatedGroup = await prisma_1.default.group.update({
            where: { id: groupId },
            data: updateData,
        });
        const changesSummary = `Group "${beforeState.name}" updated: name="${updatedGroup.name}", discoverable=${updatedGroup.isDiscoverable}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_GROUP_FULL',
            targetUserId: group.ownerId,
            targetUser: `@${group.owner.username} (Group: ${updatedGroup.name})`,
            reason,
            beforeState,
            afterState: updatedGroup,
        });
        await dispatchAdminNotification({
            userId: group.ownerId,
            adminUsername: req.admin.username,
            actionTitle: `Group "${updatedGroup.name}" Updated by Admin`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Group "${updatedGroup.name}" settings successfully updated.`,
            group: updatedGroup,
        });
    }
    catch (err) {
        console.error('adminUpdateGroupFull error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update group settings.' });
    }
}
/**
 * Search all groups across the platform for Super Admin management
 */
async function searchGroupsForAdmin(req, res) {
    try {
        const q = (req.query.q || '').trim();
        const where = q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                    { joinCode: { equals: q.toUpperCase() } },
                    { owner: { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } } },
                ],
            }
            : {};
        const groups = await prisma_1.default.group.findMany({
            where,
            take: 50,
            orderBy: [{ members: { _count: 'desc' } }, { createdAt: 'desc' }],
            include: {
                owner: { select: { id: true, name: true, username: true, email: true } },
                _count: { select: { members: true, tasks: true } },
            },
        });
        return res.json({
            success: true,
            groups: groups.map((g) => ({
                id: g.id,
                name: g.name,
                description: g.description,
                joinCode: g.joinCode,
                isDiscoverable: g.isDiscoverable !== false,
                scheduledDays: g.scheduledDays,
                memberCount: g._count.members,
                taskCount: g._count.tasks,
                ownerId: g.ownerId,
                owner: g.owner,
                hiddenFrom: g.hiddenFrom,
                visibleOnlyTo: g.visibleOnlyTo,
                isSpecialGroup: g.isSpecialGroup,
                specialPlatform: g.specialPlatform,
                detectedPlatform: (0, specialGroupRegistry_1.detectSpecialPlatform)(g.name),
                createdAt: g.createdAt,
            })),
        });
    }
    catch (err) {
        console.error('searchGroupsForAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to search groups.' });
    }
}
/**
 * Toggle Group Discoverability (Discoverable vs Non-discoverable)
 */
async function adminToggleGroupDiscoverability(req, res) {
    try {
        const { groupId } = req.params;
        const { isDiscoverable, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof isDiscoverable !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isDiscoverable must be a boolean (true or false).' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            include: {
                owner: { select: { id: true, username: true, email: true } },
            },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        const beforeState = {
            groupId: group.id,
            name: group.name,
            isDiscoverable: group.isDiscoverable,
        };
        const updatedGroup = await prisma_1.default.group.update({
            where: { id: groupId },
            data: { isDiscoverable },
        });
        const statusLabel = isDiscoverable ? 'Discoverable' : 'Non-discoverable';
        const changesSummary = `Group "${group.name}" visibility changed to ${statusLabel}. ${isDiscoverable
            ? 'Now visible in public discovery feeds and recommendations.'
            : 'Hidden from discovery feeds; remains searchable by name/code and accessible to all existing members.'}`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'GROUP_DISCOVERABILITY_OVERRIDE',
            targetUserId: group.ownerId,
            targetUser: `@${group.owner.username} (Group: ${group.name})`,
            reason,
            beforeState,
            afterState: {
                groupId: updatedGroup.id,
                name: updatedGroup.name,
                isDiscoverable: updatedGroup.isDiscoverable,
            },
        });
        await dispatchAdminNotification({
            userId: group.ownerId,
            adminUsername: req.admin.username,
            actionTitle: `Group Visibility Changed to ${statusLabel}`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Group "${group.name}" is now marked ${statusLabel}.`,
            group: updatedGroup,
        });
    }
    catch (err) {
        console.error('adminToggleGroupDiscoverability error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update group discoverability.' });
    }
}
/**
 * Remove streak freeze from a specific date and recalculate streaks
 */
async function unfreezeUserDate(req, res) {
    try {
        const { userId, date } = req.params;
        const { reason } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, timezone: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const deleted = await prisma_1.default.freezeLog.deleteMany({
            where: {
                userId,
                protectedDate: date,
            },
        });
        // Recalculate streaks after removing freeze
        const updatedStreaks = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, user.timezone);
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'REMOVE_DAY_FREEZE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { protectedDate: date, deletedCount: deleted.count },
            afterState: { currentStreak: updatedStreaks.currentStreak, longestStreak: updatedStreaks.longestStreak },
        });
        return res.json({
            success: true,
            message: `Freeze protection for ${date} removed. Streaks recalculated.`,
            streaks: updatedStreaks,
        });
    }
    catch (err) {
        console.error('unfreezeUserDate error:', err);
        return res.status(500).json({ success: false, error: 'Failed to remove freeze on selected date.' });
    }
}
/**
 * Delete a reminder schedule by admin
 */
async function adminDeleteReminderSchedule(req, res) {
    try {
        const { reminderId } = req.params;
        const { reason } = req.body;
        const reminder = await prisma_1.default.reminderSchedule.findUnique({
            where: { id: reminderId },
            include: { user: { select: { id: true, username: true } } },
        });
        if (!reminder) {
            return res.status(404).json({ success: false, error: 'Reminder schedule not found.' });
        }
        await prisma_1.default.reminderSchedule.delete({ where: { id: reminderId } });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'DELETE_REMINDER_SCHEDULE',
            targetUserId: reminder.userId,
            targetUser: `@${reminder.user.username}`,
            reason: reason || 'Admin removed reminder schedule',
            beforeState: reminder,
            afterState: { deleted: true },
        });
        return res.json({
            success: true,
            message: `Reminder schedule for ${reminder.time} deleted.`,
        });
    }
    catch (err) {
        console.error('adminDeleteReminderSchedule error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete reminder schedule.' });
    }
}
/**
 * Override the visible leaderboard cohort limit for a specific user
 */
async function overrideLeaderboardLimit(req, res) {
    try {
        const { userId } = req.params;
        const { leaderboardLimit, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof leaderboardLimit !== 'number' || leaderboardLimit < 1 || leaderboardLimit > 100) {
            return res.status(400).json({ success: false, error: 'Leaderboard limit must be an integer between 1 and 100.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeLimit = (0, adminConfigService_1.getUserLeaderboardLimit)(userId);
        (0, adminConfigService_1.setUserLeaderboardLimit)(userId, leaderboardLimit);
        const changesSummary = `Global leaderboard visible cohort changed from Top ${beforeLimit} to Top ${leaderboardLimit}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_LEADERBOARD_LIMIT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { leaderboardLimit: beforeLimit },
            afterState: { leaderboardLimit },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Leaderboard Cohort Quota Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Global leaderboard display quota for @${user.username} increased to Top ${leaderboardLimit}.`,
            leaderboardLimit,
        });
    }
    catch (err) {
        console.error('overrideLeaderboardLimit error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update leaderboard limit.' });
    }
}
/**
 * Override the maximum scheduled reminders quota for a specific user
 */
async function overrideReminderLimit(req, res) {
    try {
        const { userId } = req.params;
        const { reminderLimit, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof reminderLimit !== 'number' || reminderLimit < 1 || reminderLimit > 50) {
            return res.status(400).json({ success: false, error: 'Reminder quota limit must be an integer between 1 and 50.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeLimit = (0, adminConfigService_1.getUserReminderLimit)(userId);
        (0, adminConfigService_1.setUserReminderLimit)(userId, reminderLimit);
        const changesSummary = `Daily scheduled reminders quota changed from ${beforeLimit} to ${reminderLimit} reminders.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_REMINDER_LIMIT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { reminderLimit: beforeLimit },
            afterState: { reminderLimit },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Scheduled Reminders Quota Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Daily scheduled reminders limit for @${user.username} updated to ${reminderLimit}.`,
            reminderLimit,
        });
    }
    catch (err) {
        console.error('overrideReminderLimit error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update reminder limit.' });
    }
}
/**
 * Override the maximum task-specific reminders quota for a specific user
 */
async function overrideTaskReminderLimit(req, res) {
    try {
        const { userId } = req.params;
        const { taskReminderLimit, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof taskReminderLimit !== 'number' || taskReminderLimit < 1 || taskReminderLimit > 50) {
            return res.status(400).json({ success: false, error: 'Task reminder quota limit must be an integer between 1 and 50.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeLimit = (0, adminConfigService_1.getUserTaskReminderLimit)(userId);
        (0, adminConfigService_1.setUserTaskReminderLimit)(userId, taskReminderLimit);
        const changesSummary = `Per-task scheduled reminders quota changed from ${beforeLimit} to ${taskReminderLimit} reminders per task.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_TASK_REMINDER_LIMIT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { taskReminderLimit: beforeLimit },
            afterState: { taskReminderLimit },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Per-Task Reminders Quota Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Per-task scheduled reminders limit for @${user.username} updated to ${taskReminderLimit} per task.`,
            taskReminderLimit,
        });
    }
    catch (err) {
        console.error('overrideTaskReminderLimit error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update per-task reminder limit.' });
    }
}
/**
 * Override the top discover ranking groups limit for a specific user
 */
async function overrideDiscoverGroupsLimit(req, res) {
    try {
        const { userId } = req.params;
        const { discoverGroupsLimit, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof discoverGroupsLimit !== 'number' || discoverGroupsLimit < 1 || discoverGroupsLimit > 100) {
            return res.status(400).json({ success: false, error: 'Discover groups limit must be an integer between 1 and 100.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeLimit = (0, adminConfigService_1.getUserDiscoverGroupsLimit)(userId);
        (0, adminConfigService_1.setUserDiscoverGroupsLimit)(userId, discoverGroupsLimit);
        const changesSummary = `Discover groups ranking visible quota changed from Top ${beforeLimit} to Top ${discoverGroupsLimit} groups.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_DISCOVER_GROUPS_LIMIT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { discoverGroupsLimit: beforeLimit },
            afterState: { discoverGroupsLimit },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Discover Groups Display Quota Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Top Discover ranking groups quota for @${user.username} updated to Top ${discoverGroupsLimit}.`,
            discoverGroupsLimit,
        });
    }
    catch (err) {
        console.error('overrideDiscoverGroupsLimit error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update discover groups limit.' });
    }
}
/**
 * Override the maximum profile picture upload size limit (in MB) for a specific user
 */
async function overrideProfileImageLimit(req, res) {
    try {
        const { userId } = req.params;
        const { profileImageLimitMb, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof profileImageLimitMb !== 'number' || profileImageLimitMb < 1 || profileImageLimitMb > 100) {
            return res.status(400).json({ success: false, error: 'Profile image size quota must be between 1 MB and 100 MB.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeLimit = (0, adminConfigService_1.getUserProfileImageLimitMb)(userId);
        (0, adminConfigService_1.setUserProfileImageLimitMb)(userId, profileImageLimitMb);
        const changesSummary = `Profile picture max upload size quota changed from ${beforeLimit} MB to ${profileImageLimitMb} MB.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'OVERRIDE_PROFILE_IMAGE_LIMIT',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { profileImageLimitMb: beforeLimit },
            afterState: { profileImageLimitMb },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Profile Picture Upload Quota Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Profile picture max upload size for @${user.username} updated to ${profileImageLimitMb} MB.`,
            profileImageLimitMb,
        });
    }
    catch (err) {
        console.error('overrideProfileImageLimit error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update profile image limit.' });
    }
}
/**
 * Super Admin updates or removes profile picture for a specific user
 */
async function adminUpdateUserProfileImage(req, res) {
    try {
        const { userId } = req.params;
        const { profileImage, remove = false, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeImage = user.profileImage;
        let newImage = null;
        if (!remove && profileImage) {
            if (typeof profileImage !== 'string') {
                return res.status(400).json({ success: false, error: 'Invalid profile image format.' });
            }
            // Check if data URI
            const dataUriMatch = profileImage.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i);
            if (dataUriMatch) {
                const declaredMime = dataUriMatch[1].toLowerCase();
                const base64Data = dataUriMatch[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const sizeInBytes = buffer.length;
                const limitMb = (0, adminConfigService_1.getUserProfileImageLimitMb)(userId);
                const MAX_SIZE_BYTES = limitMb * 1024 * 1024;
                if (sizeInBytes > MAX_SIZE_BYTES) {
                    return res.status(400).json({
                        success: false,
                        error: `Image size exceeds the ${limitMb} MB limit. Provided image is ${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB.`
                    });
                }
                if (declaredMime !== 'gif') {
                    const validation = (0, imageValidator_1.validateImageBuffer)(buffer, declaredMime);
                    if (!validation.valid) {
                        return res.status(400).json({
                            success: false,
                            error: validation.error || 'The uploaded file is empty or corrupted.'
                        });
                    }
                }
                newImage = profileImage;
            }
            else if (/^https?:\/\/.+/i.test(profileImage)) {
                // Direct URL
                newImage = profileImage.trim();
            }
            else {
                return res.status(400).json({
                    success: false,
                    error: 'Image must be a valid Data URI (JPEG, PNG, WebP) or HTTP(S) URL.'
                });
            }
        }
        else {
            newImage = null;
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { profileImage: newImage },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
            },
        });
        const isRemoved = newImage === null;
        const changesSummary = isRemoved
            ? 'Your profile picture was removed by administration.'
            : 'Your profile picture was updated by administration.';
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: isRemoved ? 'ADMIN_REMOVE_PROFILE_IMAGE' : 'ADMIN_UPDATE_PROFILE_IMAGE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { profileImage: beforeImage ? (beforeImage.length > 100 ? `${beforeImage.slice(0, 100)}...` : beforeImage) : null },
            afterState: { profileImage: newImage ? (newImage.length > 100 ? `${newImage.slice(0, 100)}...` : newImage) : null },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: isRemoved ? 'Profile Picture Removed' : 'Profile Picture Updated',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: isRemoved
                ? `Profile image removed for @${user.username}.`
                : `Profile image updated successfully for @${user.username}.`,
            user: updatedUser,
        });
    }
    catch (err) {
        console.error('adminUpdateUserProfileImage error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update profile image.' });
    }
}
/**
 * Get comprehensive effective reminder configuration and schedules for a user
 */
async function getUserReminderSettings(req, res) {
    try {
        const { userId } = req.params;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                notificationPreference: true,
                reminderSchedules: {
                    orderBy: { time: 'asc' },
                    include: {
                        task: {
                            select: {
                                id: true,
                                title: true,
                                status: true,
                                recurrence: true,
                                scheduledDays: true,
                                isGroupTask: true,
                                groupId: true,
                                group: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
                tasks: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        group: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const timezone = user.timezone || 'Asia/Kolkata';
        const quotaLimit = (0, adminConfigService_1.getUserReminderLimit)(userId);
        const taskQuotaLimit = (0, adminConfigService_1.getUserTaskReminderLimit)(userId);
        // 1. Overall Schedules
        const overallSchedules = user.reminderSchedules
            .filter((s) => s.scope === 'OVERALL')
            .map((s) => ({
            id: s.id,
            time: s.time,
            isEnabled: s.isEnabled,
            nextOccurrence: (0, reminderSchedulerService_1.calculateNextOccurrence)(s.time, timezone, undefined, s.isEnabled),
        }));
        const isOverallEnabled = user.notificationPreference?.overallStreakRemindersEmail !== false &&
            overallSchedules.some((s) => s.isEnabled);
        // 2. Task Schedules (Personal & Group tasks, up to taskQuotaLimit per task)
        const taskSettings = user.tasks.map((task) => {
            const schedules = user.reminderSchedules
                .filter((s) => s.scope === 'TASK' && s.taskId === task.id)
                .map((s) => ({
                id: s.id,
                time: s.time,
                isEnabled: s.isEnabled,
                nextOccurrence: (0, reminderSchedulerService_1.calculateNextOccurrence)(s.time, timezone, task.scheduledDays, s.isEnabled),
            }));
            const isTaskEnabled = user.notificationPreference?.taskRemindersEmail !== false &&
                schedules.some((s) => s.isEnabled);
            return {
                taskId: task.id,
                title: task.title,
                recurrence: task.recurrence,
                scheduledDays: task.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
                isGroupTask: task.isGroupTask || Boolean(task.groupId),
                groupName: task.group?.name || null,
                taskRemindersEnabled: isTaskEnabled,
                schedules,
                maxAllowed: taskQuotaLimit,
            };
        });
        return res.json({
            success: true,
            timezone,
            quotaLimit,
            taskQuotaLimit,
            preferences: user.notificationPreference || {
                emailNotificationsEnabled: true,
                inAppNotificationsEnabled: true,
                overallStreakRemindersEmail: true,
                overallStreakRemindersInApp: true,
                taskRemindersEmail: true,
                taskRemindersInApp: true,
                friendOverallActivityAlerts: true,
                friendOverallActivityInApp: true,
                friendTaskActivityAlerts: true,
                friendTaskActivityInApp: true,
                friendOverallMilestones: true,
                friendOverallMilestonesInApp: true,
                friendTaskMilestones: true,
                friendTaskMilestonesInApp: true,
                myMilestonesEmail: true,
                myMilestonesInApp: true,
                freezeStatusNotifications: true,
                freezeStatusInApp: true,
            },
            overall: {
                isEnabled: isOverallEnabled,
                schedules: overallSchedules,
                emailNotificationsEnabled: user.notificationPreference?.emailNotificationsEnabled ?? true,
                customNotificationEmail: user.notificationPreference?.customNotificationEmail || null,
            },
            tasks: taskSettings,
        });
    }
    catch (err) {
        console.error('getUserReminderSettings error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve reminder settings.' });
    }
}
/**
 * Super Admin updates overall streak reminder schedule and enabled status
 */
async function adminUpdateOverallReminders(req, res) {
    try {
        const { userId } = req.params;
        const { isEnabled, times, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof isEnabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isEnabled must be a boolean.' });
        }
        if (!Array.isArray(times)) {
            return res.status(400).json({ success: false, error: 'times must be an array of "HH:mm" strings.' });
        }
        const quotaLimit = (0, adminConfigService_1.getUserReminderLimit)(userId);
        if (times.length > quotaLimit) {
            return res.status(400).json({
                success: false,
                error: `Cannot configure ${times.length} times. Quota limit for this user is ${quotaLimit}.`,
            });
        }
        // Validate times format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const formattedTimes = [];
        for (const t of times) {
            if (!timeRegex.test(String(t).trim())) {
                return res.status(400).json({ success: false, error: `Invalid time format "${t}". Use 24hr format HH:mm.` });
            }
            const [h, m] = String(t).trim().split(':');
            const norm = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
            if (!formattedTimes.includes(norm)) {
                formattedTimes.push(norm);
            }
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                reminderSchedules: { where: { scope: 'OVERALL' } },
                notificationPreference: true,
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeState = {
            overallStreakRemindersEmail: user.notificationPreference?.overallStreakRemindersEmail ?? true,
            times: user.reminderSchedules.map((s) => s.time),
        };
        // Apply database updates atomically
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Clear old overall schedules
            await tx.reminderSchedule.deleteMany({
                where: { userId, scope: 'OVERALL' },
            });
            // 2. Insert new schedules if any
            if (formattedTimes.length > 0) {
                await tx.reminderSchedule.createMany({
                    data: formattedTimes.map((t) => ({
                        userId,
                        scope: 'OVERALL',
                        time: t,
                        isEnabled,
                    })),
                });
            }
            // 3. Update notification preferences to ensure reminder delivery is active
            await tx.notificationPreference.upsert({
                where: { userId },
                create: {
                    userId,
                    emailNotificationsEnabled: true,
                    inAppNotificationsEnabled: true,
                    overallStreakRemindersEmail: isEnabled,
                    overallStreakRemindersInApp: isEnabled,
                },
                update: {
                    emailNotificationsEnabled: true,
                    inAppNotificationsEnabled: true,
                    overallStreakRemindersEmail: isEnabled,
                    overallStreakRemindersInApp: isEnabled,
                },
            });
        });
        const changesSummary = `Overall streak reminders ${isEnabled ? 'ENABLED' : 'PAUSED'}. Scheduled times: ${formattedTimes.length > 0 ? formattedTimes.join(', ') : 'None'}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_OVERALL_REMINDERS',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: {
                isEnabled,
                times: formattedTimes,
            },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Overall Streak Reminders Updated by Admin',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Overall streak reminder settings updated for @${user.username}.`,
            isEnabled,
            times: formattedTimes,
        });
    }
    catch (err) {
        console.error('adminUpdateOverallReminders error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update overall reminders.' });
    }
}
/**
 * Super Admin updates personal or group task reminder schedule (up to 2 times per task)
 */
async function adminUpdateTaskReminders(req, res) {
    try {
        const { userId, taskId } = req.params;
        const { isEnabled, times, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (typeof isEnabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isEnabled must be a boolean.' });
        }
        if (!Array.isArray(times)) {
            return res.status(400).json({ success: false, error: 'times must be an array of "HH:mm" strings.' });
        }
        // Up to taskQuotaLimit independently configurable reminder times per task
        const taskQuotaLimit = (0, adminConfigService_1.getUserTaskReminderLimit)(userId);
        if (times.length > taskQuotaLimit) {
            return res.status(400).json({
                success: false,
                error: `Tasks are permitted a maximum of ${taskQuotaLimit} independently configurable reminder ${taskQuotaLimit === 1 ? 'time' : 'times'}.`,
            });
        }
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const formattedTimes = [];
        for (const t of times) {
            if (!timeRegex.test(String(t).trim())) {
                return res.status(400).json({ success: false, error: `Invalid time format "${t}". Use 24hr format HH:mm.` });
            }
            const [h, m] = String(t).trim().split(':');
            const norm = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
            if (!formattedTimes.includes(norm)) {
                formattedTimes.push(norm);
            }
        }
        const task = await prisma_1.default.task.findUnique({
            where: { id: taskId },
            include: {
                user: { select: { id: true, username: true } },
                group: { select: { id: true, name: true } },
            },
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        const existingSchedules = await prisma_1.default.reminderSchedule.findMany({
            where: { userId, scope: 'TASK', taskId },
        });
        const beforeState = {
            taskId,
            taskTitle: task.title,
            times: existingSchedules.map((s) => s.time),
            isEnabled: existingSchedules.length > 0 ? existingSchedules[0].isEnabled : true,
        };
        // Apply database updates atomically
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete previous schedules for this specific task
            await tx.reminderSchedule.deleteMany({
                where: { userId, scope: 'TASK', taskId },
            });
            // 2. Insert updated schedules (up to 2)
            if (formattedTimes.length > 0) {
                await tx.reminderSchedule.createMany({
                    data: formattedTimes.map((t) => ({
                        userId,
                        scope: 'TASK',
                        taskId,
                        time: t,
                        isEnabled,
                    })),
                });
            }
            // 3. Update notification preferences to ensure reminder delivery is active
            await tx.notificationPreference.upsert({
                where: { userId },
                create: {
                    userId,
                    emailNotificationsEnabled: true,
                    inAppNotificationsEnabled: true,
                    taskRemindersEmail: isEnabled,
                    taskRemindersInApp: isEnabled,
                },
                update: {
                    emailNotificationsEnabled: true,
                    inAppNotificationsEnabled: true,
                    taskRemindersEmail: isEnabled,
                    taskRemindersInApp: isEnabled,
                },
            });
        });
        const changesSummary = `Reminders for task "${task.title}" ${isEnabled ? 'ENABLED' : 'PAUSED'}. Scheduled times (${formattedTimes.length}/2): ${formattedTimes.length > 0 ? formattedTimes.join(', ') : 'None'}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_TASK_REMINDERS',
            targetUserId: userId,
            targetUser: `@${task.user.username} (Task: ${task.title})`,
            reason,
            beforeState,
            afterState: {
                taskId,
                isEnabled,
                times: formattedTimes,
            },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `Task Reminders Updated: "${task.title}"`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Reminders for "${task.title}" updated successfully.`,
            taskId,
            isEnabled,
            times: formattedTimes,
        });
    }
    catch (err) {
        console.error('adminUpdateTaskReminders error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update task reminders.' });
    }
}
/**
 * Super Admin sends an instant test reminder to a user via In-App and Email
 */
async function adminSendTestReminder(req, res) {
    try {
        const { userId } = req.params;
        const { scope = 'OVERALL', taskId, reason = 'Admin dispatched test reminder' } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, username: true, email: true, timezone: true, currentStreak: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
        const { buildOverallReminderEmail, buildTaskReminderEmail } = await Promise.resolve().then(() => __importStar(require('../services/emailService')));
        let title = '';
        let message = '';
        let category;
        let emailSubject = '';
        let emailText = '';
        let actionUrl = '/dashboard';
        if (scope === 'TASK' && taskId) {
            const task = await prisma_1.default.task.findUnique({
                where: { id: taskId },
                select: { id: true, title: true, currentStreak: true },
            });
            if (!task) {
                return res.status(404).json({ success: false, error: 'Task not found.' });
            }
            category = client_1.NotificationCategory.TASK_REMINDER;
            title = `⚡ Reminder: ${task.title} (Test)`;
            message = `[Admin Test Reminder] Don't forget to complete your "${task.title}" task today to keep your streak going!`;
            actionUrl = '/tasks';
            const emailContent = buildTaskReminderEmail({
                name: user.name,
                taskTitle: task.title,
                currentStreak: task.currentStreak,
                timeRemaining: 'few hours',
            });
            emailSubject = `[Test Reminder] ⚡ ${task.title}`;
            emailText = emailContent.text;
        }
        else {
            category = client_1.NotificationCategory.OVERALL_REMINDER;
            title = '🔥 StreakUp Streak Waiting (Test)';
            message = `[Admin Test Reminder] You haven't completed a task today yet. Complete at least one task before your day ends to maintain your ${user.currentStreak}-day streak!`;
            actionUrl = '/dashboard';
            const emailContent = buildOverallReminderEmail({
                name: user.name,
                currentStreak: user.currentStreak,
                timeRemaining: 'few hours',
            });
            emailSubject = `[Test Reminder] 🔥 StreakUp Streak Waiting`;
            emailText = emailContent.text;
        }
        await createNotification({
            userId: user.id,
            category,
            title,
            message,
            taskId: taskId || null,
            actionUrl,
            eventKey: `ADMIN_TEST_REMINDER:${userId}:${Date.now()}`,
            emailSubject,
            emailText,
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'SEND_TEST_REMINDER',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: null,
            afterState: { scope, taskId },
        });
        return res.json({
            success: true,
            message: `Test ${scope === 'TASK' ? 'task' : 'overall'} reminder dispatched to @${user.username} via In-App and Email.`,
        });
    }
    catch (err) {
        console.error('adminSendTestReminder error:', err);
        return res.status(500).json({ success: false, error: 'Failed to dispatch test reminder.' });
    }
}
/**
 * Super Admin triggers manual execution check of reminders on demand
 */
async function adminTriggerManualReminderCheck(req, res) {
    try {
        const result = await (0, reminderSchedulerService_1.runReminderCheck)();
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'TRIGGER_MANUAL_REMINDER_CHECK',
            reason: 'Manual on-demand check of active reminder schedules executed by administrator.',
            beforeState: null,
            afterState: result,
        });
        return res.json({
            success: true,
            message: 'Reminder execution check completed.',
            timestamp: new Date().toISOString(),
            ...result,
        });
    }
    catch (err) {
        console.error('adminTriggerManualReminderCheck error:', err);
        return res.status(500).json({ success: false, error: 'Failed to execute reminder check.' });
    }
}
/**
 * Super Admin updates a user's notification channel delivery preferences
 */
async function adminUpdateUserPreferences(req, res) {
    try {
        const { userId } = req.params;
        const { preferences, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
        }
        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({ success: false, error: 'preferences object is required.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { notificationPreference: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const beforeState = user.notificationPreference || null;
        const updated = await prisma_1.default.notificationPreference.upsert({
            where: { userId },
            update: {
                ...(preferences.emailNotificationsEnabled !== undefined ? { emailNotificationsEnabled: preferences.emailNotificationsEnabled } : {}),
                ...(preferences.inAppNotificationsEnabled !== undefined ? { inAppNotificationsEnabled: preferences.inAppNotificationsEnabled } : {}),
                ...(preferences.overallStreakRemindersEmail !== undefined ? { overallStreakRemindersEmail: preferences.overallStreakRemindersEmail } : {}),
                ...(preferences.overallStreakRemindersInApp !== undefined ? { overallStreakRemindersInApp: preferences.overallStreakRemindersInApp } : {}),
                ...(preferences.taskRemindersEmail !== undefined ? { taskRemindersEmail: preferences.taskRemindersEmail } : {}),
                ...(preferences.taskRemindersInApp !== undefined ? { taskRemindersInApp: preferences.taskRemindersInApp } : {}),
                ...(preferences.friendOverallActivityAlerts !== undefined ? { friendOverallActivityAlerts: preferences.friendOverallActivityAlerts } : {}),
                ...(preferences.friendOverallActivityInApp !== undefined ? { friendOverallActivityInApp: preferences.friendOverallActivityInApp } : {}),
                ...(preferences.friendTaskActivityAlerts !== undefined ? { friendTaskActivityAlerts: preferences.friendTaskActivityAlerts } : {}),
                ...(preferences.friendTaskActivityInApp !== undefined ? { friendTaskActivityInApp: preferences.friendTaskActivityInApp } : {}),
                ...(preferences.friendOverallMilestones !== undefined ? { friendOverallMilestones: preferences.friendOverallMilestones } : {}),
                ...(preferences.friendOverallMilestonesInApp !== undefined ? { friendOverallMilestonesInApp: preferences.friendOverallMilestonesInApp } : {}),
                ...(preferences.friendTaskMilestones !== undefined ? { friendTaskMilestones: preferences.friendTaskMilestones } : {}),
                ...(preferences.friendTaskMilestonesInApp !== undefined ? { friendTaskMilestonesInApp: preferences.friendTaskMilestonesInApp } : {}),
                ...(preferences.myMilestonesEmail !== undefined ? { myMilestonesEmail: preferences.myMilestonesEmail } : {}),
                ...(preferences.myMilestonesInApp !== undefined ? { myMilestonesInApp: preferences.myMilestonesInApp } : {}),
                ...(preferences.freezeStatusNotifications !== undefined ? { freezeStatusNotifications: preferences.freezeStatusNotifications } : {}),
                ...(preferences.freezeStatusInApp !== undefined ? { freezeStatusInApp: preferences.freezeStatusInApp } : {}),
            },
            create: {
                userId,
                emailNotificationsEnabled: preferences.emailNotificationsEnabled ?? true,
                inAppNotificationsEnabled: preferences.inAppNotificationsEnabled ?? true,
                overallStreakRemindersEmail: preferences.overallStreakRemindersEmail ?? true,
                overallStreakRemindersInApp: preferences.overallStreakRemindersInApp ?? true,
                taskRemindersEmail: preferences.taskRemindersEmail ?? true,
                taskRemindersInApp: preferences.taskRemindersInApp ?? true,
                friendOverallActivityAlerts: preferences.friendOverallActivityAlerts ?? true,
                friendOverallActivityInApp: preferences.friendOverallActivityInApp ?? true,
                friendTaskActivityAlerts: preferences.friendTaskActivityAlerts ?? true,
                friendTaskActivityInApp: preferences.friendTaskActivityInApp ?? true,
                friendOverallMilestones: preferences.friendOverallMilestones ?? true,
                friendOverallMilestonesInApp: preferences.friendOverallMilestonesInApp ?? true,
                friendTaskMilestones: preferences.friendTaskMilestones ?? true,
                friendTaskMilestonesInApp: preferences.friendTaskMilestonesInApp ?? true,
                myMilestonesEmail: preferences.myMilestonesEmail ?? true,
                myMilestonesInApp: preferences.myMilestonesInApp ?? true,
                freezeStatusNotifications: preferences.freezeStatusNotifications ?? true,
                freezeStatusInApp: preferences.freezeStatusInApp ?? true,
            },
        });
        const changesSummary = `Updated in-app & email notification trigger channels for @${user.username}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'UPDATE_NOTIFICATION_PREFERENCES',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: updated,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: 'Notification Delivery Channels Updated by Admin',
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Notification preferences updated for @${user.username}.`,
            preferences: updated,
        });
    }
    catch (err) {
        console.error('adminUpdateUserPreferences error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update user notification preferences.' });
    }
}
// ========================================================
// LINKEDIN GROUP GAMES DEDICATED SUPER ADMIN CONTROLS
// ========================================================
/**
 * Retrieve all 8 LinkedIn games and streaks for a selected group member
 */
async function getMemberLinkedInGamesAdmin(req, res) {
    try {
        const { userId, groupId } = req.params;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true, joinCode: true },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        const isLinkedIn = (0, linkedInGameService_1.isLinkedInName)(group.name);
        if (!isLinkedIn) {
            return res.status(400).json({ success: false, error: 'Target group is not a LinkedIn group.' });
        }
        const games = await (0, linkedInGameService_1.getAllGamesForMember)(groupId, userId, user.timezone || 'Asia/Kolkata');
        return res.json({
            success: true,
            user,
            group,
            games,
        });
    }
    catch (err) {
        console.error('getMemberLinkedInGamesAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to load member LinkedIn games.' });
    }
}
/**
 * Admin streak correction for an individual LinkedIn game
 */
async function adminCorrectLinkedInGameStreak(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { gameId, currentStreak, longestStreak, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, applyToOverall = false, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (typeof currentStreak !== 'number' || currentStreak < 0) {
            return res.status(400).json({ success: false, error: 'Valid non-negative current streak is required.' });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group || !(0, linkedInGameService_1.isLinkedInName)(group.name)) {
            return res.status(400).json({ success: false, error: 'Target group is not a LinkedIn group.' });
        }
        const beforeState = await (0, linkedInGameService_1.getSingleGameForMember)(groupId, userId, normalizedGameId, user.timezone);
        const updatedGame = await (0, linkedInGameService_1.adminCorrectGameStreak)(groupId, userId, normalizedGameId, currentStreak, typeof longestStreak === 'number' ? longestStreak : currentStreak);
        if (applyToOverall) {
            const uCurrent = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { longestStreak: true } });
            const nextLongest = Math.max(uCurrent?.longestStreak || 0, updatedGame.longestStreak, currentStreak);
            await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    currentStreak,
                    longestStreak: nextLongest,
                },
            });
        }
        // Also sync the parent LinkedIn task in Prisma for this user
        await prisma_1.default.task.updateMany({
            where: {
                userId,
                groupId,
                status: { in: ['ACTIVE', 'ARCHIVED'] },
            },
            data: {
                currentStreak,
                longestStreak: updatedGame.longestStreak,
            },
        });
        const changesSummary = `LinkedIn game "${updatedGame.name}" streak corrected: ${beforeState?.currentStreak ?? 0}d -> ${currentStreak}d (best: ${updatedGame.longestStreak}d)${applyToOverall ? ' [Applied to user overall streak]' : ''}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'LINKEDIN_GAME_STREAK_CORRECTION',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: updatedGame,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `LinkedIn ${updatedGame.name} Streak Corrected`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Streak for ${updatedGame.name} successfully updated to ${currentStreak} days.`,
            game: updatedGame,
        });
    }
    catch (err) {
        console.error('adminCorrectLinkedInGameStreak error:', err);
        return res.status(500).json({ success: false, error: 'Failed to correct LinkedIn game streak.' });
    }
}
/**
 * Super Admin retroactively grants or toggles completion for an individual LinkedIn game
 */
async function adminGrantLinkedInGameDate(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { gameId, date, studyNote, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, applyToOverall = false, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, error: 'A valid calendar date (YYYY-MM-DD) is required.' });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group || !(0, linkedInGameService_1.isLinkedInName)(group.name)) {
            return res.status(400).json({ success: false, error: 'Target group is not a LinkedIn group.' });
        }
        const beforeState = await (0, linkedInGameService_1.getSingleGameForMember)(groupId, userId, normalizedGameId, user.timezone);
        const updatedGame = await (0, linkedInGameService_1.adminGrantGameDate)(groupId, userId, normalizedGameId, date, studyNote);
        if (applyToOverall) {
            const parentTask = await prisma_1.default.task.findFirst({
                where: { userId, groupId, status: { in: ['ACTIVE', 'ARCHIVED'] } },
            });
            if (parentTask) {
                await prisma_1.default.taskCompletion.upsert({
                    where: {
                        taskId_completionDate: {
                            taskId: parentTask.id,
                            completionDate: date,
                        },
                    },
                    create: {
                        userId,
                        taskId: parentTask.id,
                        completionDate: date,
                        completedAt: new Date(`${date}T12:00:00Z`),
                        studyNote: studyNote || `Granted by admin for ${updatedGame.name}`,
                    },
                    update: {
                        studyNote: studyNote || undefined,
                    },
                });
                await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, parentTask.id, userId, user.timezone);
                await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, user.timezone);
            }
        }
        const changesSummary = `LinkedIn game "${updatedGame.name}" check-in granted for date ${date}. New streak: ${updatedGame.currentStreak}d.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'LINKEDIN_GAME_GRANT_DATE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: updatedGame,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `LinkedIn ${updatedGame.name} Check-in Granted`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Check-in for ${updatedGame.name} on ${date} recorded successfully.`,
            game: updatedGame,
        });
    }
    catch (err) {
        console.error('adminGrantLinkedInGameDate error:', err);
        return res.status(500).json({ success: false, error: 'Failed to grant LinkedIn game date.' });
    }
}
/**
 * Super Admin applies or removes freeze protection on a calendar date for an individual LinkedIn game
 */
async function adminFreezeLinkedInGameDate(req, res) {
    return res.status(400).json({
        success: false,
        error: 'Streak freeze is disabled for LinkedIn games and LinkedIn groups.',
    });
}
/**
 * Super Admin sets commitment for an individual member's LinkedIn game
 */
async function adminSetLinkedInGameCommitment(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { gameId, isCommitted, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (typeof isCommitted !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Valid commitment boolean is required.' });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group || !(0, linkedInGameService_1.isLinkedInName)(group.name)) {
            return res.status(400).json({ success: false, error: 'Target group is not a LinkedIn group.' });
        }
        const beforeState = await (0, linkedInGameService_1.getSingleGameForMember)(groupId, userId, normalizedGameId, user.timezone);
        const updatedGame = await (0, linkedInGameService_1.setGameCommitment)(groupId, userId, normalizedGameId, isCommitted, user.timezone);
        const changesSummary = `LinkedIn game "${updatedGame.name}" commitment set to ${isCommitted ? 'COMMITTED' : 'UNCOMMITTED'}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'LINKEDIN_GAME_COMMITMENT_CHANGE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState,
            afterState: updatedGame,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `LinkedIn ${updatedGame.name} Commitment Updated`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Commitment for ${updatedGame.name} set to ${isCommitted ? 'Committed' : 'Uncommitted'}.`,
            game: updatedGame,
        });
    }
    catch (err) {
        console.error('adminSetLinkedInGameCommitment error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update LinkedIn game commitment.' });
    }
}
/**
 * GET /api/admin/managers - List all current managers
 */
async function getManagersAdmin(req, res) {
    try {
        const managers = await (0, managerService_1.getAllManagers)();
        return res.json({ success: true, managers });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Failed to fetch managers.' });
    }
}
/**
 * POST /api/admin/managers - Grant Manager access to a user
 */
async function grantManagerAdmin(req, res) {
    try {
        const { userId, emailNotificationsEnabled = true } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required.' });
        }
        const manager = await (0, managerService_1.grantManagerAccess)({
            userId,
            grantedBy: req.admin?.username || 'admin',
            emailNotificationsEnabled: Boolean(emailNotificationsEnabled),
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'GRANT_MANAGER_ACCESS',
            targetUserId: userId,
            targetUser: `@${manager.username}`,
            reason: 'Admin granted Manager access',
            afterState: manager,
        });
        return res.status(201).json({
            success: true,
            message: `Manager access granted to @${manager.username}.`,
            manager,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message || 'Failed to grant manager access.' });
    }
}
/**
 * DELETE /api/admin/managers/:userId - Revoke Manager access from a user
 */
async function revokeManagerAdmin(req, res) {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required.' });
        }
        await (0, managerService_1.revokeManagerAccess)(userId);
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'REVOKE_MANAGER_ACCESS',
            targetUserId: userId,
            reason: 'Admin revoked Manager access',
        });
        return res.json({
            success: true,
            message: 'Manager access revoked successfully.',
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message || 'Failed to revoke manager access.' });
    }
}
/**
 * PATCH /api/admin/managers/:userId/email - Toggle email notifications delivery preference for a manager
 */
async function updateManagerEmailAdmin(req, res) {
    try {
        const { userId } = req.params;
        const { emailNotificationsEnabled } = req.body;
        if (typeof emailNotificationsEnabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'emailNotificationsEnabled boolean is required.' });
        }
        const updated = await (0, managerService_1.updateManagerEmailPreference)({
            userId,
            emailNotificationsEnabled,
        });
        return res.json({
            success: true,
            message: `Manager email delivery ${emailNotificationsEnabled ? 'enabled' : 'disabled'}.`,
            manager: updated,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message || 'Failed to update manager preferences.' });
    }
}
/**
 * POST /api/admin/send-message - Send administrative message to a user via In-App, Email, or Both
 */
async function sendAdminMessage(req, res) {
    try {
        const { recipientUserId, title, message, channel } = req.body;
        if (!recipientUserId || !title || !message || !channel) {
            return res.status(400).json({
                success: false,
                error: 'recipientUserId, title, message, and channel are required.',
            });
        }
        const validChannels = ['IN_APP', 'EMAIL', 'BOTH'];
        if (!validChannels.includes(channel)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid delivery channel. Must be IN_APP, EMAIL, or BOTH.',
            });
        }
        const logRecord = await (0, adminMessageService_1.sendAdminMessageToUser)({
            adminUsername: req.admin.username,
            recipientUserId,
            title,
            message,
            channel,
        });
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'ADMIN_SEND_MESSAGE',
            targetUserId: recipientUserId,
            targetUser: `@${logRecord.recipientUsername}`,
            reason: `Admin message sent via ${channel}`,
            afterState: {
                channel,
                inAppStatus: logRecord.inAppStatus,
                emailStatus: logRecord.emailStatus,
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Administrative message processed.',
            delivery: logRecord,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message || 'Failed to send message.' });
    }
}
/**
 * GET /api/admin/messages - Get recent admin message logs
 */
async function getAdminMessageLogsController(req, res) {
    try {
        const logs = await (0, adminMessageService_1.getAdminMessageLogs)(50);
        return res.json({ success: true, logs });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Failed to fetch message logs.' });
    }
}
// ========================================================
// GENERIC SPECIAL GROUP SUPER ADMIN CONTROLS
// ========================================================
/**
 * Super Admin toggles special group mode (LeetCode, GFG, LinkedIn)
 */
async function adminToggleGroupSpecialMode(req, res) {
    try {
        const { groupId } = req.params;
        const { isSpecialGroup, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (typeof isSpecialGroup !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isSpecialGroup must be a boolean.' });
        }
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            include: { owner: { select: { id: true, username: true } } },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        let specialPlatform = group.specialPlatform;
        if (isSpecialGroup) {
            const detected = (0, specialGroupRegistry_1.detectSpecialPlatform)(group.name);
            if (!detected) {
                return res.status(400).json({
                    success: false,
                    error: `Group "${group.name}" does not match any recognized special platform (LeetCode, GeeksforGeeks, LinkedIn).`,
                });
            }
            specialPlatform = detected;
        }
        const beforeState = {
            isSpecialGroup: group.isSpecialGroup,
            specialPlatform: group.specialPlatform,
        };
        const updatedGroup = await prisma_1.default.group.update({
            where: { id: groupId },
            data: {
                isSpecialGroup,
                specialPlatform: isSpecialGroup ? specialPlatform : group.specialPlatform,
            },
        });
        const statusLabel = isSpecialGroup ? 'ENABLED' : 'DISABLED';
        const changesSummary = `Special group features for "${group.name}" were ${statusLabel} by administration.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'TOGGLE_GROUP_SPECIAL_MODE',
            targetUserId: group.ownerId,
            targetUser: `@${group.owner?.username || 'unknown'} (Group: ${group.name})`,
            reason,
            beforeState,
            afterState: {
                isSpecialGroup: updatedGroup.isSpecialGroup,
                specialPlatform: updatedGroup.specialPlatform,
            },
        });
        await dispatchAdminNotification({
            userId: group.ownerId,
            adminUsername: req.admin.username,
            actionTitle: `Group Special Mode ${statusLabel}`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Special mode for "${group.name}" is now ${statusLabel}.`,
            group: updatedGroup,
        });
    }
    catch (err) {
        console.error('adminToggleGroupSpecialMode error:', err);
        return res.status(500).json({ success: false, error: 'Failed to toggle special mode.' });
    }
}
/**
 * Super Admin retrieves member special group activities (Daily, POTD) and streaks
 */
async function getMemberSpecialActivitiesAdmin(req, res) {
    try {
        const { userId, groupId } = req.params;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found.' });
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true, isSpecialGroup: true, specialPlatform: true },
        });
        if (!group)
            return res.status(404).json({ success: false, error: 'Group not found.' });
        const view = await (0, specialGroupService_1.getSpecialGroupActivitiesForMember)(groupId, userId, user.timezone || 'Asia/Kolkata');
        if (!view) {
            return res.status(400).json({ success: false, error: 'Target group is not configured for special activities.' });
        }
        return res.json({
            success: true,
            user,
            group,
            specialGroup: view,
        });
    }
    catch (err) {
        console.error('getMemberSpecialActivitiesAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve member special activities.' });
    }
}
/**
 * Super Admin streak correction for an individual special activity (Daily or POTD)
 */
async function adminCorrectSpecialActivityStreak(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { activityType, currentStreak, longestStreak, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (activityType !== 'daily' && activityType !== 'potd') {
            return res.status(400).json({ success: false, error: 'activityType must be daily or potd.' });
        }
        if (typeof currentStreak !== 'number' || currentStreak < 0) {
            return res.status(400).json({ success: false, error: 'Valid non-negative current streak is required.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found.' });
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group)
            return res.status(404).json({ success: false, error: 'Group not found.' });
        const beforeView = await (0, specialGroupService_1.getSpecialGroupActivitiesForMember)(groupId, userId, user.timezone || 'Asia/Kolkata');
        const beforeAct = beforeView?.activities.find((a) => a.id === activityType);
        const updatedTask = await (0, specialGroupService_1.adminCorrectSpecialActivityStreak)(groupId, userId, activityType, currentStreak, typeof longestStreak === 'number' ? longestStreak : currentStreak);
        const changesSummary = `Special group "${group.name}" ${activityType.toUpperCase()} streak corrected: ${beforeAct?.currentStreak ?? 0}d -> ${currentStreak}d (best: ${updatedTask.longestStreak}d).`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'SPECIAL_ACTIVITY_STREAK_CORRECTION',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: beforeAct,
            afterState: updatedTask,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `${group.name} ${activityType.toUpperCase()} Streak Corrected`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Streak for ${group.name} (${activityType.toUpperCase()}) updated to ${currentStreak} days.`,
            task: updatedTask,
        });
    }
    catch (err) {
        console.error('adminCorrectSpecialActivityStreak error:', err);
        return res.status(500).json({ success: false, error: 'Failed to correct special activity streak.' });
    }
}
/**
 * Super Admin grants check-in completion for a special activity on a calendar date
 */
async function adminGrantSpecialActivityDate(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { activityType, date, studyNote, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (activityType !== 'daily' && activityType !== 'potd') {
            return res.status(400).json({ success: false, error: 'activityType must be daily or potd.' });
        }
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, error: 'A valid calendar date (YYYY-MM-DD) is required.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, timezone: true },
        });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found.' });
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group)
            return res.status(404).json({ success: false, error: 'Group not found.' });
        const updatedTask = await (0, specialGroupService_1.adminGrantSpecialActivityDate)(groupId, userId, activityType, date, studyNote);
        const changesSummary = `Special group "${group.name}" ${activityType.toUpperCase()} check-in recorded for date ${date}. New streak: ${updatedTask.streak.currentStreak}d.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'SPECIAL_ACTIVITY_GRANT_DATE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: null,
            afterState: updatedTask,
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `${group.name} ${activityType.toUpperCase()} Check-in Granted`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `Check-in for ${group.name} (${activityType.toUpperCase()}) on ${date} recorded successfully.`,
            task: updatedTask,
        });
    }
    catch (err) {
        console.error('adminGrantSpecialActivityDate error:', err);
        return res.status(500).json({ success: false, error: 'Failed to grant special activity date.' });
    }
}
/**
 * Super Admin updates member POTD commitment preference
 */
async function adminSetSpecialActivityCommitment(req, res) {
    try {
        const { userId, groupId } = req.params;
        const { isPotdCommitted, reason, sendInApp, sendEmail: shouldSendEmail, includeReason = true, includeChanges = true, } = req.body;
        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({ success: false, error: 'An administrative reason is mandatory.' });
        }
        if (typeof isPotdCommitted !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isPotdCommitted must be a boolean.' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true },
        });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found.' });
        const group = await prisma_1.default.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true },
        });
        if (!group)
            return res.status(404).json({ success: false, error: 'Group not found.' });
        const beforeMember = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
        });
        if (!beforeMember)
            return res.status(404).json({ success: false, error: 'Group membership not found.' });
        const updatedMember = await prisma_1.default.groupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: { isPotdCommitted },
        });
        const changesSummary = `POTD commitment for group "${group.name}" set to ${isPotdCommitted ? 'COMMITTED' : 'UNCOMMITTED'}.`;
        await recordAuditLog({
            adminUsername: req.admin.username,
            action: 'SPECIAL_ACTIVITY_COMMITMENT_CHANGE',
            targetUserId: userId,
            targetUser: `@${user.username}`,
            reason,
            beforeState: { isPotdCommitted: beforeMember.isPotdCommitted },
            afterState: { isPotdCommitted: updatedMember.isPotdCommitted },
        });
        await dispatchAdminNotification({
            userId,
            adminUsername: req.admin.username,
            actionTitle: `${group.name} POTD Commitment Updated`,
            reason,
            changesSummary,
            sendInApp,
            sendEmail: shouldSendEmail,
            includeReason,
            includeChanges,
        });
        return res.json({
            success: true,
            message: `POTD commitment for ${group.name} set to ${isPotdCommitted ? 'Committed' : 'Uncommitted'}.`,
            isPotdCommitted: updatedMember.isPotdCommitted,
        });
    }
    catch (err) {
        console.error('adminSetSpecialActivityCommitment error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update member POTD commitment.' });
    }
}
