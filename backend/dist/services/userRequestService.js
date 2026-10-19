"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUserRequestsTable = initUserRequestsTable;
exports.submitUserRequest = submitUserRequest;
exports.getAllUserRequests = getAllUserRequests;
exports.updateUserRequestStatus = updateUserRequestStatus;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const managerService_1 = require("./managerService");
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const STORAGE_FILE = path_1.default.join(DATA_DIR, 'user_requests.json');
let requestsCache = null;
let isDbTableInitialized = false;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadAllRequests() {
    if (requestsCache !== null) {
        return requestsCache;
    }
    try {
        ensureDataDir();
        if (!fs_1.default.existsSync(STORAGE_FILE)) {
            requestsCache = [];
            return requestsCache;
        }
        const raw = fs_1.default.readFileSync(STORAGE_FILE, 'utf-8');
        requestsCache = JSON.parse(raw) || [];
        return requestsCache;
    }
    catch (err) {
        requestsCache = [];
        return requestsCache;
    }
}
function saveAllRequests(records) {
    requestsCache = records;
    try {
        ensureDataDir();
        fs_1.default.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[UserRequestService] Error writing storage file:', err);
    }
}
async function initUserRequestsTable() {
    if (isDbTableInitialized)
        return;
    isDbTableInitialized = true;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_requests" (
        "id" VARCHAR(100) PRIMARY KEY,
        "user_id" VARCHAR(100) NOT NULL,
        "username" VARCHAR(100) NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "email" VARCHAR(200) NOT NULL,
        "category" VARCHAR(50) NOT NULL,
        "message" TEXT NOT NULL,
        "status" VARCHAR(50) DEFAULT 'PENDING',
        "admin_notes" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_user_requests_status" ON "user_requests" ("status")
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_user_requests_user" ON "user_requests" ("user_id")
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_user_requests_created" ON "user_requests" ("created_at" DESC)
    `);
    }
    catch {
        // Graceful fallback to file cache if raw migration cannot run
    }
}
/**
 * Submit a new request or feedback from an authenticated user
 */
async function submitUserRequest(params) {
    const { userId, category, message } = params;
    if (!message || message.trim().length < 5) {
        throw new Error('Message must be at least 5 characters long.');
    }
    if (message.trim().length > 3000) {
        throw new Error('Message cannot exceed 3000 characters.');
    }
    const validCategories = [
        'FEATURE_REQUEST',
        'BUG_REPORT',
        'ACCOUNT_SUPPORT',
        'GENERAL_FEEDBACK',
        'OTHER',
    ];
    if (!validCategories.includes(category)) {
        throw new Error('Invalid request category selected.');
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, name: true, email: true },
    });
    if (!user) {
        throw new Error('Authenticated user not found.');
    }
    await initUserRequestsTable();
    const id = crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const newRecord = {
        id,
        userId: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        category,
        message: message.trim(),
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
    };
    // 1. Sync to local memory & file
    const all = loadAllRequests();
    all.unshift(newRecord);
    saveAllRequests(all);
    // 2. Persist to PostgreSQL if available
    try {
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "user_requests" ("id", "user_id", "username", "name", "email", "category", "message", "status", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, id, user.id, user.username, user.name, user.email, category, message.trim(), 'PENDING');
    }
    catch (err) {
        // File store already saved
    }
    // 3. Notify all active managers asynchronously
    setImmediate(async () => {
        try {
            await (0, managerService_1.notifyManagersOfNewRequest)(newRecord);
        }
        catch (err) {
            console.error('[UserRequestService] Error notifying managers:', err);
        }
    });
    return newRecord;
}
/**
 * Get all user requests for Admin with optional status and category filtering
 */
async function getAllUserRequests(filters) {
    await initUserRequestsTable();
    try {
        const rawRows = await prisma_1.default.$queryRawUnsafe(`
      SELECT "id", "user_id" as "userId", "username", "name", "email", "category", "message", "status", "admin_notes" as "adminNotes", "created_at" as "createdAt", "updated_at" as "updatedAt"
      FROM "user_requests"
      ORDER BY "created_at" DESC
    `);
        if (Array.isArray(rawRows) && rawRows.length > 0) {
            let mapped = rawRows.map((r) => ({
                id: r.userId ? r.id : r.ID || r.id,
                userId: r.userId || r.user_id,
                username: r.username,
                name: r.name,
                email: r.email,
                category: r.category,
                message: r.message,
                status: r.status,
                adminNotes: r.adminNotes || r.admin_notes || null,
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
            }));
            // Cache sync
            saveAllRequests(mapped);
            return applyFilters(mapped, filters);
        }
    }
    catch {
        // Fall back to memory/file
    }
    const all = loadAllRequests();
    return applyFilters(all, filters);
}
function applyFilters(records, filters) {
    let result = [...records];
    if (filters?.status && filters.status !== 'ALL') {
        result = result.filter((r) => r.status === filters.status);
    }
    if (filters?.category && filters.category !== 'ALL') {
        result = result.filter((r) => r.category === filters.category);
    }
    if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        result = result.filter((r) => r.username.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.message.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q));
    }
    return result;
}
/**
 * Update request status (e.g. PENDING -> UNDER_REVIEW -> RESOLVED)
 */
async function updateUserRequestStatus(params) {
    const { requestId, status, adminNotes } = params;
    if (!['PENDING', 'UNDER_REVIEW', 'RESOLVED'].includes(status)) {
        throw new Error('Invalid request status. Must be PENDING, UNDER_REVIEW, or RESOLVED.');
    }
    await initUserRequestsTable();
    const all = loadAllRequests();
    const index = all.findIndex((r) => r.id === requestId);
    if (index === -1) {
        throw new Error('Request record not found.');
    }
    all[index].status = status;
    if (adminNotes !== undefined) {
        all[index].adminNotes = adminNotes;
    }
    all[index].updatedAt = new Date().toISOString();
    saveAllRequests(all);
    try {
        await prisma_1.default.$executeRawUnsafe(`
      UPDATE "user_requests"
      SET "status" = $1, "admin_notes" = COALESCE($2, "admin_notes"), "updated_at" = NOW()
      WHERE "id" = $3
      `, status, adminNotes || null, requestId);
    }
    catch {
        // File store updated
    }
    return all[index];
}
