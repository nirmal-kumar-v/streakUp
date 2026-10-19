"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETION_GRACE_PERIOD_MS = void 0;
exports.loadAllDeletedAccounts = loadAllDeletedAccounts;
exports.saveAllDeletedAccounts = saveAllDeletedAccounts;
exports.recordAccountDeletion = recordAccountDeletion;
exports.isAccountDeleted = isAccountDeleted;
exports.recoverAccount = recoverAccount;
exports.getAllActiveDeletedAccounts = getAllActiveDeletedAccounts;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const DATA_DIR = path_1.default.join(__dirname, '../../data');
const DELETED_ACCOUNTS_FILE = path_1.default.join(DATA_DIR, 'deleted_accounts.json');
// Grace period: 10 days
exports.DELETION_GRACE_PERIOD_MS = 10 * 24 * 60 * 60 * 1000;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadAllDeletedAccounts() {
    ensureDataDir();
    try {
        if (fs_1.default.existsSync(DELETED_ACCOUNTS_FILE)) {
            const data = fs_1.default.readFileSync(DELETED_ACCOUNTS_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed.filter((r) => r && typeof r.userId === 'string' && r.userId.trim().length > 0);
            }
            return [];
        }
    }
    catch (err) {
        console.error('[deletedAccountService] Failed to read deleted_accounts.json:', err);
    }
    return [];
}
function saveAllDeletedAccounts(records) {
    ensureDataDir();
    try {
        fs_1.default.writeFileSync(DELETED_ACCOUNTS_FILE, JSON.stringify(records, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[deletedAccountService] Failed to write deleted_accounts.json:', err);
    }
}
/**
 * Ensures table exists in PostgreSQL if available
 */
let tableInitialized = false;
async function initDeletedAccountsTable() {
    if (tableInitialized)
        return;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "deleted_account_records" (
        "id" VARCHAR(64) PRIMARY KEY,
        "user_id" VARCHAR(64) NOT NULL,
        "username" VARCHAR(100) NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "deleted_at" TIMESTAMPTZ NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "deleted_by" VARCHAR(50) NOT NULL,
        "reason" TEXT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'DELETED',
        "recovered_at" TIMESTAMPTZ,
        "recovered_by" VARCHAR(100),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        try {
            await prisma_1.default.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_deleted_records_user_id" ON "deleted_account_records"("user_id")`);
            await prisma_1.default.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_deleted_records_status" ON "deleted_account_records"("status")`);
        }
        catch {
            // Index creation optional if already exists or not supported
        }
        tableInitialized = true;
    }
    catch (err) {
        console.warn('[deletedAccountService] Could not initialize PostgreSQL table, relying on JSON storage fallback:', err);
        tableInitialized = true;
    }
}
/**
 * Record a user account deletion with 10-day recovery grace period
 */
async function recordAccountDeletion(paramsOrUserId, argEmail, argUsername) {
    let userId;
    let username;
    let name;
    let email;
    let deletedBy;
    let reason;
    if (typeof paramsOrUserId === 'object' && paramsOrUserId !== null) {
        userId = paramsOrUserId.userId;
        username = paramsOrUserId.username || 'user';
        name = paramsOrUserId.name || username;
        email = paramsOrUserId.email || '';
        deletedBy = paramsOrUserId.deletedBy || 'USER';
        reason = paramsOrUserId.reason;
    }
    else {
        userId = paramsOrUserId;
        email = argEmail || '';
        username = argUsername || 'user';
        name = username;
        deletedBy = 'USER';
    }
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
        throw new Error('Valid userId is required to record account deletion');
    }
    await initDeletedAccountsTable();
    const now = new Date();
    const deletedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + exports.DELETION_GRACE_PERIOD_MS).toISOString();
    const all = loadAllDeletedAccounts();
    const existingIdx = all.findIndex((r) => r.userId === userId && r.status === 'DELETED');
    const recordId = existingIdx !== -1 ? all[existingIdx].id : crypto_1.default.randomUUID();
    const record = {
        id: recordId,
        userId,
        username,
        name,
        email,
        deletedAt,
        expiresAt,
        deletedBy,
        reason: reason || 'Deleted by user in settings',
        status: 'DELETED',
    };
    if (existingIdx !== -1) {
        all[existingIdx] = record;
    }
    else {
        all.unshift(record);
    }
    saveAllDeletedAccounts(all);
    try {
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "deleted_account_records" (
        "id", "user_id", "username", "name", "email", "deleted_at", "expires_at", "deleted_by", "reason", "status", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "status" = 'DELETED',
        "deleted_at" = EXCLUDED."deleted_at",
        "expires_at" = EXCLUDED."expires_at",
        "deleted_by" = EXCLUDED."deleted_by",
        "reason" = EXCLUDED."reason",
        "updated_at" = NOW()
      `, record.id, record.userId, record.username, record.name, record.email, new Date(deletedAt), new Date(expiresAt), record.deletedBy, record.reason, record.status);
    }
    catch { }
    return record;
}
/**
 * Checks whether a user account is deleted and whether it is within the 10-day recovery window.
 */
function isAccountDeleted(userId) {
    const all = loadAllDeletedAccounts();
    const record = all.find((r) => r.userId === userId && r.status === 'DELETED');
    if (!record) {
        return { isDeleted: false, canRecover: false };
    }
    const now = Date.now();
    const expiry = new Date(record.expiresAt).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)));
    const canRecover = now <= expiry;
    return {
        isDeleted: true,
        record,
        daysRemaining,
        canRecover,
    };
}
/**
 * Recovers a deleted account so the user can immediately log in again.
 */
async function recoverAccount(userId, adminUsername) {
    await initDeletedAccountsTable();
    const all = loadAllDeletedAccounts();
    const record = all.find((r) => r.userId === userId && r.status === 'DELETED');
    if (!record) {
        throw new Error('No active deleted account record found for this user.');
    }
    const now = new Date();
    const expiry = new Date(record.expiresAt).getTime();
    if (now.getTime() > expiry) {
        throw new Error('The 10-day recovery grace period has expired for this account.');
    }
    record.status = 'RECOVERED';
    record.recoveredAt = now.toISOString();
    record.recoveredBy = adminUsername;
    saveAllDeletedAccounts(all);
    try {
        await prisma_1.default.$executeRawUnsafe(`
      UPDATE "deleted_account_records"
      SET "status" = 'RECOVERED',
          "recovered_at" = NOW(),
          "recovered_by" = $1,
          "updated_at" = NOW()
      WHERE "user_id" = $2 AND "status" = 'DELETED'
      `, adminUsername, userId);
    }
    catch { }
    return {
        success: true,
        message: `Account for @${record.username} has been recovered. The user can now simply log in again.`,
        record,
    };
}
/**
 * Returns all deleted accounts that are within the 10-day recovery window.
 */
function getAllActiveDeletedAccounts() {
    const all = loadAllDeletedAccounts();
    const now = Date.now();
    return all.filter((r) => r.status === 'DELETED' && new Date(r.expiresAt).getTime() >= now);
}
