import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma';
import { getPlatformAnnouncement, updatePlatformAnnouncement } from '../src/services/announcementService';

describe('Announcement Service', () => {
  it('should update and retrieve platform announcement from database', async () => {
    const testMsg = `Exciting new features - test ${Date.now()}`;
    const updated = await updatePlatformAnnouncement({
      active: true,
      message: testMsg,
      type: 'success',
      link: '/tasks',
      linkText: 'Check Tasks',
      dismissible: true,
    });

    expect(updated).toBeDefined();
    expect(updated.active).toBe(true);
    expect(updated.message).toBe(testMsg);
    expect(updated.type).toBe('success');
    expect(updated.id).toMatch(/^announcement_/);

    // Verify row was actually created in PostgreSQL table
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "platform_announcements" WHERE "id" = $1`,
      updated.id
    );
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(rows[0].message).toBe(testMsg);
    expect(rows[0].active).toBe(true);

    const fetched = await getPlatformAnnouncement();
    expect(fetched.active).toBe(true);
    expect(fetched.message).toBe(testMsg);
    expect(fetched.id).toBe(updated.id);
  });
});
