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
  active: false,
  message: '',
  type: 'info',
  link: '',
  linkText: '',
  dismissible: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let cachedAnnouncement: PlatformAnnouncement | null = null;
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

    // If table is newly created and empty, seed initial announcement from JSON file
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as count FROM "platform_announcements"`
    );
    const count = Number(existing?.[0]?.count ?? 0);
    if (count === 0) {
      const initial = getFileAnnouncement();
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "platform_announcements" ("id", "active", "message", "type", "link", "link_text", "dismissible", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT ("id") DO NOTHING
        `,
        initial.id,
        initial.active,
        initial.message.trim(),
        initial.type,
        initial.link || null,
        initial.linkText || null,
        initial.dismissible !== false
      );
    }
  } catch {
    // If DB is temporarily unavailable, fall back to file
  }
}

export async function getPlatformAnnouncement(): Promise<PlatformAnnouncement> {
  await initAnnouncementTable();

  // 1. Query PostgreSQL database first (authoritative across all serverless instances)
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "active", "message", "type", "link",
             "link_text" as "linkText", "dismissible",
             "created_at" as "createdAt", "updated_at" as "updatedAt"
      FROM "platform_announcements"
      ORDER BY "updated_at" DESC
      LIMIT 1
    `);

    if (Array.isArray(rows) && rows.length > 0) {
      const r = rows[0];
      const result: PlatformAnnouncement = {
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
      cachedAnnouncement = result;
      return result;
    }
  } catch (err: any) {
    // Database query failed, fall back to memory/file
  }

  // 2. Fallback to memory cache
  if (cachedAnnouncement) {
    return cachedAnnouncement;
  }

  // 3. Fallback to local json file
  ensureDataDir();
  try {
    if (fs.existsSync(ANNOUNCEMENT_FILE)) {
      const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
      cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
      return cachedAnnouncement!;
    }
  } catch {}

  cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT };
  return cachedAnnouncement;
}

export async function updatePlatformAnnouncement(
  data: Partial<Omit<PlatformAnnouncement, 'createdAt' | 'updatedAt'>>
): Promise<PlatformAnnouncement> {
  await initAnnouncementTable();

  const current = await getPlatformAnnouncement();
  const now = new Date().toISOString();
  // Always generate a unique ID on active publication so every client device gets the pop-up modal
  const newId = `announcement_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const finalId = data.active ? newId : (data.id || current.id);

  const updated: PlatformAnnouncement = {
    ...current,
    ...data,
    id: finalId,
    updatedAt: now,
  };

  // 1. Persist to PostgreSQL database (authoritative across all Vercel serverless containers)
  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "platform_announcements" ("id", "active", "message", "type", "link", "link_text", "dismissible", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "active" = EXCLUDED."active",
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
    console.error('[AnnouncementService] Database upsert failed:', err.message);
  }

  // 2. Also write to local file if writable (e.g. local dev / tests)
  try {
    ensureDataDir();
    fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch {}

  cachedAnnouncement = updated;
  return updated;
}
