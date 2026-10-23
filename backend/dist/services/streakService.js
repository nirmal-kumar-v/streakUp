"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStreaks = calculateStreaks;
exports.recalculateUserStreaks = recalculateUserStreaks;
exports.recalculateTaskStreaks = recalculateTaskStreaks;
const luxon_1 = require("luxon");
const timezoneService_1 = require("./timezoneService");
const freezeService_1 = require("./freezeService");
/**
 * Pure calculation of current streak and longest streak from a list of unique local completion dates (YYYY-MM-DD).
 * Preserved for backwards compatibility and regression testing.
 */
function calculateStreaks(completionDates, timezone = timezoneService_1.DEFAULT_TIMEZONE, referenceDate) {
    const zone = (0, timezoneService_1.isValidTimezone)(timezone) ? timezone : timezoneService_1.DEFAULT_TIMEZONE;
    const now = referenceDate ? luxon_1.DateTime.fromJSDate(referenceDate).setZone(zone) : luxon_1.DateTime.now().setZone(zone);
    const todayStr = (0, timezoneService_1.getLocalDateString)(zone, now.toJSDate());
    const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(zone, now.toJSDate());
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
    }
    else if (dateSet.has(yesterdayStr)) {
        currentStreak = 1;
        let checkDate = now.minus({ days: 2 });
        while (dateSet.has(checkDate.toFormat('yyyy-MM-dd'))) {
            currentStreak++;
            checkDate = checkDate.minus({ days: 1 });
        }
    }
    else {
        currentStreak = 0;
    }
    // 2. Calculate Historical Longest Streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;
    for (const dateStr of sortedDatesAsc) {
        const currentDate = luxon_1.DateTime.fromISO(dateStr, { zone });
        if (!prevDate) {
            tempStreak = 1;
        }
        else {
            const diffInDays = Math.round(currentDate.diff(prevDate, 'days').days);
            if (diffInDays === 1) {
                tempStreak++;
            }
            else {
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
async function recalculateUserStreaks(prisma, userId, userTimezone, options) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true, overallFreezeCapacity: true, longestStreak: true, currentStreak: true, updatedAt: true }
    });
    const tz = userTimezone || user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
    const maxCapacity = user?.overallFreezeCapacity || 1;
    // Fetch all unique completion dates for this user across all tasks
    const completions = await prisma.taskCompletion.findMany({
        where: { userId },
        select: { completionDate: true },
        distinct: ['completionDate']
    });
    const completionDates = completions.map((c) => c.completionDate);
    // Fetch existing overall freeze logs
    const freezeLogs = await prisma.freezeLog.findMany({
        where: { userId, scope: 'OVERALL' },
        select: { protectedDate: true }
    });
    const protectedDates = freezeLogs.map((l) => l.protectedDate);
    // Calculate overall streak and freezes with approved capacity
    const freezeResult = (0, freezeService_1.calculateStreakAndFreezes)(completionDates, protectedDates, tz, undefined, undefined, maxCapacity);
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
    const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
    const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
    const isYesterdayActive = completionDates.includes(yesterdayStr) || freezeResult.protectedDates.includes(yesterdayStr);
    const isTodayActive = freezeResult.hasCompletedToday || freezeResult.isTodayProtected;
    const userUpdatedLocalDate = user?.updatedAt ? (0, timezoneService_1.getLocalDateString)(tz, new Date(user.updatedAt)) : null;
    const wasRecentlyUpdated = userUpdatedLocalDate === todayStr || userUpdatedLocalDate === yesterdayStr;
    const isStreakIntact = isYesterdayActive || isTodayActive || wasRecentlyUpdated;
    let effectiveCurrentStreak = 0;
    if (options?.targetCurrentStreak !== undefined) {
        effectiveCurrentStreak = Math.max(freezeResult.currentStreak, options.targetCurrentStreak);
    }
    else if (isStreakIntact) {
        effectiveCurrentStreak = Math.max(freezeResult.currentStreak, user?.currentStreak || 0);
    }
    else {
        effectiveCurrentStreak = freezeResult.currentStreak; // 0 when missed without freeze
    }
    const effectiveLongestStreak = Math.max(user?.longestStreak || 0, options?.targetLongestStreak || 0, freezeResult.longestStreak, effectiveCurrentStreak, user?.currentStreak || 0);
    // Update user with recalculated streaks and freezes
    await prisma.user.update({
        where: { id: userId },
        data: {
            currentStreak: effectiveCurrentStreak,
            longestStreak: effectiveLongestStreak,
            overallFreezeBalance: freezeResult.freezeBalance,
            overallFreezeRechargeDays: freezeResult.freezeRechargeDays,
            ...(freezeResult.newlyConsumedDates.length > 0 ? { lastOverallFreezeUsedAt: new Date() } : {})
        }
    });
    return {
        currentStreak: effectiveCurrentStreak,
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
async function recalculateTaskStreaks(prisma, taskId, userId, userTimezone, options) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, recurrence: true, scheduledDays: true, freezeCapacity: true, longestStreak: true, currentStreak: true, updatedAt: true }
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
        tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
    }
    const completions = await prisma.taskCompletion.findMany({
        where: { taskId },
        select: { completionDate: true }
    });
    const completionDates = completions.map((c) => c.completionDate);
    const freezeLogs = await prisma.freezeLog.findMany({
        where: { taskId, scope: 'TASK' },
        select: { protectedDate: true }
    });
    const protectedDates = freezeLogs.map((l) => l.protectedDate);
    const taskCapacity = task.freezeCapacity || 1;
    const freezeResult = (0, freezeService_1.calculateStreakAndFreezes)(completionDates, protectedDates, tz, undefined, task.scheduledDays || [0, 1, 2, 3, 4, 5, 6], taskCapacity);
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
    const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
    const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
    const taskUpdatedLocalDate = task?.updatedAt ? (0, timezoneService_1.getLocalDateString)(tz, new Date(task.updatedAt)) : null;
    const wasTaskRecentlyUpdated = taskUpdatedLocalDate === todayStr || taskUpdatedLocalDate === yesterdayStr;
    const isTaskStreakIntact = freezeResult.currentStreak > 0 || wasTaskRecentlyUpdated;
    let effectiveCurrentStreak = 0;
    if (options?.targetCurrentStreak !== undefined) {
        effectiveCurrentStreak = Math.max(freezeResult.currentStreak, options.targetCurrentStreak);
    }
    else if (isTaskStreakIntact) {
        effectiveCurrentStreak = Math.max(freezeResult.currentStreak, task?.currentStreak || 0);
    }
    else {
        effectiveCurrentStreak = freezeResult.currentStreak; // 0 when scheduled days missed without freeze
    }
    const effectiveLongestStreak = Math.max(task?.longestStreak || 0, options?.targetLongestStreak || 0, freezeResult.longestStreak, effectiveCurrentStreak, task?.currentStreak || 0);
    await prisma.task.update({
        where: { id: taskId },
        data: {
            currentStreak: effectiveCurrentStreak,
            longestStreak: effectiveLongestStreak,
            freezeBalance: freezeResult.freezeBalance,
            freezeRechargeDays: freezeResult.freezeRechargeDays,
            ...(freezeResult.newlyConsumedDates.length > 0 ? { lastFreezeUsedAt: new Date() } : {})
        }
    });
    return {
        ...freezeResult,
        currentStreak: effectiveCurrentStreak,
        longestStreak: effectiveLongestStreak
    };
}
