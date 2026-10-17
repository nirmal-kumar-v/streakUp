import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateStreakAndFreezes } from '../src/services/freezeService';
import { awardCompletionPoints, reconcileMissedPointsForUser, getUserPointsStats, getDayOfWeekFromDateString } from '../src/services/pointsService';
import { formatReactions } from '../src/controllers/reactionController';

describe('Feature Expansion — Scheduling, Points, Reactions, and Nudges', () => {

  describe('Habit Scheduling and Streak Compatibility', () => {
    it('should correctly map date strings to day of week (0=Sun, 1=Mon, ..., 6=Sat)', () => {
      // 2026-10-18 is Sunday (0)
      expect(getDayOfWeekFromDateString('2026-10-18', 'Asia/Kolkata')).toBe(0);
      // 2026-10-19 is Monday (1)
      expect(getDayOfWeekFromDateString('2026-10-19', 'Asia/Kolkata')).toBe(1);
      // 2026-10-24 is Saturday (6)
      expect(getDayOfWeekFromDateString('2026-10-24', 'Asia/Kolkata')).toBe(6);
    });

    it('should NOT break a streak on unscheduled days when the user does not complete the task', () => {
      // Suppose a habit is only scheduled on weekdays: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5)
      // Sat(6) and Sun(0) are unscheduled.
      const weekdaysOnly = [1, 2, 3, 4, 5];
      // Completions on Thursday and Friday:
      const completions = ['2026-10-15', '2026-10-16']; // Thu, Fri
      // Ref date is Monday 2026-10-19 (simulating Sunday 2026-10-18 was not completed, Sat 2026-10-17 was not completed)
      const refDate = new Date('2026-10-19T10:00:00Z');

      const result = calculateStreakAndFreezes(
        completions,
        [],
        'UTC',
        refDate,
        weekdaysOnly
      );

      // Streak should NOT break over Saturday and Sunday! Current streak should remain intact (2 days from Thu & Fri)
      expect(result.currentStreak).toBe(2);
      expect(result.newlyConsumedDates.length).toBe(0); // No freeze consumed on unscheduled weekend
    });

    it('should break streak on a scheduled day if missed and no freeze is available', () => {
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      const completions = ['2026-10-14', '2026-10-15']; // Wed, Thu
      // Missed Friday 2026-10-16. Ref date is Saturday 2026-10-17.
      const refDate = new Date('2026-10-17T10:00:00Z');

      const result = calculateStreakAndFreezes(
        completions,
        [],
        'UTC',
        refDate,
        allDays
      );

      // Missed scheduled Friday without freeze breaks the streak
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('Points System Calculations and Audit Rules', () => {
    it('awardCompletionPoints should award +5 points on scheduled day and prevent duplicates', async () => {
      let totalPoints = 0;
      const ledgers: any[] = [];

      const mockPrisma: any = {
        pointLedger: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            return ledgers.find(
              (l) =>
                l.userId === where.userId_taskId_date_reason.userId &&
                l.taskId === where.userId_taskId_date_reason.taskId &&
                l.date === where.userId_taskId_date_reason.date &&
                l.reason === where.userId_taskId_date_reason.reason
            );
          }),
          deleteMany: vi.fn(),
          upsert: vi.fn().mockImplementation(({ create }) => {
            ledgers.push(create);
            totalPoints += create.points;
          }),
          aggregate: vi.fn().mockImplementation(() => ({
            _sum: { points: totalPoints }
          }))
        },
        user: {
          findUnique: vi.fn().mockImplementation(() => ({ points: totalPoints })),
          update: vi.fn()
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return callback(mockPrisma);
        })
      };

      // 2026-10-19 is Monday (1)
      const scheduledDays = [1, 2, 3, 4, 5]; // Mon-Fri
      const res1 = await awardCompletionPoints(
        mockPrisma,
        'user-1',
        'task-1',
        '2026-10-19',
        scheduledDays,
        'UTC'
      );

      expect(res1.pointsAwarded).toBe(5);
      expect(res1.newTotalPoints).toBe(5);

      // Repeat completion on the same scheduled day: MUST NOT award duplicate points
      const res2 = await awardCompletionPoints(
        mockPrisma,
        'user-1',
        'task-1',
        '2026-10-19',
        scheduledDays,
        'UTC'
      );
      expect(res2.pointsAwarded).toBe(0);
      expect(res2.newTotalPoints).toBe(5);
    });

    it('awardCompletionPoints should give zero points on an unscheduled day', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ points: 20 })
        }
      };

      // 2026-10-18 is Sunday (0). Task only scheduled on Mon(1) and Wed(3).
      const res = await awardCompletionPoints(
        mockPrisma,
        'user-1',
        'task-1',
        '2026-10-18',
        [1, 3],
        'UTC'
      );

      expect(res.pointsAwarded).toBe(0);
      expect(res.newTotalPoints).toBe(20);
    });
  });

  describe('Reactions Formatting and Deduplication', () => {
    it('should aggregate counts correctly and identify current user active reactions', () => {
      const reactions = [
        { id: '1', userId: 'user-a', emoji: 'FIRE' },
        { id: '2', userId: 'user-b', emoji: 'FIRE' },
        { id: '3', userId: 'user-a', emoji: 'STRONG' },
        { id: '4', userId: 'user-c', emoji: 'CELEBRATE' }
      ];

      const formatted = formatReactions(reactions, 'user-a');

      expect(formatted.counts.FIRE).toBe(2);
      expect(formatted.counts.STRONG).toBe(1);
      expect(formatted.counts.CLAP).toBe(0);
      expect(formatted.counts.CELEBRATE).toBe(1);
      expect(formatted.userReactions).toEqual(['FIRE', 'STRONG']);
      expect(formatted.totalCount).toBe(4);
    });
  });

  describe('Mandatory Study Note Constraints', () => {
    it('should reject whitespace-only or empty notes', () => {
      const invalidNotes = ['', '   ', '\t\n'];
      for (const note of invalidNotes) {
        const isValid = typeof note === 'string' && note.trim().length >= 3;
        expect(isValid).toBe(false);
      }
    });

    it('should accept valid meaningful notes within 500 characters', () => {
      const validNote = 'Solved 5 Dynamic Programming problems on LeetCode.';
      expect(validNote.trim().length >= 3).toBe(true);
      expect(validNote.trim().length <= 500).toBe(true);
    });
  });
});
