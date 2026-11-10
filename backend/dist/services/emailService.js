"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrimarySmtpConfig = getPrimarySmtpConfig;
exports.getSecondarySmtpConfig = getSecondarySmtpConfig;
exports.getSmtpConfig = getSmtpConfig;
exports.getRoundRobinStatus = getRoundRobinStatus;
exports.resetRoundRobinForTesting = resetRoundRobinForTesting;
exports.getAppBaseUrl = getAppBaseUrl;
exports.isSmtpConfigured = isSmtpConfigured;
exports.verifySmtpConnection = verifySmtpConnection;
exports.sendEmail = sendEmail;
exports.buildOverallReminderEmail = buildOverallReminderEmail;
exports.buildTaskReminderEmail = buildTaskReminderEmail;
exports.buildFriendOverallActivityEmail = buildFriendOverallActivityEmail;
exports.buildFriendTaskActivityEmail = buildFriendTaskActivityEmail;
exports.buildOverallMilestoneEmail = buildOverallMilestoneEmail;
exports.buildTaskMilestoneEmail = buildTaskMilestoneEmail;
exports.buildMyMilestoneEmail = buildMyMilestoneEmail;
exports.buildTaskCompletionEmail = buildTaskCompletionEmail;
exports.buildSignupOtpEmail = buildSignupOtpEmail;
exports.buildChangeEmailOtpEmail = buildChangeEmailOtpEmail;
exports.buildVerifyNotificationEmailOtpEmail = buildVerifyNotificationEmailOtpEmail;
exports.buildPasswordResetOtpEmail = buildPasswordResetOtpEmail;
exports.buildPasswordResetLinkEmail = buildPasswordResetLinkEmail;
exports.buildPasswordChangedConfirmationEmail = buildPasswordChangedConfirmationEmail;
exports.buildAccountRestoredEmail = buildAccountRestoredEmail;
exports.buildDeletedAccountNoticeEmail = buildDeletedAccountNoticeEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dns_1 = __importDefault(require("dns"));
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
// Force Node.js DNS to prioritize IPv4 over IPv6.
// Cloud environments like Render lack outbound IPv6 routing, which causes smtp.gmail.com to hang on IPv6.
try {
    dns_1.default.setDefaultResultOrder('ipv4first');
}
catch {
    // Ignore on older Node runtimes
}
/**
 * Dynamically resolves primary SMTP credentials from environment variables (Account 1).
 */
function getPrimarySmtpConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    let port = parseInt(process.env.SMTP_PORT || '465', 10);
    // Default to 465 SSL for Gmail to guarantee instant delivery without STARTTLS timeout
    if (host.includes('gmail') && (port === 587 || !process.env.SMTP_PORT)) {
        port = 465;
    }
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = (process.env.SMTP_USER || 'streakup.web@gmail.com').trim();
    const pass = (process.env.SMTP_PASS || 'ezmaeigrmnrnsomd').replace(/\s+/g, '');
    const mailFrom = (process.env.MAIL_FROM || user || 'streakup.web@gmail.com').trim();
    const mailFromName = (process.env.MAIL_FROM_NAME || 'StreakUp').trim();
    const configured = Boolean(host && user && pass);
    return { accountIndex: 0, host, port, secure, user, pass, mailFrom, mailFromName, configured };
}
/**
 * Dynamically resolves secondary SMTP credentials from environment variables (Account 2).
 * Used for the 50-email per account round-robin rotation.
 */
function getSecondarySmtpConfig() {
    const host = process.env.SMTP_HOST_2 || process.env.SMTP_HOST || 'smtp.gmail.com';
    let port = parseInt(process.env.SMTP_PORT_2 || process.env.SMTP_PORT || '465', 10);
    if (host.includes('gmail') && (port === 587 || !process.env.SMTP_PORT_2)) {
        port = 465;
    }
    const secure = process.env.SMTP_SECURE_2
        ? process.env.SMTP_SECURE_2 === 'true'
        : (port === 465 || process.env.SMTP_SECURE === 'true');
    const user = (process.env.SMTP_USER_2 || '').trim();
    const pass = (process.env.SMTP_PASS_2 || '').replace(/\s+/g, '');
    const mailFrom = (process.env.MAIL_FROM_2 || user || '').trim();
    const mailFromName = (process.env.MAIL_FROM_NAME_2 || process.env.MAIL_FROM_NAME || 'StreakUp').trim();
    const configured = Boolean(host && user && pass);
    return { accountIndex: 1, host, port, secure, user, pass, mailFrom: mailFrom || user, mailFromName, configured };
}
/**
 * Returns SMTP config. Defaults to Account 1 for backward compatibility.
 */
function getSmtpConfig(accountIndex = 0) {
    return accountIndex === 1 ? getSecondarySmtpConfig() : getPrimarySmtpConfig();
}
const roundRobinState = {
    currentDateKey: new Date().toISOString().slice(0, 10),
    activeAccountIndex: 0,
    consecutiveCount: 0,
    totalSentToday: [0, 0],
};
function checkAndResetDailyRoundRobin() {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (roundRobinState.currentDateKey !== todayKey) {
        roundRobinState.currentDateKey = todayKey;
        roundRobinState.activeAccountIndex = 0;
        roundRobinState.consecutiveCount = 0;
        roundRobinState.totalSentToday = [0, 0];
    }
}
/**
 * Inspect round-robin dispatcher status
 */
function getRoundRobinStatus() {
    checkAndResetDailyRoundRobin();
    const primary = getPrimarySmtpConfig();
    const secondary = getSecondarySmtpConfig();
    return {
        currentDate: roundRobinState.currentDateKey,
        activeAccountIndex: roundRobinState.activeAccountIndex,
        consecutiveCount: roundRobinState.consecutiveCount,
        batchLimit: 50,
        totalSentToday: [...roundRobinState.totalSentToday],
        primaryConfigured: primary.configured,
        primaryUser: primary.user,
        secondaryConfigured: secondary.configured,
        secondaryUser: secondary.configured ? secondary.user : null,
    };
}
/**
 * Test helper to reset round robin state
 */
function resetRoundRobinForTesting(activeAccountIndex = 0, consecutiveCount = 0) {
    roundRobinState.currentDateKey = new Date().toISOString().slice(0, 10);
    roundRobinState.activeAccountIndex = activeAccountIndex;
    roundRobinState.consecutiveCount = consecutiveCount;
    roundRobinState.totalSentToday = [0, 0];
}
/**
 * Returns the canonical hosted frontend URL for all email links.
 * Always resolves to the production URL in deployed environments.
 */
function getAppBaseUrl() {
    const configured = process.env.APP_BASE_URL || process.env.CLIENT_URL;
    if (configured &&
        !configured.includes('localhost') &&
        !configured.includes('onrender.com') &&
        !configured.includes('render')) {
        return configured.replace(/\/+$/, '');
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
    }
    return 'https://streakup-karo.vercel.app';
}
/**
 * Checks if SMTP transport has been configured with host and authentication
 */
function isSmtpConfigured() {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_SMTP) {
        return false;
    }
    const primary = getPrimarySmtpConfig();
    const secondary = getSecondarySmtpConfig();
    return primary.configured || secondary.configured;
}
/**
 * Creates a Nodemailer transport with family: 4 (IPv4) and cloud-resilient timeouts.
 */
function createTransporter(configOverride, portOverride, secureOverride) {
    const config = configOverride ?? getSmtpConfig();
    const port = portOverride ?? config.port;
    const secure = secureOverride ?? (port === 465 || config.secure);
    return nodemailer_1.default.createTransport({
        host: config.host,
        port,
        secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2',
        },
        family: 4, // CRITICAL FOR RENDER: Force IPv4 connection to prevent IPv6 silent timeout on cloud containers
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000,
    });
}
/**
 * Diagnostic test to verify SMTP connectivity without exposing passwords or secrets
 */
async function verifySmtpConnection() {
    if (!isSmtpConfigured()) {
        return {
            success: false,
            message: 'SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend environment variables.',
        };
    }
    const primary = getPrimarySmtpConfig();
    const secondary = getSecondarySmtpConfig();
    if (primary.configured) {
        try {
            const transporter = createTransporter(primary);
            await transporter.verify();
            return {
                success: true,
                message: secondary.configured
                    ? `Primary SMTP (${primary.user}) verified. Secondary SMTP (${secondary.user}) active for 50-email round-robin.`
                    : `SMTP transport connection successfully verified (${primary.user}).`,
                host: primary.host,
                port: primary.port,
            };
        }
        catch (err) {
            if (primary.port !== 465) {
                try {
                    const fallbackTransporter = createTransporter(primary, 465, true);
                    await fallbackTransporter.verify();
                    return {
                        success: true,
                        message: 'SMTP connection verified via fallback port 465 (SSL).',
                        host: primary.host,
                        port: 465,
                    };
                }
                catch { }
            }
            if (secondary.configured) {
                try {
                    const secTransporter = createTransporter(secondary);
                    await secTransporter.verify();
                    return {
                        success: true,
                        message: `Primary failed, but secondary SMTP (${secondary.user}) verified successfully.`,
                        host: secondary.host,
                        port: secondary.port,
                    };
                }
                catch { }
            }
            return {
                success: false,
                message: `SMTP connection verification failed: ${err.message || 'Connection timeout or authentication error'}`,
                host: primary.host,
                port: primary.port,
            };
        }
    }
    if (secondary.configured) {
        try {
            const secTransporter = createTransporter(secondary);
            await secTransporter.verify();
            return {
                success: true,
                message: `Secondary SMTP connection verified (${secondary.user}).`,
                host: secondary.host,
                port: secondary.port,
            };
        }
        catch (err) {
            return {
                success: false,
                message: `Secondary SMTP verification failed: ${err.message}`,
                host: secondary.host,
                port: secondary.port,
            };
        }
    }
    return {
        success: false,
        message: 'No SMTP credentials configured.',
    };
}
/**
 * Sends a natural plain-text email with full idempotency, audit logging in EmailDelivery,
 * resilient cloud IPv4 routing, automatic port 465 SSL fallback, 50-email round-robin dispatch,
 * and graceful failover error handling.
 */
async function sendEmail(options) {
    const { userId, recipientEmail, category, subject, text, idempotencyKey } = options;
    // 1. Idempotency Check
    const existingDelivery = await prisma_1.default.emailDelivery.findUnique({
        where: { idempotencyKey },
    });
    if (existingDelivery && existingDelivery.status === client_1.EmailDeliveryStatus.SENT) {
        return { success: true, deliveryId: existingDelivery.id };
    }
    // Record delivery attempt in DB if userId is available and valid in DB
    let deliveryRecord = null;
    if (userId && userId !== 'PUBLIC_GUEST') {
        try {
            const userExists = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (userExists) {
                deliveryRecord = existingDelivery
                    ? await prisma_1.default.emailDelivery.update({
                        where: { id: existingDelivery.id },
                        data: {
                            attemptCount: { increment: 1 },
                            lastAttemptAt: new Date(),
                            status: client_1.EmailDeliveryStatus.PENDING,
                        },
                    })
                    : await prisma_1.default.emailDelivery.create({
                        data: {
                            userId,
                            recipientEmail,
                            category,
                            subject,
                            idempotencyKey,
                            status: client_1.EmailDeliveryStatus.PENDING,
                            attemptCount: 1,
                            lastAttemptAt: new Date(),
                        },
                    });
            }
        }
        catch {
            // If user table operation encounters any edge case, continue sending email
        }
    }
    // 2. If SMTP is not configured, record skipped status without throwing
    if (!isSmtpConfigured()) {
        if (deliveryRecord) {
            await prisma_1.default.emailDelivery.update({
                where: { id: deliveryRecord.id },
                data: {
                    status: client_1.EmailDeliveryStatus.FAILED,
                    error: 'SMTP credentials not configured on backend. Email dispatch skipped.',
                },
            });
        }
        return {
            success: false,
            deliveryId: deliveryRecord?.id,
            error: 'SMTP not configured',
        };
    }
    // 3. Resolve Round-Robin Dispatch Account (every 50 emails per day)
    checkAndResetDailyRoundRobin();
    const primary = getPrimarySmtpConfig();
    const secondary = getSecondarySmtpConfig();
    let targetAccount;
    let alternateAccount = null;
    if (secondary.configured && primary.configured) {
        if (roundRobinState.activeAccountIndex === 1) {
            targetAccount = secondary;
            alternateAccount = primary;
        }
        else {
            targetAccount = primary;
            alternateAccount = secondary;
        }
    }
    else if (secondary.configured) {
        targetAccount = secondary;
    }
    else {
        targetAccount = primary;
    }
    // Helper to attempt dispatch with port 465 fallback
    const dispatchMail = async (config) => {
        try {
            const transporter = createTransporter(config);
            await transporter.sendMail({
                from: `"${config.mailFromName}" <${config.mailFrom}>`,
                to: recipientEmail,
                subject,
                text, // Natural, accessible plain-text body with zero color or styling conflict
            });
            return { success: true };
        }
        catch (err) {
            const initialError = err.message || 'SMTP delivery failed';
            if (config.port !== 465) {
                try {
                    const fallbackTransporter = createTransporter(config, 465, true);
                    await fallbackTransporter.sendMail({
                        from: `"${config.mailFromName}" <${config.mailFrom}>`,
                        to: recipientEmail,
                        subject,
                        text,
                    });
                    return { success: true };
                }
                catch (fallbackErr) {
                    return { success: false, error: fallbackErr.message || initialError };
                }
            }
            return { success: false, error: initialError };
        }
    };
    // 4. Dispatch using selected round-robin account
    let sendResult = await dispatchMail(targetAccount);
    // If initial attempt failed, and an alternate configured account exists, attempt failover
    if (!sendResult.success && alternateAccount) {
        console.warn(`[EmailService] Account ${targetAccount.accountIndex + 1} (${targetAccount.user}) failed (${sendResult.error}). Testing failover to Account ${alternateAccount.accountIndex + 1} (${alternateAccount.user})...`);
        const failoverResult = await dispatchMail(alternateAccount);
        if (failoverResult.success) {
            sendResult = failoverResult;
            // Switch active account so subsequent emails use the healthy account
            roundRobinState.activeAccountIndex = alternateAccount.accountIndex;
            roundRobinState.consecutiveCount = 1;
            roundRobinState.totalSentToday[alternateAccount.accountIndex]++;
        }
    }
    else if (sendResult.success && secondary.configured && primary.configured) {
        // Increment batch counter on successful dispatch
        roundRobinState.consecutiveCount++;
        roundRobinState.totalSentToday[targetAccount.accountIndex]++;
        if (roundRobinState.consecutiveCount >= 50) {
            const previousIndex = roundRobinState.activeAccountIndex;
            roundRobinState.activeAccountIndex = previousIndex === 0 ? 1 : 0;
            roundRobinState.consecutiveCount = 0;
            console.log(`[EmailService] 50-email round-robin threshold reached on Account ${previousIndex + 1}. Rotated next batch to Account ${roundRobinState.activeAccountIndex + 1}.`);
        }
    }
    // 5. Update delivery record & return result
    if (sendResult.success) {
        if (deliveryRecord) {
            await prisma_1.default.emailDelivery.update({
                where: { id: deliveryRecord.id },
                data: {
                    status: client_1.EmailDeliveryStatus.SENT,
                    error: null,
                },
            });
        }
        return { success: true, deliveryId: deliveryRecord?.id };
    }
    else {
        console.error(`[EmailService] Failed to send email to ${recipientEmail}:`, sendResult.error);
        if (deliveryRecord) {
            await prisma_1.default.emailDelivery.update({
                where: { id: deliveryRecord.id },
                data: {
                    status: client_1.EmailDeliveryStatus.FAILED,
                    error: (sendResult.error || 'SMTP delivery failed').slice(0, 500),
                },
            });
        }
        return {
            success: false,
            deliveryId: deliveryRecord?.id,
            error: sendResult.error,
        };
    }
}
// ----------------------------------------------------
// Natural Plain-Text Email Message Builders
// ----------------------------------------------------
/**
 * Overall streak reminder email
 */
function buildOverallReminderEmail(data) {
    const appUrl = `${getAppBaseUrl()}/dashboard`;
    const subject = 'Your StreakUp streak is waiting';
    const text = [
        `Hi ${data.name},`,
        '',
        `You haven't completed a task today yet. Complete at least one task before your local calendar day ends to maintain your overall streak.`,
        '',
        `Current overall streak: ${data.currentStreak} day${data.currentStreak === 1 ? '' : 's'}`,
        data.timeRemaining ? `Time remaining today: ${data.timeRemaining}` : '',
        '',
        `Open StreakUp: ${appUrl}`,
        '',
        `—`,
        `StreakUp Reminder`,
        `Manage notification preferences: ${getAppBaseUrl()}/settings/notifications`,
    ]
        .filter(Boolean)
        .join('\n');
    return { subject, text };
}
/**
 * Task-specific reminder email
 */
function buildTaskReminderEmail(data) {
    const taskUrl = `${getAppBaseUrl()}/tasks`;
    const subject = `Reminder: ${data.taskTitle}`;
    const text = [
        `Hi ${data.name},`,
        '',
        `You haven't completed your "${data.taskTitle}" task today.`,
        '',
        `You can still finish this task before your day ends to keep your task streak alive.`,
        '',
        `Current task streak: ${data.currentStreak} day${data.currentStreak === 1 ? '' : 's'}`,
        data.timeRemaining ? `Time remaining today: ${data.timeRemaining}` : '',
        '',
        `Open task: ${taskUrl}`,
        '',
        `—`,
        `StreakUp Reminder`,
        `Manage notification preferences: ${getAppBaseUrl()}/settings/notifications`,
    ]
        .filter(Boolean)
        .join('\n');
    return { subject, text };
}
/**
 * Friend completed overall activity alert
 */
function buildFriendOverallActivityEmail(data) {
    const dashboardUrl = `${getAppBaseUrl()}/dashboard`;
    const subject = `${data.friendName} completed today's activity`;
    const text = [
        `Hi ${data.recipientName},`,
        '',
        `Your friend ${data.friendName} has completed today's activity.`,
        '',
        `You haven't completed any task today yet. Complete a task before your day ends to keep your overall streak going.`,
        '',
        `Open your dashboard: ${dashboardUrl}`,
        '',
        `—`,
        `StreakUp Social Alerts`,
    ].join('\n');
    return { subject, text };
}
/**
 * Friend completed matching task alert with optional study note
 */
function buildFriendTaskActivityEmail(data) {
    const taskUrl = `${getAppBaseUrl()}/tasks`;
    const subject = `${data.friendName} completed today's ${data.taskTitle}`;
    const lines = [
        `Hi ${data.recipientName},`,
        '',
        `Your friend ${data.friendName} completed their ${data.taskTitle} task today.`,
    ];
    if (data.studyNote && data.studyNote.trim()) {
        lines.push('', `Study note: ${data.studyNote.trim()}`);
    }
    lines.push('', `You haven't completed your matching task today yet. You still have time to make progress.`, '', `Open your task: ${taskUrl}`, '', `—`, `StreakUp Social Alerts`);
    return { subject, text: lines.join('\n') };
}
/**
 * Friend reached overall streak milestone
 */
function buildOverallMilestoneEmail(data) {
    const leaderboardUrl = `${getAppBaseUrl()}/leaderboard/global`;
    const subject = `${data.friendName} reached a ${data.milestone}-day overall streak`;
    const text = [
        `Hi,`,
        '',
        `Your friend ${data.friendName} has reached an impressive ${data.milestone}-day overall streak on StreakUp!`,
        '',
        `View their standing on the global leaderboard:`,
        `${leaderboardUrl}`,
        '',
        `—`,
        `StreakUp Milestone Celebrations`,
    ].join('\n');
    return { subject, text };
}
/**
 * Friend reached task streak milestone
 */
function buildTaskMilestoneEmail(data) {
    const friendsTasksUrl = `${getAppBaseUrl()}/friends/tasks`;
    const subject = `${data.friendName} reached a ${data.milestone}-day streak on ${data.taskTitle}`;
    const text = [
        `Hi,`,
        '',
        `Your friend ${data.friendName} reached a ${data.milestone}-day streak on their "${data.taskTitle}" habit!`,
        '',
        `See your mutual habit progress on Friends' Tasks:`,
        `${friendsTasksUrl}`,
        '',
        `—`,
        `StreakUp Milestone Celebrations`,
    ].join('\n');
    return { subject, text };
}
/**
 * User's own milestone celebration email
 */
function buildMyMilestoneEmail(data) {
    const dashboardUrl = `${getAppBaseUrl()}/dashboard`;
    const subject = `Congratulations on your ${data.milestone}-day streak!`;
    const text = [
        `Hi ${data.name},`,
        '',
        `Congratulations! You have reached a ${data.milestone}-day ${data.scopeDescription} streak on StreakUp.`,
        '',
        `Your daily consistency is paying off. Keep the momentum going tomorrow!`,
        '',
        `View your streak dashboard: ${dashboardUrl}`,
        '',
        `—`,
        `StreakUp`,
    ].join('\n');
    return { subject, text };
}
/**
 * Daily habit completion celebration email dispatched directly to the completing user
 */
function buildTaskCompletionEmail(data) {
    const dashboardUrl = `${getAppBaseUrl()}/dashboard`;
    const subject = `🔥 Habit Completed: ${data.taskTitle} (${data.currentStreak} Day Streak!)`;
    const lines = [
        `Hi ${data.userName},`,
        '',
        `Great work! You have successfully completed your habit "${data.taskTitle}" today!`,
        '',
        `Current Streak: ${data.currentStreak} day${data.currentStreak === 1 ? '' : 's'} 🔥`,
    ];
    if (data.pointsAwarded && data.pointsAwarded > 0) {
        lines.push(`Points Earned: +${data.pointsAwarded} pts (Total: ${data.totalPoints ?? data.pointsAwarded} pts)`);
    }
    if (data.studyNote && data.studyNote.trim()) {
        lines.push('', `Your Study Note:`, `"${data.studyNote.trim()}"`);
    }
    lines.push('', `View your streak progress on your dashboard:`, dashboardUrl, '', `Keep up the fantastic momentum tomorrow!`, '', `—`, `StreakUp Team`);
    return { subject, text: lines.join('\n') };
}
/**
 * Plain-text signup verification email with 6-digit OTP
 */
function buildSignupOtpEmail(data) {
    const subject = `Your StreakUp verification code: ${data.otp}`;
    const text = [
        `Hi ${data.name},`,
        '',
        `Welcome to StreakUp!`,
        '',
        `Please use the following 6-digit code to verify your email address and activate your account:`,
        '',
        `    ${data.otp}`,
        '',
        `This verification code will expire in 5 minutes.`,
        '',
        `For security reasons, never share this code with anyone.`,
        `If you did not create a StreakUp account, you can safely ignore this email.`,
        '',
        `—`,
        `StreakUp Team`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text registered email change OTP email
 */
function buildChangeEmailOtpEmail(data) {
    const subject = `Your StreakUp email change code: ${data.otp}`;
    const text = [
        `Hi ${data.name},`,
        '',
        `We received a request to update the login email address for your StreakUp account${data.newEmail ? ` to ${data.newEmail}` : ' to this address'}.`,
        '',
        `Your 6-digit verification code is:`,
        '',
        `    ${data.otp}`,
        '',
        `This code will expire in 5 minutes.`,
        '',
        `Please do not share this code with anyone. If you did not initiate this request, please review your account settings immediately.`,
        '',
        `—`,
        `StreakUp Security`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text notification destination email verification OTP
 */
function buildVerifyNotificationEmailOtpEmail(data) {
    const subject = `Verify your StreakUp notification email: ${data.otp}`;
    const text = [
        `Hi ${data.name},`,
        '',
        `You requested to use this email address${data.notificationEmail ? ` (${data.notificationEmail})` : ''} for receiving StreakUp streak reminders and friend activity updates.`,
        '',
        `Your verification code is:`,
        '',
        `    ${data.otp}`,
        '',
        `This code will expire in 5 minutes.`,
        '',
        `Once verified, your daily habit reminders will be delivered to this inbox.`,
        '',
        `—`,
        `StreakUp Reminders`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text password reset OTP email
 */
function buildPasswordResetOtpEmail(data) {
    const subject = `Your StreakUp password reset code: ${data.otp}`;
    const text = [
        `Hi ${data.name},`,
        '',
        `We received a request to reset the password for your StreakUp account.`,
        '',
        `Your 6-digit password reset code is:`,
        '',
        `    ${data.otp}`,
        '',
        `This verification code will expire in 5 minutes.`,
        '',
        `For security reasons, never share this code with anyone.`,
        `If you did not request a password reset, you can safely ignore this email and your account remains secure.`,
        '',
        `—`,
        `StreakUp Security`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text password reset link email (backward compatibility)
 */
function buildPasswordResetLinkEmail(data) {
    const url = data.resetUrl || `${getAppBaseUrl()}/reset-password?token=${data.resetToken || ''}`;
    const subject = 'Reset your StreakUp password';
    const text = [
        `Hi ${data.name},`,
        '',
        `We received a request to reset the password for your StreakUp account.`,
        '',
        `Click the link below to set a new password:`,
        `${url}`,
        '',
        `This password reset link is valid for 1 hour.`,
        '',
        `If you did not request a password reset, no further action is needed and your account remains secure.`,
        '',
        `—`,
        `StreakUp Security`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text password changed confirmation email
 */
function buildPasswordChangedConfirmationEmail(data) {
    const loginUrl = `${getAppBaseUrl()}/login`;
    const subject = 'Your StreakUp password was successfully changed';
    const text = [
        `Hi ${data.name},`,
        '',
        `This is a confirmation that the password for your StreakUp account was recently changed.`,
        '',
        `You can now log in using your new password at:`,
        `${loginUrl}`,
        '',
        `If you did not make this change, please contact support immediately to secure your account.`,
        '',
        `—`,
        `StreakUp Security`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text account restored confirmation email
 */
function buildAccountRestoredEmail(data) {
    const loginUrl = `${getAppBaseUrl()}/login`;
    const subject = `Your StreakUp account (@${data.username}) has been restored`;
    const text = [
        `Hi ${data.name},`,
        '',
        `Good news! Your StreakUp account (@${data.username}) has been successfully restored by our administrative team.`,
        '',
        `All your daily habit streaks, study notes, points, and group memberships are fully preserved and active again.`,
        '',
        `You can log in now at:`,
        `${loginUrl}`,
        '',
        `Keep your streak blazing!`,
        '',
        `—`,
        `StreakUp Admin & Support Team`,
    ].join('\n');
    return { subject, text };
}
/**
 * Plain-text notice email for deleted accounts attempting password reset
 */
function buildDeletedAccountNoticeEmail(data) {
    const loginUrl = `${getAppBaseUrl()}/login`;
    const subject = 'Notice regarding your StreakUp account';
    const daysText = data.daysRemaining !== undefined
        ? `${data.daysRemaining} days remaining in your 10-day recovery window.`
        : 'You can request account recovery within 10 days of deletion.';
    const text = [
        `Hi ${data.name},`,
        '',
        `We received a request regarding your StreakUp account. However, this account is currently deleted (${daysText}).`,
        '',
        `If you would like to restore your account and resume your streaks, please submit an account recovery request from our portal:`,
        `${loginUrl}`,
        '',
        `If you did not make this request or intend to keep your account deleted, no further action is needed.`,
        '',
        `—`,
        `StreakUp Support`,
    ].join('\n');
    return { subject, text };
}
