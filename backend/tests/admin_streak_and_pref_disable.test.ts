import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../src/config/prisma';
import { ensureTaskStreakCurrent, recalculateTaskStreaks, recalculateUserStreaks } from '../src/services/streakService';
import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE, getLocalDateString } from '../src/services/timezoneService';

describe('Admin Task Streak Correction & Notification Preference Disabling', () => {
  const testUserId = 'test-user-streak-correct-1';
  const testTaskId = 'test-task-streak-correct-1';

  beforeEach(async () => {
    // Clean up test data
    await prisma.taskCompletion.deleteMany({ where: { userId: testUserId } });
    await prisma.task.deleteMany({ where: { userId: testUserId } });
    await prisma.notificationPreference.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    // Seed test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'teststreak@example.com',
        username: 'teststreakuser',
        normalizedUsername: 'teststreakuser',
        name: 'Streak Tester',
        passwordHash: 'dummy',
        timezone: 'Asia/Kolkata',
      },
    });

    // Seed test task
    await prisma.task.create({
      data: {
        id: testTaskId,
        userId: testUserId,
        title: 'Morning DSA Practice',
        recurrence: 'DAILY',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        status: 'ACTIVE',
        currentStreak: 0,
        longestStreak: 0,
      },
    });
  });

  it('preserves currentStreak when admin corrects task streak without resetting to 0 on inspection', async () => {
    const tz = 'Asia/Kolkata';
    const targetStreak = 7;
    const targetLongest = 10;

    // Simulate what adminController.correctStreaks does:
    const todayStr = getLocalDateString(tz);
    const isAlreadyCompletedToday = await prisma.taskCompletion.findFirst({
      where: { taskId: testTaskId, completionDate: todayStr },
      select: { id: true },
    });
    const startOffset = isAlreadyCompletedToday ? 0 : 1;

    for (let i = 0; i < targetStreak; i++) {
      const dt = DateTime.now().setZone(tz).minus({ days: i + startOffset });
      const dateStr = dt.toFormat('yyyy-MM-dd');
      await prisma.taskCompletion.upsert({
        where: {
          taskId_completionDate: {
            taskId: testTaskId,
            completionDate: dateStr,
          },
        },
        create: {
          userId: testUserId,
          taskId: testTaskId,
          completionDate: dateStr,
          completedAt: dt.toJSDate(),
        },
        update: {},
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id: testTaskId },
      data: {
        currentStreak: targetStreak,
        longestStreak: targetLongest,
      },
    });

    expect(updatedTask.currentStreak).toBe(7);
    expect(updatedTask.longestStreak).toBe(10);

    // Now test inspection (as performed by /api/friends/tasks or ensureTaskStreakCurrent)
    const fresh = await ensureTaskStreakCurrent(prisma, updatedTask, tz);
    expect(fresh.currentStreak).toBe(7);
    expect(fresh.longestStreak).toBe(10);

    // Verify DB was NOT wiped back to 0
    const dbTaskAfterInspect = await prisma.task.findUnique({ where: { id: testTaskId } });
    expect(dbTaskAfterInspect?.currentStreak).toBe(7);
    expect(dbTaskAfterInspect?.longestStreak).toBe(10);
  });

  it('does NOT affect user overall streak when task streak is corrected with applyToOverall = false', async () => {
    const tz = 'Asia/Kolkata';

    // Set initial user overall streak to 3
    await prisma.user.update({
      where: { id: testUserId },
      data: { currentStreak: 3, longestStreak: 5 },
    });

    // Admin corrects task streak to 25 days with applyToOverall = false
    const currentStreak = 25;
    const longestStreak = 25;
    const applyToOverall = false;

    // Simulate correctStreaks:
    const maxDaysToCreate = Math.min(currentStreak, 365);
    const completionsToInsert: any[] = [];
    for (let i = 0; i < maxDaysToCreate; i++) {
      const dt = DateTime.now().setZone(tz).minus({ days: i + 1 });
      const dateStr = dt.toFormat('yyyy-MM-dd');
      completionsToInsert.push({
        userId: testUserId,
        taskId: testTaskId,
        completionDate: dateStr,
        completedAt: dt.toJSDate(),
        studyNote: applyToOverall ? undefined : '[ADMIN_TASK_ONLY]',
      });
    }

    await prisma.taskCompletion.createMany({
      data: completionsToInsert,
      skipDuplicates: true,
    });

    await prisma.task.update({
      where: { id: testTaskId },
      data: { currentStreak, longestStreak },
    });

    // Task streak is 25
    const task = await prisma.task.findUnique({ where: { id: testTaskId } });
    expect(task?.currentStreak).toBe(25);

    // User overall streak before recalculate: still 3
    let user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.currentStreak).toBe(3);

    // Now recalculateUserStreaks runs "after sometime":
    const overallRes = await recalculateUserStreaks(prisma, testUserId, tz);
    expect(overallRes.currentStreak).not.toBe(25);

    // User overall streak was NOT affected and did not jump to 25
    user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.currentStreak).not.toBe(25);
  });

  it('allows user to disable email triggers down to 3, 2, 1, or 0 without quota error', async () => {
    // User starts with 4 active triggers
    await prisma.notificationPreference.create({
      data: {
        userId: testUserId,
        emailNotificationsEnabled: true,
        inAppNotificationsEnabled: true,
        overallStreakRemindersEmail: true,
        overallStreakRemindersInApp: true,
        taskRemindersEmail: false,
        taskRemindersInApp: true,
        friendOverallActivityAlerts: true,
        friendOverallActivityInApp: true,
        friendTaskActivityAlerts: true,
        friendTaskActivityInApp: true,
        friendOverallMilestones: false,
        friendOverallMilestonesInApp: true,
        friendTaskMilestones: false,
        friendTaskMilestonesInApp: true,
        myMilestonesEmail: false,
        myMilestonesInApp: true,
        freezeStatusNotifications: true,
        freezeStatusInApp: true,
      },
    });

    // 1. Disable friendTaskActivityAlerts -> should succeed and count becomes 3
    const p1 = await prisma.notificationPreference.update({
      where: { userId: testUserId },
      data: { friendTaskActivityAlerts: false },
    });
    expect(p1.friendTaskActivityAlerts).toBe(false);

    // 2. Disable friendOverallActivityAlerts -> should succeed and count becomes 2
    const p2 = await prisma.notificationPreference.update({
      where: { userId: testUserId },
      data: { friendOverallActivityAlerts: false },
    });
    expect(p2.friendOverallActivityAlerts).toBe(false);

    // 3. Re-enable myMilestonesEmail -> count becomes 3 (<= 4, allowed)
    const p3 = await prisma.notificationPreference.update({
      where: { userId: testUserId },
      data: { myMilestonesEmail: true },
    });
    expect(p3.myMilestonesEmail).toBe(true);
  });
});

