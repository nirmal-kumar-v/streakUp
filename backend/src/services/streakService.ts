import { DateTime } from 'luxon';
import { getLocalDateString, getYesterdayDateString, isValidTimezone, DEFAULT_TIMEZONE } from './timezoneService';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  hasCompletedToday: boolean;
  lastCompletedDate: string | null;
  activeDatesCount: number;
}

/**
 * Pure calculation of current streak and longest streak from a list of unique local completion dates (YYYY-MM-DD).
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
    // Starting from today, count consecutive past days
    currentStreak = 1;
    let checkDate = now.minus({ days: 1 });
    while (dateSet.has(checkDate.toFormat('yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = checkDate.minus({ days: 1 });
    }
  } else if (dateSet.has(yesterdayStr)) {
    // Yesterday was completed and today is still in progress (not ended yet)
    // Streak is intact from yesterday, waiting for today's completion
    currentStreak = 1;
    let checkDate = now.minus({ days: 2 });
    while (dateSet.has(checkDate.toFormat('yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = checkDate.minus({ days: 1 });
    }
  } else {
    // Neither today nor yesterday was completed -> streak is broken
    currentStreak = 0;
  }

  // 2. Calculate Historical Longest Streak across all clusters
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: DateTime | null = null;

  for (const dateStr of sortedDatesAsc) {
    const currentDate = DateTime.fromISO(dateStr, { zone });
    if (!prevDate) {
      tempStreak = 1;
    } else {
      // Check if this date is exactly 1 day after prevDate
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

  // Current streak can never exceed longest streak
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
 * Recalculates and updates streaks for a given user in the database.
 */
export async function recalculateUserStreaks(
  prisma: any,
  userId: string,
  userTimezone?: string
): Promise<StreakResult> {
  // If timezone is not provided, fetch user's timezone from DB
  let tz = userTimezone;
  if (!tz) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    tz = user?.timezone || DEFAULT_TIMEZONE;
  }

  // Fetch all unique completion dates for this user
  const completions = await prisma.taskCompletion.findMany({
    where: { userId },
    select: { completionDate: true },
    distinct: ['completionDate']
  });

  const completionDates = completions.map((c: { completionDate: string }) => c.completionDate);
  const result = calculateStreaks(completionDates, tz);

  // Update user with recalculated streaks
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak
    }
  });

  return result;
}
