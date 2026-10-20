import { DateTime } from 'luxon';
import { PrismaClient } from '@prisma/client';
import { getLocalDateString, getYesterdayDateString, DEFAULT_TIMEZONE, isValidTimezone } from './timezoneService';
import { isLinkedInName } from './linkedInGameService';

/**
 * Returns day of week for a given local date string 'YYYY-MM-DD'
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function getDayOfWeekFromDateString(dateStr: string, timezone: string = DEFAULT_TIMEZONE): number {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const dt = DateTime.fromISO(dateStr, { zone });
  return dt.weekday % 7; // Luxon 1 (Mon)..7 (Sun) -> 1..6, 0
}

/**
 * Award +5 points for completing a scheduled habit on an eligible scheduled day.
 * Idempotent: upserts into PointLedger and updates cached User.points.
 */
export async function awardCompletionPoints(
  prisma: any,
  userId: string,
  taskId: string,
  completionDateStr: string,
  scheduledDays: number[] = [0, 1, 2, 3, 4, 5, 6],
  timezone: string = DEFAULT_TIMEZONE
): Promise<{ pointsAwarded: number; newTotalPoints: number }> {
  const dayOfWeek = getDayOfWeekFromDateString(completionDateStr, timezone);
  const isScheduled =
    !scheduledDays ||
    scheduledDays.length === 0 ||
    scheduledDays.includes(dayOfWeek);

  if (!isScheduled) {
    // Unscheduled completion: recorded for streak/history, but no scheduled points awarded
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true }
    });
    return { pointsAwarded: 0, newTotalPoints: user?.points || 0 };
  }

  // Check if completion points were already awarded for this habit and date
  const existingLedger = await prisma.pointLedger.findUnique({
    where: {
      userId_taskId_date_reason: {
        userId,
        taskId,
        date: completionDateStr,
        reason: 'COMPLETION'
      }
    }
  });

  if (existingLedger) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true }
    });
    return { pointsAwarded: 0, newTotalPoints: user?.points || 0 };
  }

  // Insert ledger entry and recompute user's total points atomically
  await prisma.$transaction(async (tx: any) => {
    // If a MISSED_SCHEDULED penalty was previously recorded for this date & task, remove it
    await tx.pointLedger.deleteMany({
      where: {
        userId,
        taskId,
        date: completionDateStr,
        reason: 'MISSED_SCHEDULED'
      }
    });

    await tx.pointLedger.upsert({
      where: {
        userId_taskId_date_reason: {
          userId,
          taskId,
          date: completionDateStr,
          reason: 'COMPLETION'
        }
      },
      create: {
        userId,
        taskId,
        date: completionDateStr,
        points: 5,
        reason: 'COMPLETION'
      },
      update: {}
    });

    // Recompute cached total points from ledger
    const aggregate = await tx.pointLedger.aggregate({
      where: { userId },
      _sum: { points: true }
    });
    const totalPoints = aggregate._sum.points || 0;

    await tx.user.update({
      where: { id: userId },
      data: { points: totalPoints }
    });
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true }
  });

  return { pointsAwarded: 5, newTotalPoints: updatedUser?.points || 0 };
}

/**
 * Reconciles missed scheduled habits for a user and applies -5 points per missed scheduled instance.
 * Evaluates past dates (from habit creation date up to yesterday; today is not considered missed).
 */
export async function reconcileMissedPointsForUser(
  prisma: any,
  userId: string,
  userTimezone?: string
): Promise<{ missedCount: number; newTotalPoints: number }> {
  let tz: string = userTimezone || '';
  if (!tz) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    tz = user?.timezone || DEFAULT_TIMEZONE;
  }
  const zone: string = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;

  const todayStr = getLocalDateString(zone);
  const yesterdayStr = getYesterdayDateString(zone);

  // Fetch all active daily personal tasks of the user (group tasks do not incur points penalties)
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      recurrence: 'DAILY',
      status: 'ACTIVE',
      groupId: null,
      isGroupTask: false
    },
    select: {
      id: true,
      createdAt: true,
      scheduledDays: true
    }
  });

  if (tasks.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true }
    });
    return { missedCount: 0, newTotalPoints: user?.points || 0 };
  }

  // Fetch all existing completions for this user
  const allCompletions = await prisma.taskCompletion.findMany({
    where: { userId },
    select: { taskId: true, completionDate: true }
  });
  const completionMap = new Set(allCompletions.map((c: { taskId: string; completionDate: string }) => `${c.taskId}:${c.completionDate}`));

  // Fetch all existing ledger records to avoid duplicate penalties
  const allLedgers = await prisma.pointLedger.findMany({
    where: { userId },
    select: { taskId: true, date: true, reason: true }
  });
  const ledgerMap = new Set(allLedgers.map((l: { taskId: string | null; date: string; reason: string }) => `${l.taskId}:${l.date}:${l.reason}`));

  const newMissedLedgers: Array<{
    userId: string;
    taskId: string;
    date: string;
    points: number;
    reason: string;
  }> = [];

  const nowDt = DateTime.now().setZone(zone);
  const yesterdayDt = nowDt.minus({ days: 1 });

  for (const task of tasks) {
    const taskCreatedDateStr = getLocalDateString(zone || DEFAULT_TIMEZONE, task.createdAt);
    let checkDt = DateTime.fromISO(taskCreatedDateStr, { zone });

    // Limit evaluation window to at most 60 days back to keep query performant
    const earliestWindowDt = yesterdayDt.minus({ days: 60 });
    if (checkDt < earliestWindowDt) {
      checkDt = earliestWindowDt;
    }

    while (checkDt <= yesterdayDt) {
      const curDateStr = checkDt.toFormat('yyyy-MM-dd');
      const dayOfWeek = checkDt.weekday % 7;
      const scheduledDays = task.scheduledDays || [0, 1, 2, 3, 4, 5, 6];

      if (scheduledDays.includes(dayOfWeek)) {
        const completionKey = `${task.id}:${curDateStr}`;
        const hasCompleted = completionMap.has(completionKey);

        if (!hasCompleted) {
          const missedKey = `${task.id}:${curDateStr}:MISSED_SCHEDULED`;
          if (!ledgerMap.has(missedKey)) {
            newMissedLedgers.push({
              userId,
              taskId: task.id,
              date: curDateStr,
              points: -2,
              reason: 'MISSED_SCHEDULED'
            });
            ledgerMap.add(missedKey);
          }
        }
      }

      checkDt = checkDt.plus({ days: 1 });
    }
  }

  if (newMissedLedgers.length > 0) {
    await prisma.$transaction(async (tx: any) => {
      for (const item of newMissedLedgers) {
        await tx.pointLedger.upsert({
          where: {
            userId_taskId_date_reason: {
              userId: item.userId,
              taskId: item.taskId,
              date: item.date,
              reason: item.reason
            }
          },
          create: item,
          update: {}
        });
      }

      const aggregate = await tx.pointLedger.aggregate({
        where: { userId },
        _sum: { points: true }
      });
      const totalPoints = aggregate._sum.points || 0;

      await tx.user.update({
        where: { id: userId },
        data: { points: totalPoints }
      });
    });
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true }
  });

  return {
    missedCount: newMissedLedgers.length,
    newTotalPoints: updatedUser?.points || 0
  };
}

/**
 * Retrieves detailed points statistics and audit breakdown for a user.
 */
export async function getUserPointsStats(prisma: any, userId: string) {
  const [aggregateTotal, completedCount, missedCount] = await Promise.all([
    prisma.pointLedger.aggregate({
      where: { userId },
      _sum: { points: true }
    }),
    prisma.pointLedger.count({
      where: { userId, points: { gt: 0 } }
    }),
    prisma.pointLedger.count({
      where: { userId, points: { lt: 0 } }
    })
  ]);
  const totalPoints = aggregateTotal._sum.points || 0;

  return {
    totalPoints,
    completedCount,
    missedCount,
    netCompletedPoints: completedCount * 5,
    netMissedPoints: missedCount * -2
  };
}
