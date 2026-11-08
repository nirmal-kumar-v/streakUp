"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAnnouncementTable = initAnnouncementTable;
exports.getAllPlatformAnnouncements = getAllPlatformAnnouncements;
exports.getActivePlatformAnnouncements = getActivePlatformAnnouncements;
exports.getPlatformAnnouncement = getPlatformAnnouncement;
exports.createPlatformAnnouncement = createPlatformAnnouncement;
exports.updatePlatformAnnouncement = updatePlatformAnnouncement;
exports.deletePlatformAnnouncement = deletePlatformAnnouncement;
exports.togglePlatformAnnouncement = togglePlatformAnnouncement;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../config/prisma"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const ANNOUNCEMENT_FILE = path_1.default.join(DATA_DIR, 'announcement.json');
const DEFAULT_ANNOUNCEMENT = {
    id: 'default-announcement',
    active: true,
    message: 'Welcome to StreakUp! Zero-buffering performance, seamless native widgets, and multi-user broadcast messaging are now live.',
    type: 'success',
    link: '/tasks',
    linkText: 'Explore Tasks',
    dismissible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};
let cachedAnnouncements = null;
let isTableInitialized = false;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function getFileAnnouncement() {
    ensureDataDir();
    try {
        if (fs_1.default.existsSync(ANNOUNCEMENT_FILE)) {
            const raw = fs_1.default.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
            return { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
        }
    }
    catch { }
    return { ...DEFAULT_ANNOUNCEMENT };
}
async function initAnnouncementTable() {
    if (isTableInitialized)
        return;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "platform_announcements" (
        "id" VARCHAR(100) PRIMARY KEY,
        "active" BOOLEAN NOT NULL DEFAULT false,
        "message" TEXT NOT NULL DEFAULT '',
        "type" VARCHAR(50) NOT NULL DEFAULT 'info',
        "link" TEXT,
        "link_text" VARCHAR(200),
        "dismissible" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        isTableInitialized = true;
    }
    catch {
        // If DB is temporarily unavailable, fall back to memory
    }
}
function mapRowToAnnouncement(r) {
    return {
        id: r.id || 'default-announcement',
        active: Boolean(r.active),
        message: r.message || '',
        type: r.type || 'info',
        link: r.link || '',
        linkText: r.linkText || '',
        dismissible: r.dismissible !== false,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    };
}
/**
 * Fetch all announcements for admin log view (both active and inactive)
 */
async function getAllPlatformAnnouncements() {
    await initAnnouncementTable();
    try {
        const rows = await prisma_1.default.$queryRawUnsafe(`
      SELECT "id", "active", "message", "type", "link",
             "link_text" as "linkText", "dismissible",
             "created_at" as "createdAt", "updated_at" as "updatedAt"
      FROM "platform_announcements"
      ORDER BY "created_at" DESC, "updated_at" DESC
    `);
        if (Array.isArray(rows)) {
            const list = rows.map(mapRowToAnnouncement);
            cachedAnnouncements = list;
            return list;
        }
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to query announcements from database:', err.message);
    }
    if (cachedAnnouncements !== null) {
        return cachedAnnouncements;
    }
    return [];
}
/**
 * Fetch all ACTIVE announcements for user display (ordered oldest to newest so they queue in sequence)
 */
async function getActivePlatformAnnouncements() {
    await initAnnouncementTable();
    try {
        const rows = await prisma_1.default.$queryRawUnsafe(`
      SELECT "id", "active", "message", "type", "link",
             "link_text" as "linkText", "dismissible",
             "created_at" as "createdAt", "updated_at" as "updatedAt"
      FROM "platform_announcements"
      WHERE "active" = true
      ORDER BY "created_at" ASC
    `);
        if (Array.isArray(rows)) {
            return rows.map(mapRowToAnnouncement);
        }
    }
    catch (err) {
        // Fall back to memory
    }
    const all = await getAllPlatformAnnouncements();
    return all.filter((a) => a.active);
}
/**
 * Backward compatibility: get single latest active announcement
 */
async function getPlatformAnnouncement() {
    const active = await getActivePlatformAnnouncements();
    if (active.length > 0) {
        return active[active.length - 1]; // newest active
    }
    return { ...DEFAULT_ANNOUNCEMENT, active: false, message: '' };
}
/**
 * Create a brand-new broadcast announcement
 */
async function createPlatformAnnouncement(data) {
    await initAnnouncementTable();
    const now = new Date().toISOString();
    const id = data.id && data.id !== 'default' && data.id !== 'default-announcement'
        ? data.id
        : `announcement_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const created = {
        id,
        active: data.active !== false,
        message: (data.message || '').trim(),
        type: data.type || 'info',
        link: (data.link || '').trim(),
        linkText: (data.linkText || '').trim(),
        dismissible: data.dismissible !== false,
        createdAt: now,
        updatedAt: now,
    };
    // 1. Persist to PostgreSQL (Upsert to prevent duplicate key or missing rows)
    try {
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "platform_announcements" ("id", "active", "message", "type", "link", "link_text", "dismissible", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE
      SET "active" = EXCLUDED."active",
          "message" = EXCLUDED."message",
          "type" = EXCLUDED."type",
          "link" = EXCLUDED."link",
          "link_text" = EXCLUDED."link_text",
          "dismissible" = EXCLUDED."dismissible",
          "updated_at" = NOW()
      `, created.id, created.active, created.message, created.type, created.link || null, created.linkText || null, created.dismissible);
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to insert announcement into database:', err.message);
    }
    // 2. Persist to file if writable
    try {
        ensureDataDir();
        fs_1.default.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(created, null, 2), 'utf-8');
    }
    catch { }
    // Invalidate in-memory cache so subsequent queries fetch fresh data
    cachedAnnouncements = null;
    return created;
}
/**
 * Update an existing announcement
 */
async function updatePlatformAnnouncement(data) {
    await initAnnouncementTable();
    if (!data.id || data.id === 'default' || data.id === 'default-announcement') {
        return createPlatformAnnouncement(data);
    }
    const all = await getAllPlatformAnnouncements();
    const existing = all.find((a) => a.id === data.id);
    const now = new Date().toISOString();
    const updated = {
        ...(existing || DEFAULT_ANNOUNCEMENT),
        ...data,
        id: data.id,
        updatedAt: now,
    };
    try {
        await prisma_1.default.$executeRawUnsafe(`
      INSERT INTO "platform_announcements" ("id", "active", "message", "type", "link", "link_text", "dismissible", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE
      SET "active" = EXCLUDED."active",
          "message" = EXCLUDED."message",
          "type" = EXCLUDED."type",
          "link" = EXCLUDED."link",
          "link_text" = EXCLUDED."link_text",
          "dismissible" = EXCLUDED."dismissible",
          "updated_at" = NOW()
      `, updated.id, updated.active, updated.message.trim(), updated.type, updated.link || null, updated.linkText || null, updated.dismissible !== false);
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to update announcement in database:', err.message);
    }
    cachedAnnouncements = null;
    return updated;
}
/**
 * Delete an announcement permanently from the database.
 * Once deleted, no user opening the app/website will ever see it again!
 */
async function deletePlatformAnnouncement(id) {
    await initAnnouncementTable();
    try {
        await prisma_1.default.$executeRawUnsafe(`DELETE FROM "platform_announcements" WHERE "id" = $1`, id);
    }
    catch (err) {
        console.error('[AnnouncementService] Failed to delete announcement from database:', err.message);
    }
    // Also deactivate fallback file if it matches
    try {
        ensureDataDir();
        if (fs_1.default.existsSync(ANNOUNCEMENT_FILE)) {
            const raw = fs_1.default.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.id === id) {
                fs_1.default.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify({ ...DEFAULT_ANNOUNCEMENT, active: false, id: 'deleted' }, null, 2), 'utf-8');
            }
        }
    }
    catch { }
    if (cachedAnnouncements) {
        cachedAnnouncements = cachedAnnouncements.filter((a) => a.id !== id);
    }
    else {
        cachedAnnouncements = [];
    }
    return true;
}
/**
 * Toggle active status of an announcement
 */
async function togglePlatformAnnouncement(id, forceActive) {
    await initAnnouncementTable();
    const all = await getAllPlatformAnnouncements();
    const item = all.find((a) => a.id === id);
    if (!item)
        return null;
    const nextActive = typeof forceActive === 'boolean' ? forceActive : !item.active;
    return updatePlatformAnnouncement({ id, active: nextActive });
}
