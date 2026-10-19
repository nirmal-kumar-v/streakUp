import nodemailer from 'nodemailer';
import dns from 'dns';
import prisma from '../config/prisma';
import { NotificationCategory, EmailDeliveryStatus } from '@prisma/client';

// Force Node.js DNS to prioritize IPv4 over IPv6.
// Cloud environments like Render lack outbound IPv6 routing, which causes smtp.gmail.com to hang on IPv6.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore on older Node runtimes
}

export interface SendEmailOptions {
  userId?: string | null;
  recipientEmail: string;
  category: NotificationCategory;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
}

/**
 * Dynamically resolves SMTP credentials from environment variables.
 * Avoids stale configuration if environment variables are loaded asynchronously.
 */
export function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  let port = parseInt(process.env.SMTP_PORT || '465', 10);
  // Default to 465 SSL for Gmail to guarantee instant delivery without STARTTLS timeout
  if (host.includes('gmail') && (port === 587 || !process.env.SMTP_PORT)) {
    port = 465;
  }
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || 'streakup.web@gmail.com';
  const pass = (process.env.SMTP_PASS || 'ezmaeigrmnrnsomd').replace(/\s+/g, '');
  const mailFrom = process.env.MAIL_FROM || user || 'streakup.web@gmail.com';
  const mailFromName = process.env.MAIL_FROM_NAME || 'StreakUp';

  return { host, port, secure, user, pass, mailFrom, mailFromName };
}

/**
 * Returns the canonical hosted frontend URL for all email links.
 * Always resolves to the production URL in deployed environments.
 */
export function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL || process.env.CLIENT_URL;
  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return (configured || 'https://streak-up-karo.vercel.app').replace(/\/+$/, '');
}

/**
 * Checks if SMTP transport has been configured with host and authentication
 */
export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
}

/**
 * Creates a Nodemailer transport with family: 4 (IPv4) and cloud-resilient timeouts.
 */
function createTransporter(portOverride?: number, secureOverride?: boolean) {
  const config = getSmtpConfig();
  const port = portOverride ?? config.port;
  const secure = secureOverride ?? (port === 465 || config.secure);

  return nodemailer.createTransport({
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
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as any);
}

/**
 * Diagnostic test to verify SMTP connectivity without exposing passwords or secrets
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  message: string;
  host?: string;
  port?: number;
}> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend environment variables.',
    };
  }

  const config = getSmtpConfig();

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      success: true,
      message: 'SMTP transport connection successfully verified.',
      host: config.host,
      port: config.port,
    };
  } catch (err: any) {
    // If primary port failed and wasn't 465, test fallback port 465
    if (config.port !== 465) {
      try {
        const fallbackTransporter = createTransporter(465, true);
        await fallbackTransporter.verify();
        return {
          success: true,
          message: 'SMTP connection verified via fallback port 465 (SSL).',
          host: config.host,
          port: 465,
        };
      } catch (fallbackErr: any) {
        // Fallback also failed
      }
    }

    return {
      success: false,
      message: `SMTP connection verification failed: ${err.message || 'Connection timeout or authentication error'}`,
      host: config.host,
      port: config.port,
    };
  }
}

/**
 * Sends a natural plain-text email with full idempotency, audit logging in EmailDelivery,
 * resilient cloud IPv4 routing, automatic port 465 SSL fallback, and graceful error handling.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  deliveryId?: string;
  error?: string;
}> {
  const { userId, recipientEmail, category, subject, text, idempotencyKey } = options;
  const config = getSmtpConfig();

  // 1. Idempotency Check
  const existingDelivery = await prisma.emailDelivery.findUnique({
    where: { idempotencyKey },
  });

  if (existingDelivery && existingDelivery.status === EmailDeliveryStatus.SENT) {
    return { success: true, deliveryId: existingDelivery.id };
  }

  // Record delivery attempt in DB if userId is available
  let deliveryRecord: { id: string } | null = null;
  if (userId) {
    deliveryRecord = existingDelivery
      ? await prisma.emailDelivery.update({
          where: { id: existingDelivery.id },
          data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            status: EmailDeliveryStatus.PENDING,
          },
        })
      : await prisma.emailDelivery.create({
          data: {
            userId,
            recipientEmail,
            category,
            subject,
            idempotencyKey,
            status: EmailDeliveryStatus.PENDING,
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });
  }

  // 2. If SMTP is not configured, record skipped status without throwing
  if (!isSmtpConfigured()) {
    if (deliveryRecord) {
      await prisma.emailDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          status: EmailDeliveryStatus.FAILED,
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
      from: `"${config.mailFromName}" <${config.mailFrom}>`,
      to: recipientEmail,
      subject,
      text, // Natural, accessible plain-text body with zero color or styling conflict
    });

    if (deliveryRecord) {
      await prisma.emailDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          status: EmailDeliveryStatus.SENT,
          error: null,
        },
      });
    }

    return { success: true, deliveryId: deliveryRecord?.id };
  } catch (err: any) {
    const initialError = err.message || 'SMTP delivery failed';
    console.warn(`[EmailService] Attempt on port ${config.port} failed (${initialError}). Testing cloud-resilient fallback to port 465 (SSL + IPv4)...`);

    // 4. Cloud Fallback: If port 587 timed out or failed on Render, retry immediately via port 465 SSL
    if (config.port !== 465) {
      try {
        const fallbackTransporter = createTransporter(465, true);
        await fallbackTransporter.sendMail({
          from: `"${config.mailFromName}" <${config.mailFrom}>`,
          to: recipientEmail,
          subject,
          text,
        });

        console.log(`[EmailService] Fallback to port 465 succeeded for ${recipientEmail}!`);

        if (deliveryRecord) {
          await prisma.emailDelivery.update({
            where: { id: deliveryRecord.id },
            data: {
              status: EmailDeliveryStatus.SENT,
              error: null,
            },
          });
        }

        return { success: true, deliveryId: deliveryRecord?.id };
      } catch (fallbackErr: any) {
        console.error(`[EmailService] Fallback to port 465 also failed:`, fallbackErr.message);
      }
    }

    console.error(`[EmailService] Failed to send email to ${recipientEmail}:`, initialError);

    if (deliveryRecord) {
      await prisma.emailDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          status: EmailDeliveryStatus.FAILED,
          error: initialError.slice(0, 500),
        },
      });
    }

    return {
      success: false,
      deliveryId: deliveryRecord?.id,
      error: initialError,
    };
  }
}

// ----------------------------------------------------
// Natural Plain-Text Email Message Builders
// ----------------------------------------------------

/**
 * Overall streak reminder email
 */
export function buildOverallReminderEmail(data: {
  name: string;
  currentStreak: number;
  timeRemaining?: string;
}) {
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
export function buildTaskReminderEmail(data: {
  name: string;
  taskTitle: string;
  currentStreak: number;
  timeRemaining?: string;
}) {
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
export function buildFriendOverallActivityEmail(data: {
  recipientName: string;
  friendName: string;
}) {
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
export function buildFriendTaskActivityEmail(data: {
  recipientName: string;
  friendName: string;
  taskTitle: string;
  studyNote?: string | null;
}) {
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

  lines.push(
    '',
    `You haven't completed your matching task today yet. You still have time to make progress.`,
    '',
    `Open your task: ${taskUrl}`,
    '',
    `—`,
    `StreakUp Social Alerts`
  );

  return { subject, text: lines.join('\n') };
}

/**
 * Friend reached overall streak milestone
 */
export function buildOverallMilestoneEmail(data: {
  friendName: string;
  milestone: number;
}) {
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
export function buildTaskMilestoneEmail(data: {
  friendName: string;
  taskTitle: string;
  milestone: number;
}) {
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
export function buildMyMilestoneEmail(data: {
  name: string;
  scopeDescription: string;
  milestone: number;
}) {
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
export function buildSignupOtpEmail(data: {
  name: string;
  otp: string;
}) {
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
export function buildChangeEmailOtpEmail(data: {
  name: string;
  otp: string;
  newEmail?: string;
}) {
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
export function buildVerifyNotificationEmailOtpEmail(data: {
  name: string;
  otp: string;
  notificationEmail?: string;
}) {
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
export function buildPasswordResetOtpEmail(data: {
  name: string;
  otp: string;
}) {
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
export function buildPasswordResetLinkEmail(data: {
  name: string;
  resetToken?: string;
  resetUrl?: string;
}) {
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
export function buildPasswordChangedConfirmationEmail(data: {
  name: string;
}) {
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
