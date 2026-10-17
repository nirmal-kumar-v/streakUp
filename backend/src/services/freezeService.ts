import { DateTime } from 'luxon';
import { getLocalDateString, getYesterdayDateString, DEFAULT_TIMEZONE, isValidTimezone } from './timezoneService';

export interface TimelineStreakResult {
  currentStreak: number;
  longestStreak: number;
  freezeBalance: number; // 0 or 1
  freezeRechargeDays: number; // 0 to 7
  hasCompletedToday: boolean;
  isTodayProtected: boolean;
  totalCompletedDays: number;
  lastCompletedDate: string | null;
  protectedDates: string[]; // dates protected by freeze
  newlyConsumedDates: string[]; // dates that were missed and auto-protected during this calculation
}

/**
 * Pure timeline evaluation of streak, freeze balance, and recharge progress.
 * Evaluates day-by-day from the first recorded date (or start of streak) up to today.
 */
export function calculateStreakAndFreezes(
  completedDatesList: string[],
  existingProtectedDates: string[] = [],
  timezone: string = DEFAULT_TIMEZONE,
  referenceDate?: Date,
  scheduledDays?: number[] // Array of 0..6 (0=Sun, 1=Mon, ..., 6=Sat)
): TimelineStreakResult {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const now = referenceDate ? DateTime.fromJSDate(referenceDate).setZone(zone) : DateTime.now().setZone(zone);

  const todayStr = getLocalDateString(zone, now.toJSDate());
  const yesterdayStr = getYesterdayDateString(zone, now.toJSDate());

  const completedSet = new Set(completedDatesList.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  const protectedSet = new Set(existingProtectedDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  const newlyConsumedDates: string[] = [];

  const totalCompletedDays = completedSet.size;
  const sortedCompleted = Array.from(completedSet).sort();
  const lastCompletedDate = sortedCompleted.length > 0 ? sortedCompleted[sortedCompleted.length - 1] : null;
  const hasCompletedToday = completedSet.has(todayStr);

  if (completedSet.size === 0 && protectedSet.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      freezeBalance: 0,
      freezeRechargeDays: 0,
      hasCompletedToday: false,
      isTodayProtected: false,
      totalCompletedDays: 0,
      lastCompletedDate: null,
      protectedDates: [],
      newlyConsumedDates: []
    };
  }

  // Find the earliest date to begin timeline simulation
  const allKnownDates = [...Array.from(completedSet), ...Array.from(protectedSet)].sort();
  const firstDateStr = allKnownDates[0];
  let simDate = DateTime.fromISO(firstDateStr, { zone });
  const todayDate = DateTime.fromISO(todayStr, { zone });

  let currentStreak = 0;
  let longestStreak = 0;
  let freezeBalance = 0;
  let freezeRechargeDays = 0;
  let hasEverConsumedFreeze = false;

  // Simulate day by day from firstDate up to yesterday (today is handled specially)
  while (simDate < todayDate) {
    const curDateStr = simDate.toFormat('yyyy-MM-dd');
    const dayOfWeek = simDate.weekday % 7; // 0=Sunday, 1=Monday, ..., 6=Saturday
    const isScheduledDay = !scheduledDays || scheduledDays.length === 0 || scheduledDays.includes(dayOfWeek);

    if (completedSet.has(curDateStr)) {
      // Completed day (counts whether scheduled or not)
      currentStreak += 1;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }

      // Freeze earning / recharge logic
      if (freezeBalance === 0) {
        freezeRechargeDays += 1;
        if (freezeRechargeDays >= 7) {
          freezeBalance = 1;
          freezeRechargeDays = 7;
        }
      }
    } else if (protectedSet.has(curDateStr)) {
      // Already recorded as protected day
      // Streak continuity is preserved without incrementing currentStreak
      // Protected day does NOT count toward recharge days
      // Freeze was consumed on this day
      freezeBalance = 0;
      freezeRechargeDays = 0;
      hasEverConsumedFreeze = true;
    } else if (isScheduledDay) {
      // Scheduled day that was MISSED!
      if (currentStreak > 0 && freezeBalance === 1) {
        // We have an available freeze! Protect this missed day
        freezeBalance = 0;
        freezeRechargeDays = 0;
        hasEverConsumedFreeze = true;
        protectedSet.add(curDateStr);
        newlyConsumedDates.push(curDateStr);
        // Streak stays intact! (does not increment)
      } else {
        // No freeze available -> Streak breaks
        currentStreak = 0;
        freezeBalance = 0;
        freezeRechargeDays = 0;
      }
    } else {
      // Unscheduled day not completed:
      // Streak does NOT break, and freeze is NOT consumed.
      // Streak continuity is preserved.
    }

    simDate = simDate.plus({ days: 1 });
  }

  // Now process Today (todayDate)
  const isTodayProtected = protectedSet.has(todayStr);

  if (hasCompletedToday) {
    currentStreak += 1;
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    if (freezeBalance === 0) {
      freezeRechargeDays += 1;
      if (freezeRechargeDays >= 7) {
        freezeBalance = 1;
        freezeRechargeDays = 7;
      }
    }
  } else if (isTodayProtected) {
    // Today was already protected
    freezeBalance = 0;
    freezeRechargeDays = 0;
  } else {
    // Today is in progress (pending).
    // A pending task/day is NOT missed before the day ends.
    // So currentStreak remains what was accumulated through yesterday.
  }

  // Cap freeze recharge days display
  const finalRechargeDays = freezeBalance === 1 ? 7 : Math.min(6, freezeRechargeDays);

  return {
    currentStreak,
    longestStreak,
    freezeBalance,
    freezeRechargeDays: finalRechargeDays,
    hasCompletedToday,
    isTodayProtected,
    totalCompletedDays,
    lastCompletedDate,
    protectedDates: Array.from(protectedSet).sort(),
    newlyConsumedDates
  };
}
