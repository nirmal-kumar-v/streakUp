import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma';
import {
  getPlatformAnnouncement,
  getAllPlatformAnnouncements,
  getActivePlatformAnnouncements,
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
  togglePlatformAnnouncement,
  updatePlatformAnnouncement,
} from '../src/services/announcementService';

describe('Announcement Service', () => {
  it('should create, retrieve, toggle, and delete announcements from database', async () => {
    // 1. Create first announcement
    const ann1 = await createPlatformAnnouncement({
      active: true,
      message: `Announcement 1 - ${Date.now()}`,
      type: 'info',
    });
    expect(ann1.id).toBeDefined();
    expect(ann1.active).toBe(true);

    // 2. Create second announcement (for multiple announcements in a row)
    const ann2 = await createPlatformAnnouncement({
      active: true,
      message: `Announcement 2 - ${Date.now()}`,
      type: 'warning',
    });
    expect(ann2.id).toBeDefined();
    expect(ann2.active).toBe(true);

    // 3. Verify both active announcements are returned
    const active = await getActivePlatformAnnouncements();
    const ids = active.map((a) => a.id);
    expect(ids).toContain(ann1.id);
    expect(ids).toContain(ann2.id);

    // 4. Verify all announcements are returned for admin log
    const all = await getAllPlatformAnnouncements();
    expect(all.length).toBeGreaterThanOrEqual(2);

    // 5. Toggle an announcement inactive
    const toggled = await togglePlatformAnnouncement(ann1.id, false);
    expect(toggled?.active).toBe(false);

    const activeAfterToggle = await getActivePlatformAnnouncements();
    expect(activeAfterToggle.map((a) => a.id)).not.toContain(ann1.id);
    expect(activeAfterToggle.map((a) => a.id)).toContain(ann2.id);

    // 6. Delete announcement so future users will not see it
    await deletePlatformAnnouncement(ann2.id);
    const activeAfterDelete = await getActivePlatformAnnouncements();
    expect(activeAfterDelete.map((a) => a.id)).not.toContain(ann2.id);

    // Verify row was removed from database
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "platform_announcements" WHERE "id" = $1`,
      ann2.id
    );
    expect(rows.length).toBe(0);
  });
});
