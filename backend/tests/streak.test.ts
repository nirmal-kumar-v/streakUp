import { describe, it, expect } from 'vitest';
import { calculateStreaks } from '../src/services/streakService';
import { DateTime } from 'luxon';

describe('Streak Calculation Engine', () => {
  const tz = 'Asia/Kolkata';
  // Use a fixed reference date: Wednesday 2026-10-14 14:00:00 IST
  const refDate = DateTime.fromISO('2026-10-14T14:00:00', { zone: tz }).toJSDate();

  it('should return 0 streak for empty completion history', () => {
    const result = calculateStreaks([], tz, refDate);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.hasCompletedToday).toBe(false);
    expect(result.lastCompletedDate).toBeNull();
  });

  it('should return 1-day streak if completed today only', () => {
    const result = calculateStreaks(['2026-10-14'], tz, refDate);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.hasCompletedToday).toBe(true);
    expect(result.lastCompletedDate).toBe('2026-10-14');
  });

  it('should maintain streak from yesterday if today is not completed yet', () => {
    // Completed yesterday (2026-10-13) and day before (2026-10-12)
    const result = calculateStreaks(['2026-10-12', '2026-10-13'], tz, refDate);
    expect(result.hasCompletedToday).toBe(false);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('should increase streak when task is completed today on top of consecutive days', () => {
    // Completed 10-12, 10-13, and today 10-14
    const result = calculateStreaks(['2026-10-12', '2026-10-13', '2026-10-14'], tz, refDate);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.hasCompletedToday).toBe(true);
  });

  it('should break streak to 0 if yesterday was missed and today is not completed', () => {
    // Completed on 2026-10-11 and 2026-10-12, but missed 2026-10-13 and today 2026-10-14
    const result = calculateStreaks(['2026-10-11', '2026-10-12'], tz, refDate);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2); // Historical best preserved!
  });

  it('should reset current streak to 1 if user completes today after missing yesterday', () => {
    // Completed on 2026-10-11, missed 10-12 & 10-13, completed today 10-14
    const result = calculateStreaks(['2026-10-11', '2026-10-14'], tz, refDate);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('should preserve historical longest streak even after long breaks', () => {
    // 5 consecutive days in September, then 1 day today
    const dates = [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
      '2026-10-14'
    ];
    const result = calculateStreaks(dates, tz, refDate);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(5);
  });

  it('should not inflate streak when multiple tasks are completed on the same date (deduplication)', () => {
    // Duplicate entries for the same date
    const dates = ['2026-10-14', '2026-10-14', '2026-10-14'];
    const result = calculateStreaks(dates, tz, refDate);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.activeDatesCount).toBe(1);
  });

  it('should correctly recalculate streak when unticking the only task of today', () => {
    // User had completed today and yesterday: streak was 2
    const beforeUntick = calculateStreaks(['2026-10-13', '2026-10-14'], tz, refDate);
    expect(beforeUntick.currentStreak).toBe(2);

    // Unticking today's task leaves only yesterday
    const afterUntick = calculateStreaks(['2026-10-13'], tz, refDate);
    expect(afterUntick.currentStreak).toBe(1); // Still has intact yesterday's streak
    expect(afterUntick.hasCompletedToday).toBe(false);
  });

  it('should correctly recalculate streak when unticking a single task day to 0', () => {
    // Unticking today when there were no previous days
    const afterUntick = calculateStreaks([], tz, refDate);
    expect(afterUntick.currentStreak).toBe(0);
    expect(afterUntick.longestStreak).toBe(0);
  });

  // --- Regression Tests for Multi-Task Overall Streak Qualification ---
  describe('Multi-Task Overall Streak Qualification Rules', () => {
    it('rule: completing at least one task on a local calendar day qualifies that day toward overall streak', () => {
      // Monday (10-12): Task A completed
      // Tuesday (10-13): Task B completed (Task A pending)
      // Wednesday (10-14, today): Task A completed (Task B pending)
      const overallDates = ['2026-10-12', '2026-10-13', '2026-10-14'];
      const result = calculateStreaks(overallDates, tz, refDate);
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
      expect(result.hasCompletedToday).toBe(true);
    });

    it('rule: completing multiple tasks on the same day counts as one overall streak day, not multiple days', () => {
      // User completes Task A, Task B, and Task C all on 2026-10-14
      const completionsWithDuplicates = ['2026-10-14', '2026-10-14', '2026-10-14'];
      const result = calculateStreaks(completionsWithDuplicates, tz, refDate);
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.activeDatesCount).toBe(1);
    });

    it('rule: completing Task B maintains overall streak even if Task A is not completed', () => {
      // 10-13: Only Task A
      // 10-14: Only Task B completed today
      const overallDates = ['2026-10-13', '2026-10-14'];
      const result = calculateStreaks(overallDates, tz, refDate);
      expect(result.currentStreak).toBe(2);
      expect(result.hasCompletedToday).toBe(true);
    });

    it('rule: overall streak breaks if zero tasks were completed yesterday and today is pending', () => {
      // Completed 10-11 and 10-12, but no tasks on 10-13 or 10-14
      const overallDates = ['2026-10-11', '2026-10-12'];
      const result = calculateStreaks(overallDates, tz, refDate);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });
  });

  describe('Inactive User & Stale Streak Reconciliation (Jaishree fix)', () => {
    it('should drop currentStreak to 0 when user misses days even if user record was recently updated', async () => {
      const { recalculateUserStreaks } = await import('../src/services/streakService');
      const mockUser = {
        id: 'u-jaishree',
        timezone: 'Asia/Kolkata',
        currentStreak: 2,
        longestStreak: 2,
        overallFreezeCapacity: 1,
        updatedAt: new Date(), // updated today
      };

      let updatedData: any = null;
      const mockPrisma = {
        user: {
          findUnique: async () => mockUser,
          update: async ({ data }: any) => {
            updatedData = data;
            return { ...mockUser, ...data };
          },
        },
        taskCompletion: {
          findMany: async () => [
            { completionDate: '2026-10-17' },
            { completionDate: '2026-10-18' },
          ],
        },
        freezeLog: {
          findMany: async () => [],
          upsert: async () => ({}),
        },
      };

      const result = await recalculateUserStreaks(mockPrisma, 'u-jaishree', 'Asia/Kolkata');
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
      expect(updatedData?.currentStreak).toBe(0);
      expect(updatedData?.longestStreak).toBe(2);
    });

    it('ensureUserStreakCurrent correctly returns 0 for inactive users who have not completed today/yesterday', async () => {
      const { ensureUserStreakCurrent } = await import('../src/services/streakService');
      const mockUser = {
        id: 'u-inactive',
        timezone: 'Asia/Kolkata',
        currentStreak: 2,
        longestStreak: 2,
      };

      const mockPrisma = {
        user: {
          findUnique: async () => ({ ...mockUser, overallFreezeCapacity: 1, updatedAt: new Date() }),
          update: async ({ data }: any) => ({ ...mockUser, ...data }),
        },
        taskCompletion: {
          findFirst: async () => null, // no completions today or yesterday
          findMany: async () => [{ completionDate: '2026-10-10' }],
        },
        freezeLog: {
          findFirst: async () => null, // no freeze yesterday
          findMany: async () => [],
          upsert: async () => ({}),
        },
      };

      const result = await ensureUserStreakCurrent(mockPrisma, mockUser);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });

    it('ensureTaskStreakCurrent correctly returns 0 for inactive group/individual tasks', async () => {
      const { ensureTaskStreakCurrent } = await import('../src/services/streakService');
      const mockTask = {
        id: 'task-inactive',
        userId: 'u-inactive',
        recurrence: 'DAILY',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        currentStreak: 2,
        longestStreak: 2,
      };

      const mockPrisma = {
        task: {
          findUnique: async () => ({ ...mockTask, freezeCapacity: 1, updatedAt: new Date() }),
          update: async ({ data }: any) => ({ ...mockTask, ...data }),
        },
        user: {
          findUnique: async () => ({ timezone: 'Asia/Kolkata' }),
        },
        taskCompletion: {
          findFirst: async () => null,
          findMany: async () => [{ completionDate: '2026-10-10' }],
        },
        freezeLog: {
          findFirst: async () => null,
          findMany: async () => [],
          upsert: async () => ({}),
        },
      };

      const result = await ensureTaskStreakCurrent(mockPrisma, mockTask, 'Asia/Kolkata');
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });
  });
});

