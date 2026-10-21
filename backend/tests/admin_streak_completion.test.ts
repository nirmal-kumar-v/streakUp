import { describe, it, expect, vi } from 'vitest';
import { recalculateUserStreaks, recalculateTaskStreaks } from '../src/services/streakService';
import { checkAndTriggerMilestones } from '../src/services/notificationService';
import { FreezeScope, NotificationCategory } from '@prisma/client';
import { calculateOptimisticUserStreak } from '../../frontend/src/utils/streak';

describe('Admin Streak Correction & Account Tick Progression', () => {
  const timezone = 'Asia/Kolkata';

  it('1. Admin sets overall streak to 10 and longest to 25 -> ticking advances to 11 and preserves longest streak 25', async () => {
    // Simulated Prisma mock where user has currentStreak: 10 and longestStreak: 25 set by admin
    const mockUser = {
      id: 'user-streak-test',
      timezone,
      currentStreak: 10,
      longestStreak: 25,
      overallFreezeCapacity: 1,
    };

    let updatedUserData: any = null;

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockImplementation(async ({ data }) => {
          updatedUserData = data;
          return { ...mockUser, ...data };
        }),
      },
      taskCompletion: {
        // Only 1 completion in DB (today's completion)
        findMany: vi.fn().mockResolvedValue([{ completionDate: '2026-10-21' }]),
      },
      freezeLog: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    // When completing a task for the first time today, targetCurrentStreak is 10 + 1 = 11, targetLongest is 25
    const result = await recalculateUserStreaks(mockPrisma, 'user-streak-test', timezone, {
      targetCurrentStreak: 11,
      targetLongestStreak: 25,
    });

    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(25);
    expect(updatedUserData.currentStreak).toBe(11);
    expect(updatedUserData.longestStreak).toBe(25);
  });

  it('2. Admin sets task streak to 10 and longest to 20 -> ticking advances task to 11 and preserves longest streak 20', async () => {
    const mockTask = {
      id: 'task-streak-test',
      recurrence: 'DAILY',
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      freezeCapacity: 1,
      currentStreak: 10,
      longestStreak: 20,
    };

    let updatedTaskData: any = null;

    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(mockTask),
        update: vi.fn().mockImplementation(async ({ data }) => {
          updatedTaskData = data;
          return { ...mockTask, ...data };
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ timezone }),
      },
      taskCompletion: {
        // Only 1 completion in DB (today's completion)
        findMany: vi.fn().mockResolvedValue([{ completionDate: '2026-10-21' }]),
      },
      freezeLog: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    // Target task streak is 10 + 1 = 11, target longest is Math.max(20, 11) = 20
    const result = await recalculateTaskStreaks(mockPrisma, 'task-streak-test', 'user-1', timezone, {
      targetCurrentStreak: 11,
      targetLongestStreak: 20,
    });

    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(20);
    expect(updatedTaskData.currentStreak).toBe(11);
    expect(updatedTaskData.longestStreak).toBe(20);
  });

  it('3. Unticking decrements current streak to 10 while longest streak remains preserved at 25', async () => {
    const mockUser = {
      id: 'user-streak-test',
      timezone,
      currentStreak: 11,
      longestStreak: 25,
      overallFreezeCapacity: 1,
    };

    let updatedUserData: any = null;

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockImplementation(async ({ data }) => {
          updatedUserData = data;
          return { ...mockUser, ...data };
        }),
      },
      taskCompletion: {
        // Zero completions left today
        findMany: vi.fn().mockResolvedValue([]),
      },
      freezeLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    // Upon untick with no other completions today, targetCurrentStreak is 11 - 1 = 10, targetLongest is 25
    const result = await recalculateUserStreaks(mockPrisma, 'user-streak-test', timezone, {
      targetCurrentStreak: 10,
      targetLongestStreak: 25,
    });

    expect(result.currentStreak).toBe(10);
    expect(result.longestStreak).toBe(25);
    expect(updatedUserData.currentStreak).toBe(10);
    expect(updatedUserData.longestStreak).toBe(25);
  });

  it('4. Completing a streak milestone creates in-app notification without sending email', async () => {
    const prismaModule = await import('../src/config/prisma');
    const prisma = prismaModule.default;

    let capturedNotification: any = null;

    const findMilestoneSpy = vi.spyOn(prisma.milestoneEvent, 'findUnique').mockResolvedValue(null as any);
    const createMilestoneSpy = vi.spyOn(prisma.milestoneEvent, 'create').mockResolvedValue({ id: 'm-1' } as any);
    const findUserSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'u-1', name: 'Tester', email: 'tester@test.com' } as any);
    const findPrefSpy = vi.spyOn(prisma.notificationPreference, 'findUnique').mockResolvedValue({
      userId: 'u-1',
      inAppNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      myMilestonesEmail: true,
      myMilestonesInApp: true,
    } as any);
    const findNotifSpy = vi.spyOn(prisma.notification, 'findFirst').mockResolvedValue(null as any);
    const createNotifSpy = vi.spyOn(prisma.notification, 'create').mockImplementation(async ({ data }: any) => {
      capturedNotification = data;
      return { id: 'n-1', ...data } as any;
    });
    const findFriendshipSpy = vi.spyOn(prisma.friendship, 'findMany').mockResolvedValue([]);

    try {
      await checkAndTriggerMilestones({
        userId: 'u-1',
        scope: FreezeScope.OVERALL,
        scopeId: 'OVERALL',
        currentStreak: 10, // Milestone!
      });

      expect(capturedNotification).not.toBeNull();
      expect(capturedNotification.category).toBe(NotificationCategory.MY_MILESTONE);
      expect(capturedNotification.title).toContain('10-Day Streak Milestone');
      // Verify NO email subject or email text was passed for user's milestone
      expect(capturedNotification.emailSubject).toBeUndefined();
      expect(capturedNotification.emailText).toBeUndefined();
    } finally {
      findMilestoneSpy.mockRestore();
      createMilestoneSpy.mockRestore();
      findUserSpy.mockRestore();
      findPrefSpy.mockRestore();
      findNotifSpy.mockRestore();
      createNotifSpy.mockRestore();
      findFriendshipSpy.mockRestore();
    }
  });

  it('5. Frontend calculateOptimisticUserStreak increments admin-set streak even if account created today', () => {
    const today = new Date().toISOString();

    // Admin set currentStreak to 10
    const optimistic1 = calculateOptimisticUserStreak(10, false, today);
    expect(optimistic1).toBe(11); // Advances to 11, NOT reset to 1!

    // Brand new user joining today with streak 0
    const optimisticNew = calculateOptimisticUserStreak(0, false, today);
    expect(optimisticNew).toBe(1); // Fresh start properly becomes 1

    // If another task is already completed today, streak remains unchanged
    const optimisticSecondTask = calculateOptimisticUserStreak(11, true, today);
    expect(optimisticSecondTask).toBe(11);
  });
});
