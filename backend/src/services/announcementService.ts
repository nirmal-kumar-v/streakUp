import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

export interface PlatformAnnouncement {
  id: string;
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  link?: string;
  linkText?: string;
  dismissible: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const ANNOUNCEMENT_FILE = path.join(DATA_DIR, 'announcement.json');

const DEFAULT_ANNOUNCEMENT: PlatformAnnouncement = {
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

let cachedAnnouncements: PlatformAnnouncement[] | null = null;
let isTableInitialized = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFileAnnouncement(): PlatformAnnouncement {
  ensureDataDir();
  try {
    if (fs.existsSync(ANNOUNCEMENT_FILE)) {
      const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
      return { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_ANNOUNCEMENT };
}

export async function initAnnouncementTable(): Promise<void> {
  if (isTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
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
  } catch {
    // If DB is temporarily unavailable, fall back to memory
  }
}

function mapRowToAnnouncement(r: any): PlatformAnnouncement {
  return {
    id: r.id || 'default-announcement',
    active: Boolean(r.active),
    message: r.message || '',
    type: (r.type as any) || 'info',
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
export async function getAllPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  await initAnnouncementTable();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
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
  } catch (err: any) {
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
export async function getActivePlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  await initAnnouncementTable();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
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
  } catch (err: any) {
    // Fall back to memory
  }

  const all = await getAllPlatformAnnouncements();
  return all.filter((a) => a.active);
}

/**
 * Backward compatibility: get single latest active announcement
 */
export async function getPlatformAnnouncement(): Promise<PlatformAnnouncement> {
  const active = await getActivePlatformAnnouncements();
  if (active.length > 0) {
    return active[active.length - 1]; // newest active
  }
  return { ...DEFAULT_ANNOUNCEMENT, active: false, message: '' };
}

/**
 * Create a brand-new broadcast announcement
 */
export async function createPlatformAnnouncement(
  data: Partial<Omit<PlatformAnnouncement, 'createdAt' | 'updatedAt'>>
): Promise<PlatformAnnouncement> {
  await initAnnouncementTable();

  const now = new Date().toISOString();
  const id =
    data.id && data.id !== 'default' && data.id !== 'default-announcement'
      ? data.id
      : `announcement_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const created: PlatformAnnouncement = {
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
    await prisma.$executeRawUnsafe(
      `
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
      `,
      created.id,
      created.active,
      created.message,
      created.type,
      created.link || null,
      created.linkText || null,
      created.dismissible
    );
  } catch (err: any) {
    console.error('[AnnouncementService] Failed to insert announcement into database:', err.message);
  }

  // 2. Persist to file if writable
  try {
    ensureDataDir();
    fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(created, null, 2), 'utf-8');
  } catch {}

  // Invalidate in-memory cache so subsequent queries fetch fresh data
  cachedAnnouncements = null;

  return created;
}

/**
 * Update an existing announcement
 */
export async function updatePlatformAnnouncement(
  data: Partial<PlatformAnnouncement>
): Promise<PlatformAnnouncement> {
  await initAnnouncementTable();

  if (!data.id || data.id === 'default' || data.id === 'default-announcement') {
    return createPlatformAnnouncement(data);
  }

  const all = await getAllPlatformAnnouncements();
  const existing = all.find((a) => a.id === data.id);
  const now = new Date().toISOString();

  const updated: PlatformAnnouncement = {
    ...(existing || DEFAULT_ANNOUNCEMENT),
    ...data,
    id: data.id,
    updatedAt: now,
  };

  try {
    await prisma.$executeRawUnsafe(
      `
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
      `,
      updated.id,
      updated.active,
      updated.message.trim(),
      updated.type,
      updated.link || null,
      updated.linkText || null,
      updated.dismissible !== false
    );
  } catch (err: any) {
    console.error('[AnnouncementService] Failed to update announcement in database:', err.message);
  }

  cachedAnnouncements = null;

  return updated;
}

/**
 * Delete an announcement permanently from the database.
 * Once deleted, no user opening the app/website will ever see it again!
 */
export async function deletePlatformAnnouncement(id: string): Promise<boolean> {
  await initAnnouncementTable();

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "platform_announcements" WHERE "id" = $1`,
      id
    );
  } catch (err: any) {
    console.error('[AnnouncementService] Failed to delete announcement from database:', err.message);
  }

  // Also deactivate fallback file if it matches
  try {
    ensureDataDir();
    if (fs.existsSync(ANNOUNCEMENT_FILE)) {
      const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.id === id) {
        fs.writeFileSync(
          ANNOUNCEMENT_FILE,
          JSON.stringify({ ...DEFAULT_ANNOUNCEMENT, active: false, id: 'deleted' }, null, 2),
          'utf-8'
        );
      }
    }
  } catch {}

  if (cachedAnnouncements) {
    cachedAnnouncements = cachedAnnouncements.filter((a) => a.id !== id);
  } else {
    cachedAnnouncements = [];
  }

  return true;
}

/**
 * Toggle active status of an announcement
 */
export async function togglePlatformAnnouncement(
  id: string,
  forceActive?: boolean
): Promise<PlatformAnnouncement | null> {
  await initAnnouncementTable();

  const all = await getAllPlatformAnnouncements();
  const item = all.find((a) => a.id === id);
  if (!item) return null;

  const nextActive = typeof forceActive === 'boolean' ? forceActive : !item.active;
  return updatePlatformAnnouncement({ id, active: nextActive });
}
