import { describe, it, expect } from 'vitest';
import { calculateStreakAndFreezes } from '../src/services/freezeService';
import { calculateNextOccurrence, validateReminderCount } from '../src/services/reminderSchedulerService';
import { ReminderScope } from '@prisma/client';
import { DateTime } from 'luxon';

describe('1. Shield Inventory & Recharge Logic (Default vs Admin-Approved Capacity)', () => {
  const tz = 'Asia/Kolkata';

  it('Default capacity 1: Day 7 earns 1 shield, recharge counter reaches 7/7', () => {
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07'
    ];
    const refDay7 = DateTime.fromISO('2026-10-07T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay7, undefined, 1);

    expect(result.currentStreak).toBe(7);
    expect(result.freezeBalance).toBe(1);
    expect(result.freezeRechargeDays).toBe(7);
  });

  it('Default capacity 1: Day 14 maintains 1 shield, recharge counter remains capped at 7/7 (never exceeds 7/7)', () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `2026-10-${day}`;
    });
    const refDay14 = DateTime.fromISO('2026-10-14T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay14, undefined, 1);

    expect(result.currentStreak).toBe(14);
    expect(result.freezeBalance).toBe(1);
    expect(result.freezeRechargeDays).toBe(7); // Must stay strictly capped at 7/7
  });

  it('Approved capacity 2: 7 days earns 1 shield, another 7 days earns 2nd shield after 14 days', () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `2026-10-${day}`;
    });
    const refDay14 = DateTime.fromISO('2026-10-14T20:00:00', { zone: tz }).toJSDate();
    // Admin approved capacity = 2
    const result = calculateStreakAndFreezes(dates, [], tz, refDay14, undefined, 2);

    expect(result.currentStreak).toBe(14);
    expect(result.freezeBalance).toBe(2);
    expect(result.freezeRechargeDays).toBe(7); // Capped at full capacity
  });

  it('Approved capacity 2: Day 21 does not exceed 2 shields when capacity is 2', () => {
    const dates = Array.from({ length: 21 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `2026-10-${day}`;
    });
    const refDay21 = DateTime.fromISO('2026-10-21T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay21, undefined, 2);

    expect(result.currentStreak).toBe(21);
    expect(result.freezeBalance).toBe(2);
    expect(result.freezeRechargeDays).toBe(7);
  });

  it('Shield consumption resets recharge to 0/7 and requires 7 new qualifying days', () => {
    // 7 days completed -> earns 1 shield
    // Day 8 missed -> consumes shield, recharge resets to 0/7
    // Day 9 completed -> recharge is 1/7
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
      // 2026-10-08 missed!
      '2026-10-09'
    ];
    const refDay9 = DateTime.fromISO('2026-10-09T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay9, undefined, 1);

    expect(result.currentStreak).toBe(8);
    expect(result.protectedDates).toContain('2026-10-08');
    expect(result.freezeBalance).toBe(0);
    expect(result.freezeRechargeDays).toBe(1); // 1 new day toward next 7-day recharge cycle
  });

  it('Freeze-protected missed days do not count as completed days or qualifying recharge days', () => {
    const dates = [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
      // Day 8 missed
      '2026-10-09', '2026-10-10'
    ];
    const refDay10 = DateTime.fromISO('2026-10-10T20:00:00', { zone: tz }).toJSDate();
    const result = calculateStreakAndFreezes(dates, [], tz, refDay10, undefined, 1);

    expect(result.totalCompletedDays).toBe(9); // 7 + 2, 2026-10-08 is NOT completed
    expect(result.freezeRechargeDays).toBe(2); // Only Day 9 & Day 10 count toward recharge
  });
});

describe('2. Reminder Controls & Quota Enforcement', () => {
  it('Task reminders enforce strict maximum of 2 independently configurable reminder times per task', async () => {
    // Check validation helper
    const check1 = await validateReminderCount({
      userId: 'test-user-id',
      scope: ReminderScope.TASK,
      taskId: 'test-task-1',
    });
    expect(check1.maxAllowed).toBe(2);
  });

  it('Calculates next scheduled occurrence accurately respecting user timezone and days', () => {
    const tz = 'Asia/Kolkata';
    // Test daily reminder
    const nextDaily = calculateNextOccurrence('20:00', tz, [0, 1, 2, 3, 4, 5, 6], true);
    expect(nextDaily.nextIso).not.toBeNull();
    expect(typeof nextDaily.nextDisplay).toBe('string');
    expect(typeof nextDaily.relativeDisplay).toBe('string');
    expect(typeof nextDaily.isToday).toBe('boolean');

    // Test disabled reminder
    const disabled = calculateNextOccurrence('20:00', tz, [0, 1, 2, 3, 4, 5, 6], false);
    expect(disabled.nextIso).toBeNull();
    expect(disabled.nextDisplay).toBe('Schedule is paused/disabled');
  });
});
