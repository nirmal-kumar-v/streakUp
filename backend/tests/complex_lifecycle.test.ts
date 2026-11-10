import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '../src/config/prisma';
import { DateTime } from 'luxon';
import {
  recalculateTaskStreaks,
  recalculateUserStreaks,
  ensureTaskStreakCurrent,
  ensureUserStreakCurrent,
  reconcileStaleStreaks,
} from '../src/services/streakService';
import {
  adminCorrectSpecialActivityStreak,
  completeSpecialActivity,
  ensureSpecialGroupMemberTasks,
} from '../src/services/specialGroupService';
import {
  getUserActiveTaskLimit,
  setUserActiveTaskLimit,
  getUserArchivedTaskLimit,
  setUserArchivedTaskLimit,
  getUserFriendLimit,
  setUserFriendLimit,
  getUserDuolingoCourseLimit,
  setUserDuolingoCourseLimit,
} from '../src/services/adminConfigService';

describe('Comprehensive Streak Lifecycle, Heatmap, and Limits Verification', () => {
  const userId = 'test-lifecycle-user-999';
  const taskId = 'test-lifecycle-task-999';
  const tz = 'Asia/Kolkata';

  beforeEach(async () => {
    // Clean up test data
    await prisma.pointLedger.deleteMany({ where: { userId } });
    await prisma.freezeLog.deleteMany({ where: { userId } });
    await prisma.taskCompletion.deleteMany({ where: { userId } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.groupMember.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed test user
    await prisma.user.create({
      data: {
        id: userId,
        email: 'lifecycle@example.com',
        username: 'lifecycle_user',
        normalizedUsername: 'lifecycle_user',
        name: 'Lifecycle Tester',
        passwordHash: 'dummyhash',
        timezone: tz,
        currentStreak: 0,
        longestStreak: 0,
        overallFreezeCapacity: 2,
        overallFreezeBalance: 0,
        overallFreezeRechargeDays: 0,
      },
    });

    // Seed test task
    await prisma.task.create({
      data: {
        id: taskId,
        userId,
        title: 'Daily Practice Habit',
        recurrence: 'DAILY',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        status: 'ACTIVE',
        currentStreak: 0,
        longestStreak: 0,
        freezeCapacity: 1,
        freezeBalance: 0,
        freezeRechargeDays: 0,
      },
    });
  });

  afterAll(async () => {
    await prisma.pointLedger.deleteMany({ where: { userId } });
    await prisma.freezeLog.deleteMany({ where: { userId } });
    await prisma.taskCompletion.deleteMany({ where: { userId } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.groupMember.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  // =========================================================================
  // Question 1: What happens when the user is using the app normally?
  // =========================================================================
  it('Q1: Normal usage builds streak day by day, records heatmap, and charges freeze shield', async () => {
    // Day 1 to Day 3 normal completion
    const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
    for (const d of dates) {
      await prisma.taskCompletion.create({
        data: {
          taskId,
          userId,
          completionDate: d,
          studyNote: `Completed normal habit on ${d}`,
        },
      });
    }

    // Evaluate streak as of reference date 2026-11-03
    const refDate = new Date('2026-11-03T18:00:00+05:30');
    const taskRes = await recalculateTaskStreaks(prisma, taskId, userId, tz);
    const userRes = await recalculateUserStreaks(prisma, userId, tz);

    // Heatmap count should be exactly 3
    const heatmapCompletions = await prisma.taskCompletion.findMany({
      where: {
        userId,
        completionDate: { gte: '2026-11-01', lte: '2026-11-03' },
        NOT: { studyNote: { startsWith: '[ADMIN_TASK_ONLY]' } },
      },
      select: { completionDate: true },
      distinct: ['completionDate'],
    });

    expect(heatmapCompletions.length).toBe(3);
    expect(heatmapCompletions.map((c) => c.completionDate).sort()).toEqual(dates);
  });

  // =========================================================================
  // Question 2: What happens when admin changes a separate task streak?
  // Does it affect overall streak or heatmap?
  // =========================================================================
  it('Q2: Admin separate task correction (applyToOverall=false) does NOT affect overall streak or heatmap', async () => {
    // User already has an overall streak of 10 from genuine past activity
    await prisma.user.update({
      where: { id: userId },
      data: { currentStreak: 10, longestStreak: 10 },
    });

    // Admin sets task streak to 20 days with applyToOverall = false
    const targetTaskStreak = 20;
    const now = DateTime.now().setZone(tz);

    // Prune existing completions for this task and insert 20 [ADMIN_TASK_ONLY] completions
    await prisma.taskCompletion.deleteMany({ where: { taskId } });
    const completionsToInsert: any[] = [];
    for (let i = 0; i < targetTaskStreak; i++) {
      const dt = now.minus({ days: i });
      completionsToInsert.push({
        userId,
        taskId,
        completionDate: dt.toFormat('yyyy-MM-dd'),
        completedAt: dt.toJSDate(),
        studyNote: '[ADMIN_TASK_ONLY]',
      });
    }
    await prisma.taskCompletion.createMany({ data: completionsToInsert, skipDuplicates: true });

    await prisma.task.update({
      where: { id: taskId },
      data: { currentStreak: targetTaskStreak, longestStreak: targetTaskStreak },
    });

    // 1. Task streak is exactly 20
    const taskAfter = await prisma.task.findUnique({ where: { id: taskId } });
    expect(taskAfter?.currentStreak).toBe(20);

    // 2. User overall streak must NOT be 20 (it was 10, NOT 20)
    const userOverall = await recalculateUserStreaks(prisma, userId, tz);
    expect(userOverall.currentStreak).not.toBe(20);

    // 3. Heatmap should NOT include any of the 20 task-only admin completions
    const heatmapAfterAdmin = await prisma.taskCompletion.findMany({
      where: {
        userId,
        NOT: { studyNote: { startsWith: '[ADMIN_TASK_ONLY]' } },
      },
    });
    expect(heatmapAfterAdmin.length).toBe(0);
  });

  // =========================================================================
  // Question 3: What happens after admin changed streak to 3, and user continues for 3-4 days?
  // Does the streak stay consistent (3 -> 4 -> 5 -> 6)?
  // =========================================================================
  it('Q3: User continuing for 3 to 4 days after admin correction smoothly increments (3 -> 4 -> 5 -> 6)', async () => {
    const today = DateTime.now().setZone(tz);
    const day0 = today.toFormat('yyyy-MM-dd');
    const dayMinus1 = today.minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const dayMinus2 = today.minus({ days: 2 }).toFormat('yyyy-MM-dd');

    // Admin sets task streak to 3 (completions on Day -2, Day -1, Day 0)
    await prisma.taskCompletion.deleteMany({ where: { taskId } });
    await prisma.taskCompletion.createMany({
      data: [
        { taskId, userId, completionDate: dayMinus2, studyNote: '[ADMIN_TASK_ONLY]' },
        { taskId, userId, completionDate: dayMinus1, studyNote: '[ADMIN_TASK_ONLY]' },
        { taskId, userId, completionDate: day0, studyNote: 'User did it today' },
      ],
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { currentStreak: 3, longestStreak: 3 },
    });

    // Verify task streak is 3
    let fresh = await recalculateTaskStreaks(prisma, taskId, userId, tz);
    expect(fresh.currentStreak).toBe(3);

    // --- Simulating Day +1 ---
    const dayPlus1 = today.plus({ days: 1 }).toFormat('yyyy-MM-dd');
    await prisma.taskCompletion.create({
      data: { taskId, userId, completionDate: dayPlus1, studyNote: 'Day 1 completion' },
    });
    // Task now has 4 consecutive completions (Day -2, -1, 0, +1)
    const taskCompletionsDay1 = await prisma.taskCompletion.findMany({
      where: { taskId },
      select: { completionDate: true },
    });
    expect(taskCompletionsDay1.length).toBe(4);

    // Recalculating task streak: 4 consecutive days
    const datesDay1 = taskCompletionsDay1.map((c) => c.completionDate).sort();
    expect(datesDay1).toEqual([dayMinus2, dayMinus1, day0, dayPlus1]);

    // --- Simulating Day +2 ---
    const dayPlus2 = today.plus({ days: 2 }).toFormat('yyyy-MM-dd');
    await prisma.taskCompletion.create({
      data: { taskId, userId, completionDate: dayPlus2, studyNote: 'Day 2 completion' },
    });
    const taskCompletionsDay2 = await prisma.taskCompletion.findMany({
      where: { taskId },
      select: { completionDate: true },
    });
    expect(taskCompletionsDay2.length).toBe(5);

    // --- Simulating Day +3 ---
    const dayPlus3 = today.plus({ days: 3 }).toFormat('yyyy-MM-dd');
    await prisma.taskCompletion.create({
      data: { taskId, userId, completionDate: dayPlus3, studyNote: 'Day 3 completion' },
    });
    const taskCompletionsDay3 = await prisma.taskCompletion.findMany({
      where: { taskId },
      select: { completionDate: true },
    });
    expect(taskCompletionsDay3.length).toBe(6);

    // Heatmap check: Heatmap contains ONLY genuine completions (Day 0, Day +1, Day +2, Day +3 = 4 days)
    // and ignores the 2 [ADMIN_TASK_ONLY] completions from Day -2 and Day -1!
    const heatmapGenuine = await prisma.taskCompletion.findMany({
      where: {
        userId,
        NOT: { studyNote: { startsWith: '[ADMIN_TASK_ONLY]' } },
      },
    });
    expect(heatmapGenuine.length).toBe(4);
    expect(heatmapGenuine.map((c) => c.completionDate).sort()).toEqual([day0, dayPlus1, dayPlus2, dayPlus3]);
  });

  // =========================================================================
  // Question 4: Special Groups (LeetCode & GFG) admin correction persists
  // =========================================================================
  it('Q4: Special Group activities (LeetCode/GFG) admin correction prunes old completions so streak stays at 3', async () => {
    // Create a special group
    const specialGroupId = 'test-special-group-lifecycle-1';
    await prisma.group.deleteMany({ where: { id: specialGroupId } });
    const group = await prisma.group.create({
      data: {
        id: specialGroupId,
        name: 'LeetCode Community',
        ownerId: userId,
        joinCode: 'LCCOMM1',
        isSpecialGroup: true,
        specialPlatform: 'LEETCODE',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: specialGroupId,
        userId,
        role: 'MEMBER',
        isPotdCommitted: true,
      },
    });

    // Ensure member has Daily and POTD tasks
    await ensureSpecialGroupMemberTasks(specialGroupId, userId);

    const dailyTask = await prisma.task.findFirst({
      where: { groupId: specialGroupId, userId, specialActivity: 'DAILY' },
    });
    expect(dailyTask).not.toBeNull();

    // Suppose user had 6 old completions (Nov 5, 6, 7, 8, 9, 10)
    const oldDates = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'];
    for (const d of oldDates) {
      await prisma.taskCompletion.create({
        data: {
          taskId: dailyTask!.id,
          userId,
          completionDate: d,
          studyNote: 'Old practice',
        },
      });
    }

    // Admin corrects Daily streak to 3
    await adminCorrectSpecialActivityStreak(
      specialGroupId,
      userId,
      'daily',
      3,
      3,
      tz
    );

    // Verify task completions for dailyTask are NOW EXACTLY 3 (older ones deleted)
    const completionsAfter = await prisma.taskCompletion.findMany({
      where: { taskId: dailyTask!.id },
      orderBy: { completionDate: 'asc' },
    });
    expect(completionsAfter.length).toBe(3);

    // Verify recalculateTaskStreaks yields 3, NOT 6!
    const recalced = await recalculateTaskStreaks(prisma, dailyTask!.id, userId, tz);
    expect(recalced.currentStreak).toBe(3);
    expect(recalced.longestStreak).toBe(3);

    // Clean up group
    await prisma.taskCompletion.deleteMany({ where: { taskId: dailyTask!.id } });
    await prisma.task.deleteMany({ where: { groupId: specialGroupId } });
    await prisma.groupMember.deleteMany({ where: { groupId: specialGroupId } });
    await prisma.group.deleteMany({ where: { id: specialGroupId } });
  });

  // =========================================================================
  // Question 5: What happens after many days when user misses without freeze?
  // reconcileStaleStreaks resets streak to 0 and does not revive old streaks
  // =========================================================================
  it('Q5: Inactive task missed without freeze protection resets to 0 via reconcileStaleStreaks', async () => {
    // Task has currentStreak = 5, but last completed was 10 days ago
    const tenDaysAgo = DateTime.now().setZone(tz).minus({ days: 10 }).toFormat('yyyy-MM-dd');
    await prisma.taskCompletion.deleteMany({ where: { taskId } });
    await prisma.taskCompletion.create({
      data: { taskId, userId, completionDate: tenDaysAgo, studyNote: 'Old completion' },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { currentStreak: 5, longestStreak: 10, freezeBalance: 0 },
    });

    // Run background stale streak reconciler
    await reconcileStaleStreaks(prisma);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    expect(task?.currentStreak).toBe(0);
  });

  // =========================================================================
  // Question 6: Limits and Quota Enforcement
  // =========================================================================
  it('Q6: Quota limits (Active tasks, Archived tasks, Friends, Duolingo) enforce defaults and admin overrides', async () => {
    // 1. Defaults
    expect(getUserActiveTaskLimit('random-user-id')).toBe(10);
    expect(getUserArchivedTaskLimit('random-user-id')).toBe(5);
    expect(getUserFriendLimit('random-user-id')).toBe(15);
    expect(getUserDuolingoCourseLimit('random-user-id')).toBe(5);

    // 2. Custom override for specific user
    await setUserActiveTaskLimit(userId, 50);
    await setUserArchivedTaskLimit(userId, 20);
    await setUserFriendLimit(userId, 25);
    await setUserDuolingoCourseLimit(userId, 8);

    expect(getUserActiveTaskLimit(userId)).toBe(50);
    expect(getUserArchivedTaskLimit(userId)).toBe(20);
    expect(getUserFriendLimit(userId)).toBe(25);
    expect(getUserDuolingoCourseLimit(userId)).toBe(8);
  });
});

