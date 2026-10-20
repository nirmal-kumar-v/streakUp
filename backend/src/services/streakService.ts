import { DateTime } from 'luxon';
import { getLocalDateString, getYesterdayDateString, isValidTimezone, DEFAULT_TIMEZONE } from './timezoneService';
import { calculateStreakAndFreezes, TimelineStreakResult } from './freezeService';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  hasCompletedToday: boolean;
  lastCompletedDate: string | null;
  activeDatesCount: number;
  freezeBalance?: number;
  freezeRechargeDays?: number;
  protectedDates?: string[];
}

/**
 * Pure calculation of current streak and longest streak from a list of unique local completion dates (YYYY-MM-DD).
 * Preserved for backwards compatibility and regression testing.
 */
export function calculateStreaks(
  completionDates: string[],
  timezone: string = DEFAULT_TIMEZONE,
  referenceDate?: Date
): StreakResult {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const now = referenceDate ? DateTime.fromJSDate(referenceDate).setZone(zone) : DateTime.now().setZone(zone);

  const todayStr = getLocalDateString(zone, now.toJSDate());
  const yesterdayStr = getYesterdayDateString(zone, now.toJSDate());

  // Deduplicate and filter valid dates
  const dateSet = new Set(completionDates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)));
  const sortedDatesDesc = Array.from(dateSet).sort().reverse();
  const sortedDatesAsc = Array.from(dateSet).sort();

  const activeDatesCount = dateSet.size;
  const lastCompletedDate = sortedDatesDesc.length > 0 ? sortedDatesDesc[0] : null;
  const hasCompletedToday = dateSet.has(todayStr);

  // 1. Calculate Current Streak
  let currentStreak = 0;

  if (hasCompletedToday) {
    currentStreak = 1;
    let checkDate = now.minus({ days: 1 });
    while (dateSet.has(checkDate.toFormat('yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = checkDate.minus({ days: 1 });
    }
  } else if (dateSet.has(yesterdayStr)) {
    currentStreak = 1;
    let checkDate = now.minus({ days: 2 });
    while (dateSet.has(checkDate.toFormat('yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = checkDate.minus({ days: 1 });
    }
  } else {
    currentStreak = 0;
  }

  // 2. Calculate Historical Longest Streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: DateTime | null = null;

  for (const dateStr of sortedDatesAsc) {
    const currentDate = DateTime.fromISO(dateStr, { zone });
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffInDays = Math.round(currentDate.diff(prevDate, 'days').days);
      if (diffInDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = currentDate;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    currentStreak,
    longestStreak,
    hasCompletedToday,
    lastCompletedDate,
    activeDatesCount
  };
}

/**
 * Recalculates and updates overall streaks and freezes for a given user in the database.
 */
export async function recalculateUserStreaks(
  prisma: any,
  userId: string,
  userTimezone?: string
): Promise<StreakResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, overallFreezeCapacity: true, longestStreak: true }
  });
  const tz = userTimezone || user?.timezone || DEFAULT_TIMEZONE;
  const maxCapacity = user?.overallFreezeCapacity || 1;

  // Fetch all unique completion dates for this user across all tasks
  const completions = await prisma.taskCompletion.findMany({
    where: { userId },
    select: { completionDate: true },
    distinct: ['completionDate']
  });

  const completionDates = completions.map((c: { completionDate: string }) => c.completionDate);

  // Fetch existing overall freeze logs
  const freezeLogs = await prisma.freezeLog.findMany({
    where: { userId, scope: 'OVERALL' },
    select: { protectedDate: true }
  });
  const protectedDates = freezeLogs.map((l: { protectedDate: string }) => l.protectedDate);

  // Calculate overall streak and freezes with approved capacity
  const freezeResult = calculateStreakAndFreezes(completionDates, protectedDates, tz, undefined, undefined, maxCapacity);

  // Save any newly consumed freeze dates
  if (freezeResult.newlyConsumedDates.length > 0) {
    for (const pDate of freezeResult.newlyConsumedDates) {
      await prisma.freezeLog.upsert({
        where: {
          userId_scopeKey_protectedDate: {
            userId,
            scopeKey: 'OVERALL',
            protectedDate: pDate
          }
        },
        create: {
          userId,
          scope: 'OVERALL',
          scopeKey: 'OVERALL',
          protectedDate: pDate
        },
        update: {}
      });
    }
  }

  const maxPossibleUserLongest = Math.max(freezeResult.totalCompletedDays, freezeResult.currentStreak);
  const effectiveLongestStreak = Math.min(
    Math.max(user?.longestStreak || 0, freezeResult.longestStreak, freezeResult.currentStreak),
    maxPossibleUserLongest
  );

  // Update user with recalculated streaks and freezes
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: freezeResult.currentStreak,
      longestStreak: effectiveLongestStreak,
      overallFreezeBalance: freezeResult.freezeBalance,
      overallFreezeRechargeDays: freezeResult.freezeRechargeDays,
      ...(freezeResult.newlyConsumedDates.length > 0 ? { lastOverallFreezeUsedAt: new Date() } : {})
    }
  });

  return {
    currentStreak: freezeResult.currentStreak,
    longestStreak: effectiveLongestStreak,
    hasCompletedToday: freezeResult.hasCompletedToday,
    lastCompletedDate: freezeResult.lastCompletedDate,
    activeDatesCount: freezeResult.totalCompletedDays,
    freezeBalance: freezeResult.freezeBalance,
    freezeRechargeDays: freezeResult.freezeRechargeDays,
    protectedDates: freezeResult.protectedDates
  };
}

/**
 * Recalculates and updates independent streaks and freezes for a specific task.
 */
export async function recalculateTaskStreaks(
  prisma: any,
  taskId: string,
  userId: string,
  userTimezone?: string
): Promise<TimelineStreakResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, recurrence: true, scheduledDays: true, freezeCapacity: true, longestStreak: true }
  });

  if (!task || task.recurrence === 'ONE_TIME') {
    return {
      currentStreak: 0,
      longestStreak: 0,
      freezeBalance: 0,
      freezeRechargeDays: 0,
      maxCapacity: 1,
      hasCompletedToday: false,
      isTodayProtected: false,
      totalCompletedDays: 0,
      lastCompletedDate: null,
      protectedDates: [],
      newlyConsumedDates: []
    };
  }

  let tz = userTimezone;
  if (!tz) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    tz = user?.timezone || DEFAULT_TIMEZONE;
  }

  const completions = await prisma.taskCompletion.findMany({
    where: { taskId },
    select: { completionDate: true }
  });
  const completionDates = completions.map((c: { completionDate: string }) => c.completionDate);

  const freezeLogs = await prisma.freezeLog.findMany({
    where: { taskId, scope: 'TASK' },
    select: { protectedDate: true }
  });
  const protectedDates = freezeLogs.map((l: { protectedDate: string }) => l.protectedDate);

  const taskCapacity = task.freezeCapacity || 1;

  const freezeResult = calculateStreakAndFreezes(
    completionDates,
    protectedDates,
    tz,
    undefined,
    task.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
    taskCapacity
  );

  if (freezeResult.newlyConsumedDates.length > 0) {
    for (const pDate of freezeResult.newlyConsumedDates) {
      await prisma.freezeLog.upsert({
        where: {
          userId_scopeKey_protectedDate: {
            userId,
            scopeKey: `TASK:${taskId}`,
            protectedDate: pDate
          }
        },
        create: {
          userId,
          taskId,
          scope: 'TASK',
          scopeKey: `TASK:${taskId}`,
          protectedDate: pDate
        },
        update: {}
      });
    }
  }

  const maxPossibleTaskLongest = Math.max(freezeResult.totalCompletedDays, freezeResult.currentStreak);
  const effectiveLongestStreak = Math.min(
    Math.max(task.longestStreak || 0, freezeResult.longestStreak, freezeResult.currentStreak),
    maxPossibleTaskLongest
  );

  await prisma.task.update({
    where: { id: taskId },
    data: {
      currentStreak: freezeResult.currentStreak,
      longestStreak: effectiveLongestStreak,
      freezeBalance: freezeResult.freezeBalance,
      freezeRechargeDays: freezeResult.freezeRechargeDays,
      ...(freezeResult.newlyConsumedDates.length > 0 ? { lastFreezeUsedAt: new Date() } : {})
    }
  });

  return {
    ...freezeResult,
    longestStreak: effectiveLongestStreak
  };
}

