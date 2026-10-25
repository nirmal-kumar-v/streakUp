import fs from 'fs';
import path from 'path';

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

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getPlatformAnnouncement(): PlatformAnnouncement {
  if (cachedAnnouncement) {
    return cachedAnnouncement;
  }

  ensureDataDir();
  try {
    if (fs.existsSync(ANNOUNCEMENT_FILE)) {
      const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf-8');
      cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(raw) };
      return cachedAnnouncement!;
    }
  } catch (err) {
    console.error('[AnnouncementService] Failed to read announcement file:', err);
  }

  cachedAnnouncement = { ...DEFAULT_ANNOUNCEMENT };
  return cachedAnnouncement;
}

export function updatePlatformAnnouncement(
  data: Partial<Omit<PlatformAnnouncement, 'id' | 'createdAt' | 'updatedAt'>>
): PlatformAnnouncement {
  ensureDataDir();
  const current = getPlatformAnnouncement();
  const updated: PlatformAnnouncement = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    cachedAnnouncement = updated;
  } catch (err) {
    console.error('[AnnouncementService] Failed to save announcement file:', err);
    throw new Error('Failed to persist announcement');
  }

  return updated;
}
