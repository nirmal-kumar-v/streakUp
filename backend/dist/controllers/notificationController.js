"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
exports.dismissNotification = dismissNotification;
exports.getPreferences = getPreferences;
exports.updatePreferences = updatePreferences;
exports.getReminderSchedules = getReminderSchedules;
exports.createReminderSchedule = createReminderSchedule;
exports.deleteReminderSchedule = deleteReminderSchedule;
exports.sendTestEmail = sendTestEmail;
exports.getSmtpStatus = getSmtpStatus;
exports.requestNotificationEmailOtp = requestNotificationEmailOtp;
exports.verifyNotificationEmailOtp = verifyNotificationEmailOtp;
exports.removeNotificationEmail = removeNotificationEmail;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const notificationService_1 = require("../services/notificationService");
const emailService_1 = require("../services/emailService");
const reminderSchedulerService_1 = require("../services/reminderSchedulerService");
const otpService_1 = require("../services/otpService");
/**
 * GET /api/notifications
 * Lists notifications with pagination, read/unread filters, and unread badge count
 */
async function getNotifications(req, res) {
    try {
        const userId = req.user.userId;
        const { category, status = 'all', page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = {
            userId,
            isDismissed: false,
        };
        if (category && Object.values(client_1.NotificationCategory).includes(category)) {
            where.category = category;
        }
        if (status === 'unread') {
            where.isRead = false;
        }
        else if (status === 'read') {
            where.isRead = true;
        }
        const [notifications, totalCount, unreadCount] = await Promise.all([
            prisma_1.default.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: {
                    friend: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profileImage: true,
                        },
                    },
                    task: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            }),
            prisma_1.default.notification.count({ where }),
            prisma_1.default.notification.count({
                where: {
                    userId,
                    isDismissed: false,
                    isRead: false,
                },
            }),
        ]);
        return res.json({
            success: true,
            notifications,
            unreadCount,
            totalCount,
            page: pageNum,
            totalPages: Math.ceil(totalCount / limitNum) || 1,
        });
    }
    catch (err) {
        console.error('getNotifications error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
    }
}
/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read
 */
async function markNotificationAsRead(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const notif = await prisma_1.default.notification.findUnique({ where: { id } });
        if (!notif) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        if (notif.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        const updated = await prisma_1.default.notification.update({
            where: { id },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
        return res.json({ success: true, notification: updated });
    }
    catch (err) {
        console.error('markNotificationAsRead error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update notification.' });
    }
}
/**
 * POST /api/notifications/mark-all-read
 * Mark all active notifications as read for current user
 */
async function markAllNotificationsAsRead(req, res) {
    try {
        const userId = req.user.userId;
        await prisma_1.default.notification.updateMany({
            where: {
                userId,
                isDismissed: false,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
        return res.json({
            success: true,
            message: 'All notifications marked as read.',
        });
    }
    catch (err) {
        console.error('markAllNotificationsAsRead error:', err);
        return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read.' });
    }
}
/**
 * DELETE /api/notifications/:id
 * Dismiss / delete an individual notification
 */
async function dismissNotification(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const notif = await prisma_1.default.notification.findUnique({ where: { id } });
        if (!notif) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        if (notif.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        await prisma_1.default.notification.update({
            where: { id },
            data: {
                isDismissed: true,
                dismissedAt: new Date(),
            },
        });
        return res.json({
            success: true,
            message: 'Notification dismissed.',
        });
    }
    catch (err) {
        console.error('dismissNotification error:', err);
        return res.status(500).json({ success: false, error: 'Failed to dismiss notification.' });
    }
}
/**
 * GET /api/notifications/preferences
 * Retrieve current user notification preferences
 */
async function getPreferences(req, res) {
    try {
        const userId = req.user.userId;
        const preferences = await (0, notificationService_1.getOrCreateNotificationPreferences)(userId);
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { email: true, timezone: true },
        });
        return res.json({
            success: true,
            preferences,
            defaultEmail: user?.email,
            timezone: user?.timezone,
            isSmtpConfigured: (0, emailService_1.isSmtpConfigured)(),
        });
    }
    catch (err) {
        console.error('getPreferences error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve notification preferences.' });
    }
}
const updatePreferencesSchema = zod_1.z.object({
    emailNotificationsEnabled: zod_1.z.boolean().optional(),
    inAppNotificationsEnabled: zod_1.z.boolean().optional(),
    overallStreakRemindersEmail: zod_1.z.boolean().optional(),
    taskRemindersEmail: zod_1.z.boolean().optional(),
    friendOverallActivityAlerts: zod_1.z.boolean().optional(),
    friendTaskActivityAlerts: zod_1.z.boolean().optional(),
    friendOverallMilestones: zod_1.z.boolean().optional(),
    friendTaskMilestones: zod_1.z.boolean().optional(),
    myMilestonesEmail: zod_1.z.boolean().optional(),
    freezeStatusNotifications: zod_1.z.boolean().optional(),
    customNotificationEmail: zod_1.z.string().email('Invalid email address format').optional().nullable(),
});
/**
 * PUT /api/notifications/preferences
 * Update notification preferences and custom destination email
 */
async function updatePreferences(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = updatePreferencesSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid preferences input',
            });
        }
        const data = parseResult.data;
        const existingPref = await prisma_1.default.notificationPreference.findUnique({ where: { userId } });
        let customEmailUpdate = {};
        if (data.customNotificationEmail !== undefined) {
            if (!data.customNotificationEmail || !data.customNotificationEmail.trim()) {
                customEmailUpdate = {
                    customNotificationEmail: null,
                    isCustomEmailVerified: false,
                };
            }
            else {
                const cleanEmail = data.customNotificationEmail.trim().toLowerCase();
                // If unchanged and already verified, keep verified; otherwise requires OTP verification
                const isAlreadyVerified = existingPref?.customNotificationEmail === cleanEmail && existingPref?.isCustomEmailVerified;
                customEmailUpdate = {
                    customNotificationEmail: cleanEmail,
                    isCustomEmailVerified: Boolean(isAlreadyVerified),
                };
            }
        }
        const updated = await prisma_1.default.notificationPreference.update({
            where: { userId },
            data: {
                ...(data.emailNotificationsEnabled !== undefined ? { emailNotificationsEnabled: data.emailNotificationsEnabled } : {}),
                ...(data.inAppNotificationsEnabled !== undefined ? { inAppNotificationsEnabled: data.inAppNotificationsEnabled } : {}),
                ...(data.overallStreakRemindersEmail !== undefined ? { overallStreakRemindersEmail: data.overallStreakRemindersEmail } : {}),
                ...(data.taskRemindersEmail !== undefined ? { taskRemindersEmail: data.taskRemindersEmail } : {}),
                ...(data.friendOverallActivityAlerts !== undefined ? { friendOverallActivityAlerts: data.friendOverallActivityAlerts } : {}),
                ...(data.friendTaskActivityAlerts !== undefined ? { friendTaskActivityAlerts: data.friendTaskActivityAlerts } : {}),
                ...(data.friendOverallMilestones !== undefined ? { friendOverallMilestones: data.friendOverallMilestones } : {}),
                ...(data.friendTaskMilestones !== undefined ? { friendTaskMilestones: data.friendTaskMilestones } : {}),
                ...(data.myMilestonesEmail !== undefined ? { myMilestonesEmail: data.myMilestonesEmail } : {}),
                ...(data.freezeStatusNotifications !== undefined ? { freezeStatusNotifications: data.freezeStatusNotifications } : {}),
                ...customEmailUpdate,
            },
        });
        return res.json({
            success: true,
            message: 'Notification preferences saved successfully.',
            preferences: updated,
        });
    }
    catch (err) {
        console.error('updatePreferences error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update preferences.' });
    }
}
/**
 * GET /api/notifications/reminders
 * Retrieve all reminder schedules (overall and per-task) for current user
 */
async function getReminderSchedules(req, res) {
    try {
        const userId = req.user.userId;
        const schedules = await prisma_1.default.reminderSchedule.findMany({
            where: { userId },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
            orderBy: [{ scope: 'asc' }, { time: 'asc' }],
        });
        return res.json({
            success: true,
            schedules,
        });
    }
    catch (err) {
        console.error('getReminderSchedules error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve reminder schedules.' });
    }
}
const addReminderSchema = zod_1.z.object({
    scope: zod_1.z.enum(['OVERALL', 'TASK']),
    taskId: zod_1.z.string().optional().nullable(),
    time: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in 24hr HH:mm format (e.g. 08:30)'),
});
/**
 * POST /api/notifications/reminders
 * Create a reminder schedule (strictly max 3 per scope)
 */
async function createReminderSchedule(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = addReminderSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid reminder input',
            });
        }
        const { scope, taskId, time } = parseResult.data;
        // If task scope, verify task ownership
        if (scope === 'TASK') {
            if (!taskId) {
                return res.status(400).json({ success: false, error: 'taskId is required for task-specific reminders.' });
            }
            const task = await prisma_1.default.task.findUnique({ where: { id: taskId } });
            if (!task || task.userId !== userId) {
                return res.status(404).json({ success: false, error: 'Task not found or unauthorized.' });
            }
        }
        // Enforce MAX 3 reminder times per scope rule
        const reminderScope = scope;
        const countCheck = await (0, reminderSchedulerService_1.validateReminderCount)({
            userId,
            scope: reminderScope,
            taskId: taskId || null,
        });
        if (!countCheck.valid) {
            return res.status(400).json({
                success: false,
                error: `Maximum 3 reminder times allowed for ${scope === 'OVERALL' ? 'the overall streak' : 'this specific task'}.`,
            });
        }
        // Format time cleanly to HH:mm
        const [h, m] = time.split(':');
        const formattedTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        const existingSchedule = await prisma_1.default.reminderSchedule.findFirst({
            where: {
                userId,
                scope: reminderScope,
                taskId: taskId || null,
                time: formattedTime,
            },
        });
        if (existingSchedule) {
            return res.status(400).json({
                success: false,
                error: `A reminder for ${formattedTime} is already scheduled in this scope.`,
            });
        }
        const schedule = await prisma_1.default.reminderSchedule.create({
            data: {
                userId,
                scope: reminderScope,
                taskId: taskId || null,
                time: formattedTime,
                isEnabled: true,
            },
            include: {
                task: {
                    select: { id: true, title: true },
                },
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Reminder schedule created successfully.',
            schedule,
        });
    }
    catch (err) {
        console.error('createReminderSchedule error:', err);
        return res.status(500).json({ success: false, error: 'Failed to create reminder schedule.' });
    }
}
/**
 * DELETE /api/notifications/reminders/:id
 * Delete a reminder schedule
 */
async function deleteReminderSchedule(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const schedule = await prisma_1.default.reminderSchedule.findUnique({ where: { id } });
        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Reminder schedule not found.' });
        }
        if (schedule.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        await prisma_1.default.reminderSchedule.delete({ where: { id } });
        return res.json({
            success: true,
            message: 'Reminder schedule removed.',
        });
    }
    catch (err) {
        console.error('deleteReminderSchedule error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete reminder schedule.' });
    }
}
/**
 * POST /api/notifications/test-email
 * Sends a real test email to the user's notification email address
 */
async function sendTestEmail(req, res) {
    try {
        const userId = req.user.userId;
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const pref = await (0, notificationService_1.getOrCreateNotificationPreferences)(userId);
        const destinationEmail = pref.customNotificationEmail && pref.isCustomEmailVerified
            ? pref.customNotificationEmail
            : user.email;
        if (!(0, emailService_1.isSmtpConfigured)()) {
            return res.status(400).json({
                success: false,
                error: 'SMTP is not configured on the server yet. Please add SMTP credentials in backend/.env to send real emails.',
            });
        }
        const testSubject = 'StreakUp Test Notification Email';
        const testHtml = `
      <div style="background-color:#16171a; color:#e4e4e7; padding:24px; border-radius:12px; font-family:sans-serif;">
        <h2 style="color:#ff5722; margin-top:0;">🔥 StreakUp Email Delivery Verified</h2>
        <p>Hi ${user.name},</p>
        <p>This is a test notification confirming that email delivery is working correctly for your StreakUp account.</p>
        <p style="color:#a1a1aa; font-size:12px;">Sent to: ${destinationEmail}</p>
      </div>
    `;
        const testText = `StreakUp Test Notification Email\n\nHi ${user.name},\nThis test confirms that email delivery is working correctly.`;
        const result = await (0, emailService_1.sendEmail)({
            userId,
            recipientEmail: destinationEmail,
            category: client_1.NotificationCategory.SYSTEM,
            subject: testSubject,
            html: testHtml,
            text: testText,
            idempotencyKey: `TEST_EMAIL:${userId}:${Date.now()}`,
        });
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: `Failed to deliver test email: ${result.error}`,
            });
        }
        return res.json({
            success: true,
            message: `Test email successfully sent to ${destinationEmail}!`,
        });
    }
    catch (err) {
        console.error('sendTestEmail error:', err);
        return res.status(500).json({ success: false, error: 'Failed to send test email.' });
    }
}
/**
 * GET /api/notifications/smtp-status
 * Check SMTP status without revealing secrets
 */
async function getSmtpStatus(req, res) {
    try {
        const status = await (0, emailService_1.verifySmtpConnection)();
        return res.json({
            isConfigured: (0, emailService_1.isSmtpConfigured)(),
            ...status,
        });
    }
    catch (err) {
        return res.json({
            success: false,
            isConfigured: (0, emailService_1.isSmtpConfigured)(),
            message: err.message || 'Error checking SMTP configuration.',
        });
    }
}
const requestNotificationEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
});
/**
 * Request OTP to verify a custom notification email:
 * Does not change login email or apply the 14-day restriction.
 */
async function requestNotificationEmailOtp(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = requestNotificationEmailSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid email address',
            });
        }
        const cleanEmail = parseResult.data.email.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const otpResult = await (0, otpService_1.createEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.VERIFY_NOTIFICATION_EMAIL,
            userId: user.id,
            targetData: cleanEmail,
        });
        if (!otpResult.success) {
            return res.status(429).json({
                success: false,
                error: otpResult.error,
                retryAfterSeconds: otpResult.retryAfterSeconds,
            });
        }
        const emailData = (0, emailService_1.buildVerifyNotificationEmailOtpEmail)({
            name: user.name,
            notificationEmail: cleanEmail,
            otp: otpResult.otp,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: cleanEmail,
            category: client_1.NotificationCategory.SYSTEM,
            subject: emailData.subject,
            text: emailData.text,
            idempotencyKey: `NOTIF_EMAIL_OTP:${user.id}:${Date.now()}`,
        });
        return res.json({
            success: true,
            message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter the code to enable delivery to this address.`,
            email: cleanEmail,
        });
    }
    catch (err) {
        console.error('requestNotificationEmailOtp error:', err);
        return res.status(500).json({ success: false, error: 'Failed to request notification email verification.' });
    }
}
const verifyNotificationEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
    otp: zod_1.z.string().min(6).max(6, '6-digit OTP code required'),
});
/**
 * Verify OTP to activate custom notification email
 */
async function verifyNotificationEmailOtp(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = verifyNotificationEmailSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid verification data',
            });
        }
        const { email, otp } = parseResult.data;
        const cleanEmail = email.trim().toLowerCase();
        const verification = await (0, otpService_1.verifyEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.VERIFY_NOTIFICATION_EMAIL,
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
        // Ensure preferences exist
        await (0, notificationService_1.getOrCreateNotificationPreferences)(userId);
        const updated = await prisma_1.default.notificationPreference.update({
            where: { userId },
            data: {
                customNotificationEmail: cleanEmail,
                isCustomEmailVerified: true,
            },
        });
        return res.json({
            success: true,
            message: 'Notification email verified and activated. Eligible notifications will now be routed to this address.',
            preferences: updated,
        });
    }
    catch (err) {
        console.error('verifyNotificationEmailOtp error:', err);
        return res.status(500).json({ success: false, error: 'Failed to verify notification email.' });
    }
}
/**
 * Remove custom notification email and revert to registered login email
 */
async function removeNotificationEmail(req, res) {
    try {
        const userId = req.user.userId;
        await (0, notificationService_1.getOrCreateNotificationPreferences)(userId);
        const updated = await prisma_1.default.notificationPreference.update({
            where: { userId },
            data: {
                customNotificationEmail: null,
                isCustomEmailVerified: false,
            },
        });
        return res.json({
            success: true,
            message: 'Custom notification email removed. Notifications will be delivered to your registered email address.',
            preferences: updated,
        });
    }
    catch (err) {
        console.error('removeNotificationEmail error:', err);
        return res.status(500).json({ success: false, error: 'Failed to remove custom notification email.' });
    }
}
