import { describe, it, expect } from 'vitest';
import { calculateStreakAndFreezes } from '../src/services/freezeService';
import { DateTime } from 'luxon';

describe('Strict Freeze and Independent Streak Engine', () => {
  const tz = 'Asia/Kolkata';
  // Use fixed reference date: Wednesday 2026-10-15 14:00:00 IST
  const refDate = DateTime.fromISO('2026-10-15T14:00:00', { zone: tz }).toJSDate();

  it('earns 1 freeze after 7 consecutive qualifying completed days', () => {
    // Days 1 to 7: 2026-10-01 to 2026-10-07
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07'
    ];
    // Ref: 2026-10-07 (day 7 completed)
    const refDay7 = DateTime.fromISO('2026-10-07T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay7);
    expect(result.currentStreak).toBe(7);
    expect(result.freezeBalance).toBe(1);
    expect(result.freezeRechargeDays).toBe(7);
  });

  it('maximum one freeze: maintaining 14 days does NOT accumulate 2 freezes', () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `2026-10-${day}`;
    });
    // Ref: 2026-10-14 (day 14)
    const refDay14 = DateTime.fromISO('2026-10-14T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay14);
    expect(result.currentStreak).toBe(14);
    expect(result.freezeBalance).toBe(1); // Capped at exactly 1
  });

  it('Section 7D: exact example - 7 days complete, 1 day missed protected by freeze, recharge begins', () => {
    // Day 1 to 7: 2026-10-01 to 2026-10-07 (completed)
    // Day 8: 2026-10-08 (missed, protected by freeze!)
    // Day 9: 2026-10-09 (completed, streak continues to 8, recharge 1/7)
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
      // 2026-10-08 missed!
      '2026-10-09'
    ];
    // On Day 9:
    const refDay9 = DateTime.fromISO('2026-10-09T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay9);

    // Streak should be 8 (7 from before + 1 from Day 9)
    expect(result.currentStreak).toBe(8);
    // Day 8 was auto-protected by consuming the freeze
    expect(result.protectedDates).toContain('2026-10-08');
    // Freeze was consumed so balance is 0
    expect(result.freezeBalance).toBe(0);
    // Day 9 is 1 qualifying recharge day
    expect(result.freezeRechargeDays).toBe(1);
    // Total completed days is 8 (protected day does NOT count as completed)
    expect(result.totalCompletedDays).toBe(8);
  });

  it('Section 7E: missing another day before recharge completes breaks streak', () => {
    // Days 1 to 7: completed (earns freeze)
    // Day 8: missed (freeze used, recharge = 0/7)
    // Day 9: completed (recharge = 1/7, streak = 8)
    // Day 10: missed (no freeze available -> streak breaks to 0!)
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
      '2026-10-09'
    ];
    // Ref: Day 11 (2026-10-11)
    const refDay11 = DateTime.fromISO('2026-10-11T12:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, ['2026-10-08'], tz, refDay11);

    // Current streak should be broken to 0
    expect(result.currentStreak).toBe(0);
    // Historical longest streak preserved as 8
    expect(result.longestStreak).toBe(8);
    expect(result.freezeBalance).toBe(0);
  });

  it('Section 7D complete: completing 7 new qualifying days after freeze use recharges freeze', () => {
    // Days 1-7 (completed, earned freeze)
    // Day 8 (missed, protected)
    // Days 9-15 (7 new completed days: 2026-10-09 to 2026-10-15)
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
      // Day 8 missed (protected)
      '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12',
      '2026-10-13', '2026-10-14', '2026-10-15'
    ];
    const refDay15 = DateTime.fromISO('2026-10-15T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, ['2026-10-08'], tz, refDay15);

    // Streak = 14
    expect(result.currentStreak).toBe(14);
    // Freeze recharged to 1!
    expect(result.freezeBalance).toBe(1);
    expect(result.freezeRechargeDays).toBe(7);
  });

  it('pending task today does not break the streak before day ends', () => {
    // Yesterday completed (2026-10-14), today (2026-10-15) pending
    const dates = ['2026-10-14'];
    const result = calculateStreakAndFreezes(dates, [], tz, refDate);
    expect(result.hasCompletedToday).toBe(false);
    expect(result.currentStreak).toBe(1); // Intact from yesterday
  });
});
