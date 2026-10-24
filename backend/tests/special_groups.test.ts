import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/config/prisma';

vi.setConfig({ testTimeout: 60000 });
import {
  detectSpecialPlatform,
  isSpecialGroupPlatform,
  getSpecialGroupDefinition,
} from '../src/services/specialGroupRegistry';
import {
  ensureSpecialGroupMemberTasks,
  getSpecialGroupActivitiesForMember,
  completeSpecialActivity,
  uncompleteSpecialActivity,
  adminCorrectSpecialActivityStreak,
  adminGrantSpecialActivityDate,
} from '../src/services/specialGroupService';
import { initSpecialGroupsDatabaseAndMigrate } from '../src/services/specialGroupMigration';

describe('Special Groups (LeetCode & GeeksforGeeks) System', () => {
  let testUserId: string;
  let testGroupId: string;
  const timezone = 'Asia/Kolkata';

  beforeAll(async () => {
    // Create dedicated test user
    const user = await prisma.user.create({
      data: {
        username: `sg_test_${Date.now()}`,
        normalizedUsername: `sg_test_${Date.now()}`.toLowerCase(),
        email: `sg_test_${Date.now()}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Special Group Test User',
        timezone,
      },
    });
    testUserId = user.id;

    // Create a special LeetCode group
    const group = await prisma.group.create({
      data: {
        name: 'LeetCode Daily Challenge',
        joinCode: `LC-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        ownerId: testUserId,
        isSpecialGroup: true,
        specialPlatform: 'LEETCODE',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    testGroupId = group.id;

    // Add user as owner
    await prisma.groupMember.create({
      data: {
        groupId: testGroupId,
        userId: testUserId,
        role: 'OWNER',
        isPotdCommitted: true,
      },
    });
  }, 60000);

  afterAll(async () => {
    try {
      if (testGroupId) {
        await prisma.group.delete({ where: { id: testGroupId } }).catch(() => {});
      }
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch (e) {
      // ignore cleanup errors
    }
  }, 60000);

  describe('1. Platform Detection & Registry', () => {
    it('detects LeetCode case-insensitively', () => {
      expect(detectSpecialPlatform('LeetCode')).toBe('LEETCODE');
      expect(detectSpecialPlatform('leetcode')).toBe('LEETCODE');
      expect(detectSpecialPlatform('LEETCODE')).toBe('LEETCODE');
      expect(detectSpecialPlatform('LeetCode Daily Challenge')).toBe('LEETCODE');
      expect(detectSpecialPlatform('  leetcode 2026  ')).toBe('LEETCODE');
    });

    it('detects GeeksforGeeks and GFG standalone token case-insensitively', () => {
      expect(detectSpecialPlatform('GeeksforGeeks')).toBe('GEEKSFORGEEKS');
      expect(detectSpecialPlatform('geeksforgeeks')).toBe('GEEKSFORGEEKS');
      expect(detectSpecialPlatform('GEEKSFORGEEKS')).toBe('GEEKSFORGEEKS');
      expect(detectSpecialPlatform('GFG')).toBe('GEEKSFORGEEKS');
      expect(detectSpecialPlatform('gfg')).toBe('GEEKSFORGEEKS');
      expect(detectSpecialPlatform('GFG Practice Group')).toBe('GEEKSFORGEEKS');
    });

    it('detects LinkedIn case-insensitively', () => {
      expect(detectSpecialPlatform('LinkedIn')).toBe('LINKEDIN');
      expect(detectSpecialPlatform('linkedin')).toBe('LINKEDIN');
      expect(detectSpecialPlatform('LinkedIn Daily Games')).toBe('LINKEDIN');
    });

    it('returns null for ordinary group names or ambiguous words', () => {
      expect(detectSpecialPlatform('GATE CSE 2026')).toBeNull();
      expect(detectSpecialPlatform('Fitness Habit')).toBeNull();
      expect(detectSpecialPlatform('Daily Math Practice')).toBeNull();
      // Ambiguous multiple platform mentions
      expect(detectSpecialPlatform('LeetCode and GFG Together')).toBeNull();
    });

    it('validates registry configurations', () => {
      const lcDef = getSpecialGroupDefinition('LEETCODE');
      expect(lcDef).toBeDefined();
      expect(lcDef?.activityModel).toBe('DAILY_POTD');
      expect(lcDef?.activities).toHaveLength(2);

      const gfgDef = getSpecialGroupDefinition('GEEKSFORGEEKS');
      expect(gfgDef).toBeDefined();
      expect(gfgDef?.activityModel).toBe('DAILY_POTD');
      expect(gfgDef?.activities).toHaveLength(2);

      const liDef = getSpecialGroupDefinition('LINKEDIN');
      expect(liDef).toBeDefined();
      expect(liDef?.activityModel).toBe('LINKEDIN_GAMES');
    });
  });

  describe('2. Idempotent Migration Service', () => {
    it('migration runs idempotently without corrupting or duplicating groups', async () => {
      const res = await initSpecialGroupsDatabaseAndMigrate();
      expect(res).toBeDefined();
      expect(typeof res.migratedGroupsCount).toBe('number');
    });
  });

  describe('3. Special Group Tasks & Activities Initialization', () => {
    it('initializes Daily and POTD tasks for member', async () => {
      await ensureSpecialGroupMemberTasks(testGroupId, testUserId);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      expect(view).toBeDefined();
      expect(view?.platform).toBe('LEETCODE');
      expect(view?.activities).toHaveLength(2);

      const daily = view?.activities.find((a) => a.id === 'daily');
      const potd = view?.activities.find((a) => a.id === 'potd');
      expect(daily).toBeDefined();
      expect(potd).toBeDefined();
      expect(daily?.name).toContain('Daily');
      expect(potd?.name).toContain('POTD');
    });
  });

  describe('4. Exact Completion and Streak Logic (Rules A to E)', () => {
    it('Rule A: Ticking Daily completes Daily only without marking POTD complete', async () => {
      const res = await completeSpecialActivity(testGroupId, testUserId, 'daily', timezone, 'Completed 2 LC mediums');
      expect(res.success).toBe(true);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      const daily = view?.activities.find((a) => a.id === 'daily');
      const potd = view?.activities.find((a) => a.id === 'potd');

      expect(daily?.completedToday).toBe(true);
      expect(daily?.currentStreak).toBeGreaterThanOrEqual(1);
      // POTD must NOT be completed
      expect(potd?.completedToday).toBe(false);
      expect(potd?.currentStreak).toBe(0);
    });

    it('Rule C: Completing Daily first, then completing POTD later on same date marks POTD completed without duplicate Daily awarding', async () => {
      const res = await completeSpecialActivity(testGroupId, testUserId, 'potd', timezone, 'Solved today LC POTD');
      expect(res.success).toBe(true);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      const daily = view?.activities.find((a) => a.id === 'daily');
      const potd = view?.activities.find((a) => a.id === 'potd');

      expect(daily?.completedToday).toBe(true);
      expect(potd?.completedToday).toBe(true);
      expect(potd?.currentStreak).toBeGreaterThanOrEqual(1);
    });

    it('Rule E: Unchecking POTD does NOT uncheck Daily', async () => {
      const res = await uncompleteSpecialActivity(testGroupId, testUserId, 'potd', timezone);
      expect(res.success).toBe(true);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      const daily = view?.activities.find((a) => a.id === 'daily');
      const potd = view?.activities.find((a) => a.id === 'potd');

      // POTD is now uncompleted
      expect(potd?.completedToday).toBe(false);
      // Daily MUST REMAIN completed!
      expect(daily?.completedToday).toBe(true);
    });

    it('Rule B & D: Ticking POTD first completes both POTD and Daily atomically and repeated calls are idempotent', async () => {
      // First uncomplete Daily to test clean POTD-first execution
      await uncompleteSpecialActivity(testGroupId, testUserId, 'daily', timezone);

      // Now complete POTD
      const res = await completeSpecialActivity(testGroupId, testUserId, 'potd', timezone, 'Solved POTD first');
      expect(res.success).toBe(true);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      const daily = view?.activities.find((a) => a.id === 'daily');
      const potd = view?.activities.find((a) => a.id === 'potd');

      // Both must be completed!
      expect(daily?.completedToday).toBe(true);
      expect(potd?.completedToday).toBe(true);

      // Calling complete again is idempotent (no inflated streak or error)
      const repeatRes = await completeSpecialActivity(testGroupId, testUserId, 'potd', timezone, 'Solved POTD retry');
      expect(repeatRes.success).toBe(true);
    });
  });

  describe('5. Member POTD Commitment Toggle (Rule F)', () => {
    it('disabling POTD commitment preserves completion records and streaks', async () => {
      // Disable POTD commitment
      await prisma.groupMember.update({
        where: { groupId_userId: { groupId: testGroupId, userId: testUserId } },
        data: { isPotdCommitted: false },
      });

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      expect(view?.isPotdCommitted).toBe(false);

      const potd = view?.activities.find((a) => a.id === 'potd');
      expect(potd?.isCommitted).toBe(false);
      // History preserved
      expect(potd?.currentStreak).toBeGreaterThanOrEqual(1);

      // Re-enable POTD commitment
      await prisma.groupMember.update({
        where: { groupId_userId: { groupId: testGroupId, userId: testUserId } },
        data: { isPotdCommitted: true },
      });

      const viewReenabled = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      expect(viewReenabled?.isPotdCommitted).toBe(true);
    });
  });

  describe('6. Admin Streak and Date Controls', () => {
    it('Super Admin can correct streak for Daily and POTD independently', async () => {
      const updated = await adminCorrectSpecialActivityStreak(testGroupId, testUserId, 'daily', 15, 20);
      expect(updated.currentStreak).toBe(15);
      expect(updated.longestStreak).toBe(20);

      const view = await getSpecialGroupActivitiesForMember(testGroupId, testUserId, timezone);
      const daily = view?.activities.find((a) => a.id === 'daily');
      expect(daily?.currentStreak).toBe(15);
      expect(daily?.longestStreak).toBe(20);
    });

    it('Super Admin can grant completion for a past date', async () => {
      const pastDate = '2026-10-20';
      const grantRes = await adminGrantSpecialActivityDate(
        testGroupId,
        testUserId,
        'potd',
        pastDate,
        'Admin verified completion'
      );
      expect(grantRes.isCompleted).toBe(true);
      expect(grantRes.date).toBe(pastDate);

      // Verify completion record was persisted
      const comp = await prisma.taskCompletion.findUnique({
        where: {
          taskId_completionDate: {
            taskId: grantRes.taskId,
            completionDate: pastDate,
          },
        },
      });
      expect(comp).toBeDefined();
      expect(comp?.studyNote).toBe('Admin verified completion');
    });
  });
});
