import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { createNotification } from './notificationService';
import { sendEmail, isSmtpConfigured } from './emailService';
import { NotificationCategory } from '@prisma/client';
import { UserRequestRecord } from './userRequestService';

export interface ManagerRecord {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  emailNotificationsEnabled: boolean;
  grantedBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'managers.json');

let managersCache: ManagerRecord[] | null = null;
let isDbTableInitialized = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAllManagers(): ManagerRecord[] {
  if (managersCache !== null) {
    return managersCache;
  }
  try {
    ensureDataDir();
    if (!fs.existsSync(STORAGE_FILE)) {
      managersCache = [];
      return managersCache;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    managersCache = JSON.parse(raw) || [];
    return managersCache!;
  } catch (err) {
    managersCache = [];
    return managersCache;
  }
}

function saveAllManagers(records: ManagerRecord[]) {
  managersCache = records;
  try {
    ensureDataDir();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ManagerService] Error writing storage file:', err);
  }
}

export async function initManagersTable() {
  if (isDbTableInitialized) return;
  isDbTableInitialized = true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "manager_roles" (
        "id" VARCHAR(100) PRIMARY KEY,
        "user_id" VARCHAR(100) UNIQUE NOT NULL,
        "username" VARCHAR(100) NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "email" VARCHAR(200) NOT NULL,
        "email_notifications_enabled" BOOLEAN DEFAULT TRUE,
        "granted_by" VARCHAR(100) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_manager_roles_user" ON "manager_roles" ("user_id")
    `);
  } catch {
    // File store fallback
  }
}

/**
 * Check if a specific user currently has Manager access
 */
export async function isUserManager(userId: string): Promise<boolean> {
  await initManagersTable();
  const all = loadAllManagers();
  return all.some((m) => m.userId === userId);
}

/**
 * Get all current managers with user metadata
 */
export async function getAllManagers(): Promise<ManagerRecord[]> {
  await initManagersTable();

  try {
    const rawRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "user_id" as "userId", "username", "name", "email",
             "email_notifications_enabled" as "emailNotificationsEnabled",
             "granted_by" as "grantedBy",
             "created_at" as "createdAt", "updated_at" as "updatedAt"
      FROM "manager_roles"
      ORDER BY "created_at" DESC
    `);

    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const mapped: ManagerRecord[] = rawRows.map((r) => ({
        id: r.id,
        userId: r.userId || r.user_id,
        username: r.username,
        name: r.name,
        email: r.email,
        emailNotificationsEnabled: Boolean(r.emailNotificationsEnabled ?? r.email_notifications_enabled),
        grantedBy: r.grantedBy || r.granted_by || 'admin',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      }));

      saveAllManagers(mapped);
      return mapped;
    }
  } catch {
    // Fall back to memory/file
  }

  return loadAllManagers();
}

/**
 * Grant manager access to a user
 */
export async function grantManagerAccess(params: {
  userId: string;
  grantedBy: string;
  emailNotificationsEnabled?: boolean;
}): Promise<ManagerRecord> {
  const { userId, grantedBy, emailNotificationsEnabled = true } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, email: true },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  await initManagersTable();

  const all = loadAllManagers();
  const existingIndex = all.findIndex((m) => m.userId === userId);

  const now = new Date().toISOString();

  if (existingIndex !== -1) {
    // Already a manager, update preferences
    all[existingIndex].emailNotificationsEnabled = emailNotificationsEnabled;
    all[existingIndex].updatedAt = now;
    saveAllManagers(all);

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "manager_roles" SET "email_notifications_enabled" = $1, "updated_at" = NOW() WHERE "user_id" = $2`,
        emailNotificationsEnabled,
        userId
      );
    } catch {}

    return all[existingIndex];
  }

  const id = crypto.randomUUID();
  const newManager: ManagerRecord = {
    id,
    userId: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    emailNotificationsEnabled,
    grantedBy,
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(newManager);
  saveAllManagers(all);

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "manager_roles" ("id", "user_id", "username", "name", "email", "email_notifications_enabled", "granted_by", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT ("user_id") DO UPDATE
      SET "email_notifications_enabled" = EXCLUDED."email_notifications_enabled",
          "updated_at" = NOW()
      `,
      id,
      user.id,
      user.username,
      user.name,
      user.email,
      emailNotificationsEnabled,
      grantedBy
    );
  } catch {}

  // Dispatches required minimal in-app notification:
  // "The StreakUp admin has granted you Manager access."
  await createNotification({
    userId: user.id,
    category: NotificationCategory.SYSTEM,
    title: 'Manager Access Granted',
    message: 'The StreakUp admin has granted you Manager access.',
    eventKey: `MANAGER_GRANTED:${user.id}:${Date.now()}`,
    actionUrl: '/notifications',
  });

  return newManager;
}

/**
 * Revoke manager access from a user
 */
export async function revokeManagerAccess(userId: string): Promise<boolean> {
  await initManagersTable();

  const all = loadAllManagers();
  const filtered = all.filter((m) => m.userId !== userId);
  saveAllManagers(filtered);

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "manager_roles" WHERE "user_id" = $1`,
      userId
    );
  } catch {}

  return true;
}

/**
 * Toggle email notifications delivery preference for a manager
 */
export async function updateManagerEmailPreference(params: {
  userId: string;
  emailNotificationsEnabled: boolean;
}): Promise<ManagerRecord> {
  const { userId, emailNotificationsEnabled } = params;
  await initManagersTable();

  const all = loadAllManagers();
  const index = all.findIndex((m) => m.userId === userId);
  if (index === -1) {
    throw new Error('Manager record not found.');
  }

  all[index].emailNotificationsEnabled = emailNotificationsEnabled;
  all[index].updatedAt = new Date().toISOString();
  saveAllManagers(all);

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "manager_roles" SET "email_notifications_enabled" = $1, "updated_at" = NOW() WHERE "user_id" = $2`,
      emailNotificationsEnabled,
      userId
    );
  } catch {}

  return all[index];
}

/**
 * Notify all authorized managers when a new user request or feedback arrives
 */
export async function notifyManagersOfNewRequest(request: UserRequestRecord) {
  const managers = await getAllManagers();
  if (!managers || managers.length === 0) return;

  const categoryLabels: Record<string, string> = {
    FEATURE_REQUEST: 'Feature Request',
    BUG_REPORT: 'Bug Report',
    ACCOUNT_RECOVERY: 'Account Recovery Request',
    ACCOUNT_SUPPORT: 'Account Support',
    GENERAL_FEEDBACK: 'General Feedback',
    OTHER: 'Feedback / Request',
  };

  const catLabel = categoryLabels[request.category] || request.category;
  const preview = request.message.length > 120 ? `${request.message.slice(0, 120)}...` : request.message;

  for (const manager of managers) {
    // 1. In-App notification
    await createNotification({
      userId: manager.userId,
      category: NotificationCategory.SYSTEM,
      title: `New ${catLabel}`,
      message: `@${request.username}: "${preview}"`,
      eventKey: `REQ_ALERT:${request.id}:${manager.userId}`,
      actionUrl: '/notifications',
    });

    // 2. Email notification if delivery is enabled for this manager
    if (manager.emailNotificationsEnabled && isSmtpConfigured()) {
      try {
        await sendEmail({
          userId: manager.userId,
          recipientEmail: manager.email,
          category: NotificationCategory.SYSTEM,
          subject: `[StreakUp Manager] New ${catLabel} from @${request.username}`,
          text: `Hello ${manager.name},\n\nA new user request has been submitted on StreakUp:\n\nSender: @${request.username}\nCategory: ${catLabel}\nMessage:\n"${request.message}"\n\nSubmitted at: ${request.createdAt}\n\nStreakUp Manager Alerts`,
          idempotencyKey: `EMAIL_MGR:${request.id}:${manager.userId}`,
        });
      } catch (err) {
        console.error(`[ManagerService] Failed to send email to manager ${manager.username}:`, err);
      }
    }
  }
}

/**
 * Reply to a user request by an authorized manager.
 * Dispatches an IN-APP notification to the original requesting user (NO email).
 */
export async function replyToUserRequestAsManager(params: {
  managerUserId: string;
  requestId: string;
  replyMessage: string;
}): Promise<{ success: boolean; message: string }> {
  const { managerUserId, requestId, replyMessage } = params;

  if (!replyMessage || replyMessage.trim().length < 2) {
    throw new Error('Reply message cannot be empty.');
  }

  // 1. Verify caller is an active manager
  const isMgr = await isUserManager(managerUserId);
  if (!isMgr) {
    throw new Error('Forbidden: Only authorized managers can reply to user requests.');
  }

  const manager = await prisma.user.findUnique({
    where: { id: managerUserId },
    select: { id: true, username: true, name: true },
  });

  if (!manager) {
    throw new Error('Manager account not found.');
  }

  // 2. Locate the user request from storage/db
  const requestsFile = path.join(DATA_DIR, 'user_requests.json');
  let requests: UserRequestRecord[] = [];
  try {
    if (fs.existsSync(requestsFile)) {
      requests = JSON.parse(fs.readFileSync(requestsFile, 'utf-8')) || [];
    }
  } catch {}

  let targetRequest = requests.find((r) => r.id === requestId);

  // If not found in file, try DB
  if (!targetRequest) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "user_id" as "userId", "username", "name", "category", "message", "status", "admin_notes" as "adminNotes" FROM "user_requests" WHERE "id" = $1`,
        requestId
      );
      if (Array.isArray(rows) && rows.length > 0) {
        targetRequest = rows[0] as UserRequestRecord;
      }
    } catch {}
  }

  if (!targetRequest) {
    throw new Error('User request not found.');
  }

  // 3. Update the request status and record the manager note
  const noteText = `Manager @${manager.username}: ${replyMessage.trim()}`;
  targetRequest.adminNotes = targetRequest.adminNotes
    ? `${targetRequest.adminNotes}\n${noteText}`
    : noteText;
  if (targetRequest.status === 'PENDING') {
    targetRequest.status = 'UNDER_REVIEW';
  }
  targetRequest.updatedAt = new Date().toISOString();

  try {
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2), 'utf-8');
  } catch {}

  try {
    await prisma.$executeRawUnsafe(
      `
      UPDATE "user_requests"
      SET "status" = CASE WHEN "status" = 'PENDING' THEN 'UNDER_REVIEW' ELSE "status" END,
          "admin_notes" = $1,
          "updated_at" = NOW()
      WHERE "id" = $2
      `,
      targetRequest.adminNotes,
      requestId
    );
  } catch {}

  const categoryLabels: Record<string, string> = {
    FEATURE_REQUEST: 'Feature Request',
    BUG_REPORT: 'Bug Report',
    ACCOUNT_RECOVERY: 'Account Recovery Request',
    ACCOUNT_SUPPORT: 'Account Support',
    GENERAL_FEEDBACK: 'General Feedback',
    OTHER: 'Request & Feedback',
  };
  const catLabel = categoryLabels[targetRequest.category] || 'Request';

  // 4. Dispatch notification to the user
  if (targetRequest.userId && targetRequest.userId !== 'PUBLIC_GUEST') {
    try {
      await createNotification({
        userId: targetRequest.userId,
        category: NotificationCategory.SYSTEM,
        title: `Manager Reply on your ${catLabel}`,
        message: `@${manager.username}: "${replyMessage.trim()}"`,
        eventKey: `REQ_REPLY:${requestId}:${Date.now()}`,
        actionUrl: '/notifications',
      });
    } catch {}
  }

  // 5. Send email notification to the user if email is available
  if (targetRequest.email && isSmtpConfigured()) {
    try {
      await sendEmail({
        userId: targetRequest.userId !== 'PUBLIC_GUEST' ? targetRequest.userId : undefined,
        recipientEmail: targetRequest.email,
        category: NotificationCategory.SYSTEM,
        subject: `[StreakUp] Response to your ${catLabel}`,
        text: `Hello ${targetRequest.name},\n\nA StreakUp manager (@${manager.username}) has reviewed and replied to your ${catLabel}:\n\n"${replyMessage.trim()}"\n\nOriginal Request:\n"${targetRequest.message}"\n\nStreakUp Support Team`,
        idempotencyKey: `EMAIL_USER_REPLY:${requestId}:${Date.now()}`,
      });
    } catch (err) {
      console.warn(`[ManagerService] Could not send reply email to ${targetRequest.email}:`, err);
    }
  }

  return { success: true, message: 'Reply sent to user.' };
}

