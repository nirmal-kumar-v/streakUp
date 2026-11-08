import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { createNotification } from './notificationService';
import { sendEmail, isSmtpConfigured } from './emailService';
import { NotificationCategory } from '@prisma/client';
import { swrCache } from '../utils/cacheService';

export type DeliveryChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

export interface AdminMessageLog {
  id: string;
  adminUsername: string;
  recipientUserId: string;
  recipientUsername: string;
  recipientEmail: string;
  title: string;
  message: string;
  channel: DeliveryChannel;
  inAppStatus: 'SENT' | 'SKIPPED' | 'FAILED';
  emailStatus: 'SENT' | 'SKIPPED' | 'FAILED';
  deliveryNote?: string;
  createdAt: string; // ISO
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'admin_messages.json');

let messagesCache: AdminMessageLog[] | null = null;
let isDbTableInitialized = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAllAdminMessages(): AdminMessageLog[] {
  if (messagesCache !== null) {
    return messagesCache;
  }
  try {
    ensureDataDir();
    if (!fs.existsSync(STORAGE_FILE)) {
      messagesCache = [];
      return messagesCache;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    messagesCache = JSON.parse(raw) || [];
    return messagesCache!;
  } catch (err) {
    messagesCache = [];
    return messagesCache;
  }
}

function saveAllAdminMessages(records: AdminMessageLog[]) {
  messagesCache = records;
  try {
    ensureDataDir();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AdminMessageService] Error writing storage file:', err);
  }
}

export async function initAdminMessagesTable() {
  if (isDbTableInitialized) return;
  isDbTableInitialized = true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "admin_message_logs" (
        "id" VARCHAR(100) PRIMARY KEY,
        "admin_username" VARCHAR(100) NOT NULL,
        "recipient_user_id" VARCHAR(100) NOT NULL,
        "recipient_username" VARCHAR(100) NOT NULL,
        "recipient_email" VARCHAR(200) NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "message" TEXT NOT NULL,
        "channel" VARCHAR(20) NOT NULL,
        "in_app_status" VARCHAR(20) NOT NULL,
        "email_status" VARCHAR(20) NOT NULL,
        "delivery_note" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_admin_message_logs_recipient" ON "admin_message_logs" ("recipient_user_id")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_admin_message_logs_created" ON "admin_message_logs" ("created_at" DESC)
    `);
  } catch {
    // Fall back to file
  }
}

/**
 * Send an administrative message to a specific user
 */
export async function sendAdminMessageToUser(params: {
  adminUsername: string;
  recipientUserId: string;
  title: string;
  message: string;
  channel: DeliveryChannel;
}): Promise<AdminMessageLog> {
  const { adminUsername, recipientUserId, title, message, channel } = params;

  if (!title || !title.trim()) {
    throw new Error('Message title is required.');
  }

  if (!message || !message.trim()) {
    throw new Error('Message content is required.');
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { id: true, username: true, name: true, email: true },
  });

  if (!recipient) {
    throw new Error('Recipient user not found.');
  }

  await initAdminMessagesTable();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const idempotencyKey = `ADMIN_MSG:${id}:${recipient.id}`;

  let inAppStatus: 'SENT' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
  let emailStatus: 'SENT' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
  const deliveryNotes: string[] = [];

  // 1. In-App delivery
  if (channel === 'IN_APP' || channel === 'BOTH') {
    try {
      const notif = await createNotification({
        userId: recipient.id,
        category: NotificationCategory.SYSTEM,
        title: title.trim(),
        message: message.trim(),
        eventKey: idempotencyKey,
        actionUrl: '/notifications',
      });
      if (notif) {
        inAppStatus = 'SENT';
      } else {
        inAppStatus = 'FAILED';
        deliveryNotes.push('User in-app notifications disabled in preferences');
      }
    } catch (err: any) {
      inAppStatus = 'FAILED';
      deliveryNotes.push(`In-app delivery error: ${err.message}`);
    }
  }

  // 2. Email delivery
  if (channel === 'EMAIL' || channel === 'BOTH') {
    if (!isSmtpConfigured()) {
      emailStatus = 'FAILED';
      deliveryNotes.push('SMTP service is not configured on server. Email could not be dispatched.');
    } else {
      try {
        const emailResult = await sendEmail({
          userId: recipient.id,
          recipientEmail: recipient.email,
          category: NotificationCategory.SYSTEM,
          subject: `[StreakUp Admin] ${title.trim()}`,
          text: `Hello ${recipient.name},\n\nYou have received a message from the StreakUp Administrator:\n\n${title.trim()}\n----------------------------------------\n${message.trim()}\n\nBest regards,\nStreakUp Team`,
          idempotencyKey: `EMAIL:${idempotencyKey}`,
        });

        if (emailResult.success) {
          emailStatus = 'SENT';
        } else {
          emailStatus = 'FAILED';
          deliveryNotes.push(emailResult.error || 'SMTP delivery failed.');
        }
      } catch (err: any) {
        emailStatus = 'FAILED';
        deliveryNotes.push(`Email error: ${err.message}`);
      }
    }
  }

  const logRecord: AdminMessageLog = {
    id,
    adminUsername,
    recipientUserId: recipient.id,
    recipientUsername: recipient.username,
    recipientEmail: recipient.email,
    title: title.trim(),
    message: message.trim(),
    channel,
    inAppStatus,
    emailStatus,
    deliveryNote: deliveryNotes.length > 0 ? deliveryNotes.join('; ') : undefined,
    createdAt: now,
  };

  const all = loadAllAdminMessages();
  all.unshift(logRecord);
  saveAllAdminMessages(all);

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "admin_message_logs" ("id", "admin_username", "recipient_user_id", "recipient_username", "recipient_email", "title", "message", "channel", "in_app_status", "email_status", "delivery_note", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `,
      id,
      adminUsername,
      recipient.id,
      recipient.username,
      recipient.email,
      title.trim(),
      message.trim(),
      channel,
      inAppStatus,
      emailStatus,
      deliveryNotes.join('; ') || null
    );
  } catch {}

  return logRecord;
}

/**
 * Send an administrative message to multiple users or ALL registered platform users
 */
export async function sendAdminMessageToMultipleUsers(params: {
  adminUsername: string;
  recipientUserIds?: string[];
  sendToAll?: boolean;
  title: string;
  message: string;
  channel: DeliveryChannel;
}): Promise<{ count: number; delivery: AdminMessageLog; errors: string[] }> {
  const { adminUsername, recipientUserIds, sendToAll, title, message, channel } = params;

  if (!title || !title.trim()) {
    throw new Error('Message title is required.');
  }

  if (!message || !message.trim()) {
    throw new Error('Message content is required.');
  }

  let recipients: { id: string; username: string; name: string; email: string }[] = [];

  if (sendToAll) {
    recipients = await prisma.user.findMany({
      select: { id: true, username: true, name: true, email: true },
    });
  } else if (Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
    recipients = await prisma.user.findMany({
      where: { id: { in: recipientUserIds } },
      select: { id: true, username: true, name: true, email: true },
    });
  } else {
    throw new Error('No recipient users specified.');
  }

  if (recipients.length === 0) {
    throw new Error('No recipient users found.');
  }

  await initAdminMessagesTable();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const errors: string[] = [];
  let successfulDeliveries = 0;

  for (const recipient of recipients) {
    try {
      const idempotencyKey = `ADMIN_MSG:${id}:${recipient.id}`;

      // 1. In-App delivery
      if (channel === 'IN_APP' || channel === 'BOTH') {
        await createNotification({
          userId: recipient.id,
          category: NotificationCategory.SYSTEM,
          title: title.trim(),
          message: message.trim(),
          eventKey: idempotencyKey,
          actionUrl: '/notifications',
        });
      }

      // 2. Email delivery (if SMTP available)
      if ((channel === 'EMAIL' || channel === 'BOTH') && isSmtpConfigured()) {
        try {
          await sendEmail({
            userId: recipient.id,
            recipientEmail: recipient.email,
            category: NotificationCategory.SYSTEM,
            subject: `[StreakUp Admin] ${title.trim()}`,
            text: `Hello ${recipient.name},\n\nYou have received a message from the StreakUp Administrator:\n\n${title.trim()}\n----------------------------------------\n${message.trim()}\n\nBest regards,\nStreakUp Team`,
            idempotencyKey: `EMAIL:${idempotencyKey}`,
          });
        } catch {
          // ignore single user email errors
        }
      }

      swrCache.invalidateUser(recipient.id);
      successfulDeliveries++;
    } catch (err: any) {
      errors.push(`@${recipient.username}: ${err.message}`);
    }
  }

  const summaryRecipientUsername = sendToAll
    ? `ALL USERS (${successfulDeliveries})`
    : recipients.map((r) => `@${r.username}`).slice(0, 3).join(', ') + (recipients.length > 3 ? ` (+${recipients.length - 3})` : '');

  const summaryLog: AdminMessageLog = {
    id,
    adminUsername,
    recipientUserId: sendToAll ? 'ALL' : recipients.map((r) => r.id).slice(0, 5).join(','),
    recipientUsername: summaryRecipientUsername,
    recipientEmail: sendToAll ? 'streakup.web@gmail.com' : recipients[0].email,
    title: title.trim(),
    message: message.trim(),
    channel,
    inAppStatus: 'SENT',
    emailStatus: isSmtpConfigured() && (channel === 'EMAIL' || channel === 'BOTH') ? 'SENT' : 'SKIPPED',
    deliveryNote: `Broadcast to ${successfulDeliveries} user(s).${errors.length > 0 ? ` Errors: ${errors.length}` : ''}`,
    createdAt: now,
  };

  const all = loadAllAdminMessages();
  all.unshift(summaryLog);
  saveAllAdminMessages(all);

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "admin_message_logs" ("id", "admin_username", "recipient_user_id", "recipient_username", "recipient_email", "title", "message", "channel", "in_app_status", "email_status", "delivery_note", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `,
      id,
      adminUsername,
      summaryLog.recipientUserId,
      summaryLog.recipientUsername,
      summaryLog.recipientEmail,
      title.trim(),
      message.trim(),
      channel,
      summaryLog.inAppStatus,
      summaryLog.emailStatus,
      summaryLog.deliveryNote || null
    );
  } catch {}

  return { count: successfulDeliveries, delivery: summaryLog, errors };
}

/**
 * Get recent admin message logs
 */
export async function getAdminMessageLogs(limit = 50): Promise<AdminMessageLog[]> {
  await initAdminMessagesTable();

  try {
    const rawRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "admin_username" as "adminUsername", "recipient_user_id" as "recipientUserId",
             "recipient_username" as "recipientUsername", "recipient_email" as "recipientEmail",
             "title", "message", "channel", "in_app_status" as "inAppStatus",
             "email_status" as "emailStatus", "delivery_note" as "deliveryNote",
             "created_at" as "createdAt"
      FROM "admin_message_logs"
      ORDER BY "created_at" DESC
      LIMIT ${limit}
    `);

    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const mapped = rawRows.map((r) => ({
        id: r.id,
        adminUsername: r.adminUsername,
        recipientUserId: r.recipientUserId,
        recipientUsername: r.recipientUsername,
        recipientEmail: r.recipientEmail,
        title: r.title,
        message: r.message,
        channel: r.channel as DeliveryChannel,
        inAppStatus: r.inAppStatus,
        emailStatus: r.emailStatus,
        deliveryNote: r.deliveryNote || undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));

      saveAllAdminMessages(mapped);
      return mapped;
    }
  } catch {}

  const all = loadAllAdminMessages();
  return all.slice(0, limit);
}
