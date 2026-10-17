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
});
