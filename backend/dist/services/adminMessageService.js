"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAdminMessagesTable = initAdminMessagesTable;
exports.sendAdminMessageToUser = sendAdminMessageToUser;
exports.sendAdminMessageToMultipleUsers = sendAdminMessageToMultipleUsers;
exports.getAdminMessageLogs = getAdminMessageLogs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const notificationService_1 = require("./notificationService");
const emailService_1 = require("./emailService");
const client_1 = require("@prisma/client");
const cacheService_1 = require("../utils/cacheService");
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const STORAGE_FILE = path_1.default.join(DATA_DIR, 'admin_messages.json');
let messagesCache = null;
let isDbTableInitialized = false;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadAllAdminMessages() {
    if (messagesCache !== null) {
        return messagesCache;
    }
    try {
        ensureDataDir();
        if (!fs_1.default.existsSync(STORAGE_FILE)) {
            messagesCache = [];
            return messagesCache;
        }
        const raw = fs_1.default.readFileSync(STORAGE_FILE, 'utf-8');
        messagesCache = JSON.parse(raw) || [];
        return messagesCache;
    }
    catch (err) {
        messagesCache = [];
        return messagesCache;
    }
}
function saveAllAdminMessages(records) {
    messagesCache = records;
    try {
        ensureDataDir();
        fs_1.default.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[AdminMessageService] Error writing storage file:', err);
    }
}
async function initAdminMessagesTable() {
    if (isDbTableInitialized)
        return;
    isDbTableInitialized = true;
    try {
        await prisma_1.default.$executeRawUnsafe(`
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
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_admin_message_logs_recipient" ON "admin_message_logs" ("recipient_user_id")
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_admin_message_logs_created" ON "admin_message_logs" ("created_at" DESC)
    `);
    }
    catch {
        // Fall back to file
    }
}
/**
 * Send an administrative message to a specific user
 */
async function sendAdminMessageToUser(params) {
    const { adminUsername, recipientUserId, title, message, channel } = params;
    if (!title || !title.trim()) {
        throw new Error('Message title is required.');
    }
    if (!message || !message.trim()) {
        throw new Error('Message content is required.');
    }
    const recipient = await prisma_1.default.user.findUnique({
        where: { id: recipientUserId },
        select: { id: true, username: true, name: true, email: true },
    });
    if (!recipient) {
        throw new Error('Recipient user not found.');
    }
    await initAdminMessagesTable();
    const id = crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const idempotencyKey = `ADMIN_MSG:${id}:${recipient.id}`;
    let inAppStatus = 'SKIPPED';
    let emailStatus = 'SKIPPED';
    const deliveryNotes = [];
    // 1. In-App delivery
    if (channel === 'IN_APP' || channel === 'BOTH') {
        try {
            const notif = await (0, notificationService_1.createNotification)({
                userId: recipient.id,
                category: client_1.NotificationCategory.SYSTEM,
                title: title.trim(),
                message: message.trim(),
                eventKey: idempotencyKey,
                actionUrl: '/notifications',
            });
            if (notif) {
                inAppStatus = 'SENT';
            }
            else {
                inAppStatus = 'FAILED';
                deliveryNotes.push('User in-app notifications disabled in preferences');
            }
        }
        catch (err) {
            inAppStatus = 'FAILED';
            deliveryNotes.push(`In-app delivery error: ${err.message}`);
        }
    }
    // 2. Email delivery
    if (channel === 'EMAIL' || channel === 'BOTH') {
        if (!(0, emailService_1.isSmtpConfigured)()) {
            emailStatus = 'FAILED';
            deliveryNotes.push('SMTP service is not configured on server. Email could not be dispatched.');
        }
        else {
            try {
                const emailResult = await (0, emailService_1.sendEmail)({
                    userId: recipient.id,
                    recipientEmail: recipient.email,
                    category: client_1.NotificationCategory.SYSTEM,
                    subject: `[StreakUp Admin] ${title.trim()}`,
                    text: `Hello ${recipient.name},\n\nYou have received a message from the StreakUp Administrator:\n\n${title.trim()}\n----------------------------------------\n${message.trim()}\n\nBest regards,\nStreakUp Team`,
                    idempotencyKey: `EMAIL:${idempotencyKey}`,
                });
                if (emailResult.success) {
                    emailStatus = 'SENT';
                }
                else {
                    emailStatus = 'FAILED';
                    deliveryNotes.push(emailResult.error || 'SMTP delivery failed.');
                }
            }
            catch (err) {
                emailStatus = 'FAILED';
                deliveryNotes.push(`Email error: ${err.message}`);
            }
        }
    }
    const logRecord = {
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
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "admin_message_logs" ("id", "admin_username", "recipient_user_id", "recipient_username", "recipient_email", "title", "message", "channel", "in_app_status", "email_status", "delivery_note", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, id, adminUsername, recipient.id, recipient.username, recipient.email, title.trim(), message.trim(), channel, inAppStatus, emailStatus, deliveryNotes.join('; ') || null);
    }
    catch { }
    return logRecord;
}
/**
 * Send an administrative message to multiple users or ALL registered platform users
 */
async function sendAdminMessageToMultipleUsers(params) {
    const { adminUsername, recipientUserIds, sendToAll, title, message, channel } = params;
    if (!title || !title.trim()) {
        throw new Error('Message title is required.');
    }
    if (!message || !message.trim()) {
        throw new Error('Message content is required.');
    }
    let recipients = [];
    if (sendToAll) {
        recipients = await prisma_1.default.user.findMany({
            select: { id: true, username: true, name: true, email: true },
        });
    }
    else if (Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
        recipients = await prisma_1.default.user.findMany({
            where: { id: { in: recipientUserIds } },
            select: { id: true, username: true, name: true, email: true },
        });
    }
    else {
        throw new Error('No recipient users specified.');
    }
    if (recipients.length === 0) {
        throw new Error('No recipient users found.');
    }
    await initAdminMessagesTable();
    const id = crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const errors = [];
    let successfulDeliveries = 0;
    for (const recipient of recipients) {
        try {
            const idempotencyKey = `ADMIN_MSG:${id}:${recipient.id}`;
            // 1. In-App delivery
            if (channel === 'IN_APP' || channel === 'BOTH') {
                await (0, notificationService_1.createNotification)({
                    userId: recipient.id,
                    category: client_1.NotificationCategory.SYSTEM,
                    title: title.trim(),
                    message: message.trim(),
                    eventKey: idempotencyKey,
                    actionUrl: '/notifications',
                });
            }
            // 2. Email delivery (if SMTP available)
            if ((channel === 'EMAIL' || channel === 'BOTH') && (0, emailService_1.isSmtpConfigured)()) {
                try {
                    await (0, emailService_1.sendEmail)({
                        userId: recipient.id,
                        recipientEmail: recipient.email,
                        category: client_1.NotificationCategory.SYSTEM,
                        subject: `[StreakUp Admin] ${title.trim()}`,
                        text: `Hello ${recipient.name},\n\nYou have received a message from the StreakUp Administrator:\n\n${title.trim()}\n----------------------------------------\n${message.trim()}\n\nBest regards,\nStreakUp Team`,
                        idempotencyKey: `EMAIL:${idempotencyKey}`,
                    });
                }
                catch {
                    // ignore single user email errors
                }
            }
            cacheService_1.swrCache.invalidateUser(recipient.id);
            successfulDeliveries++;
        }
        catch (err) {
            errors.push(`@${recipient.username}: ${err.message}`);
        }
    }
    const summaryRecipientUsername = sendToAll
        ? `ALL USERS (${successfulDeliveries})`
        : recipients.map((r) => `@${r.username}`).slice(0, 3).join(', ') + (recipients.length > 3 ? ` (+${recipients.length - 3})` : '');
    const summaryLog = {
        id,
        adminUsername,
        recipientUserId: sendToAll ? 'ALL' : recipients.map((r) => r.id).slice(0, 5).join(','),
        recipientUsername: summaryRecipientUsername,
        recipientEmail: sendToAll ? 'streakup.web@gmail.com' : recipients[0].email,
        title: title.trim(),
        message: message.trim(),
        channel,
        inAppStatus: 'SENT',
        emailStatus: (0, emailService_1.isSmtpConfigured)() && (channel === 'EMAIL' || channel === 'BOTH') ? 'SENT' : 'SKIPPED',
        deliveryNote: `Broadcast to ${successfulDeliveries} user(s).${errors.length > 0 ? ` Errors: ${errors.length}` : ''}`,
        createdAt: now,
    };
    const all = loadAllAdminMessages();
    all.unshift(summaryLog);
    saveAllAdminMessages(all);
    try {
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "admin_message_logs" ("id", "admin_username", "recipient_user_id", "recipient_username", "recipient_email", "title", "message", "channel", "in_app_status", "email_status", "delivery_note", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, id, adminUsername, summaryLog.recipientUserId, summaryLog.recipientUsername, summaryLog.recipientEmail, title.trim(), message.trim(), channel, summaryLog.inAppStatus, summaryLog.emailStatus, summaryLog.deliveryNote || null);
    }
    catch { }
    return { count: successfulDeliveries, delivery: summaryLog, errors };
}
/**
 * Get recent admin message logs
 */
async function getAdminMessageLogs(limit = 50) {
    await initAdminMessagesTable();
    try {
        const rawRows = await prisma_1.default.$queryRawUnsafe(`
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
                channel: r.channel,
                inAppStatus: r.inAppStatus,
                emailStatus: r.emailStatus,
                deliveryNote: r.deliveryNote || undefined,
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            }));
            saveAllAdminMessages(mapped);
            return mapped;
        }
    }
    catch { }
    const all = loadAllAdminMessages();
    return all.slice(0, limit);
}
