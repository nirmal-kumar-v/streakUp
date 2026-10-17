"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.buildSignupOtpEmail = buildSignupOtpEmail;
exports.buildChangeEmailOtpEmail = buildChangeEmailOtpEmail;
exports.buildVerifyNotificationEmailOtpEmail = buildVerifyNotificationEmailOtpEmail;
exports.buildPasswordResetLinkEmail = buildPasswordResetLinkEmail;
exports.buildPasswordChangedConfirmationEmail = buildPasswordChangedConfirmationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
// SMTP credentials strictly loaded from environment variables
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@streakup.app';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'StreakUp';
/**
 * Returns the canonical hosted frontend URL for all email links.
 * Always resolves to the production URL in deployed environments.
 */
function getAppBaseUrl() {
    const configured = process.env.APP_BASE_URL || process.env.CLIENT_URL;
    if (configured && !configured.includes('localhost')) {
        return configured.replace(/\/+$/, '');
    }
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        return 'https://streakup-karo.onrender.com';
    }
    return (configured || 'https://streakup-karo.onrender.com').replace(/\/+$/, '');
}
/**
 * Checks if SMTP transport has been configured with host and authentication
 */
function isSmtpConfigured() {
    return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}
/**
 * Diagnostic test to verify SMTP connectivity without exposing passwords or secrets
 */
async function verifySmtpConnection() {
    if (!isSmtpConfigured()) {
        return {
            success: false,
            message: 'SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env',
        };
    }
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return {
            success: true,
            message: 'SMTP transport connection successfully verified.',
            host: SMTP_HOST,
            port: SMTP_PORT,
        };
    }
    catch (err) {
        return {
            success: false,
            message: `SMTP connection verification failed: ${err.message || 'Connection timeout or authentication error'}`,
            host: SMTP_HOST,
            port: SMTP_PORT,
        };
    }
}
function createTransporter() {
    return nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
}
/**
 * Sends a natural plain-text email with full idempotency, audit logging in EmailDelivery,
 * and graceful fallback (never crashes caller on SMTP errors).
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
    // Record delivery attempt in DB if userId is available
    let deliveryRecord = null;
    if (userId) {
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
    // 3. Dispatch through Nodemailer using pure plain-text message
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${MAIL_FROM_NAME}" <${MAIL_FROM}>`,
            to: recipientEmail,
            subject,
            text, // Natural, accessible plain-text body with zero color or styling conflict
        });
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
    catch (err) {
        const sanitizedError = err.message || 'SMTP delivery failed';
        console.error(`[EmailService] Failed to send email to ${recipientEmail}:`, sanitizedError);
        if (deliveryRecord) {
            await prisma_1.default.emailDelivery.update({
                where: { id: deliveryRecord.id },
                data: {
                    status: client_1.EmailDeliveryStatus.FAILED,
                    error: sanitizedError.slice(0, 500),
                },
            });
        }
        return {
            success: false,
            deliveryId: deliveryRecord?.id,
            error: sanitizedError,
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
 * Plain-text password reset link email (Section 8 per user requirement)
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
