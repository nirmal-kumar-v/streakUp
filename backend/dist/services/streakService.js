"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStreaks = calculateStreaks;
exports.recalculateUserStreaks = recalculateUserStreaks;
exports.recalculateTaskStreaks = recalculateTaskStreaks;
exports.ensureUserStreakCurrent = ensureUserStreakCurrent;
exports.ensureTaskStreakCurrent = ensureTaskStreakCurrent;
exports.reconcileStaleStreaks = reconcileStaleStreaks;
const luxon_1 = require("luxon");
const prisma_1 = __importDefault(require("../config/prisma"));
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
        select: { timezone: true, overallFreezeCapacity: true, longestStreak: true, currentStreak: true, updatedAt: true, overallFreezeBalance: true, overallFreezeRechargeDays: true }
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
    let effectiveCurrentStreak = 0;
    if (options?.targetCurrentStreak !== undefined) {
        effectiveCurrentStreak = options.targetCurrentStreak;
    }
    else {
        effectiveCurrentStreak = freezeResult.currentStreak; // 0 when missed without freeze
    }
    const effectiveLongestStreak = Math.max(user?.longestStreak || 0, options?.targetLongestStreak || 0, freezeResult.longestStreak, effectiveCurrentStreak);
    // Update user with recalculated streaks and freezes only if values actually changed
    const needsUserUpdate = user?.currentStreak !== effectiveCurrentStreak ||
        user?.longestStreak !== effectiveLongestStreak ||
        user?.overallFreezeBalance !== freezeResult.freezeBalance ||
        user?.overallFreezeRechargeDays !== freezeResult.freezeRechargeDays ||
        freezeResult.newlyConsumedDates.length > 0;
    if (needsUserUpdate) {
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
    }
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
        select: { id: true, recurrence: true, scheduledDays: true, freezeCapacity: true, longestStreak: true, currentStreak: true, updatedAt: true, freezeBalance: true, freezeRechargeDays: true }
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
    let effectiveCurrentStreak = 0;
    if (options?.targetCurrentStreak !== undefined) {
        effectiveCurrentStreak = options.targetCurrentStreak;
    }
    else {
        effectiveCurrentStreak = freezeResult.currentStreak; // 0 when scheduled days missed without freeze
    }
    const effectiveLongestStreak = Math.max(task?.longestStreak || 0, options?.targetLongestStreak || 0, freezeResult.longestStreak, effectiveCurrentStreak);
    const needsTaskUpdate = task.currentStreak !== effectiveCurrentStreak ||
        task.longestStreak !== effectiveLongestStreak ||
        task.freezeBalance !== freezeResult.freezeBalance ||
        task.freezeRechargeDays !== freezeResult.freezeRechargeDays ||
        freezeResult.newlyConsumedDates.length > 0;
    if (needsTaskUpdate) {
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
    }
    return {
        ...freezeResult,
        currentStreak: effectiveCurrentStreak,
        longestStreak: effectiveLongestStreak
    };
}
/**
 * Fast check for user streak freshness.
 * If user has currentStreak > 0, verifies whether the streak is still alive.
 * If broken, recalculates and updates the database row.
 */
async function ensureUserStreakCurrent(prismaClient, user) {
    const currentStreak = user.currentStreak || 0;
    const longestStreak = user.longestStreak || 0;
    if (currentStreak === 0) {
        return { currentStreak: 0, longestStreak };
    }
    const tz = user.timezone || timezoneService_1.DEFAULT_TIMEZONE;
    const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
    const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
    // Fast check: did user complete anything today or yesterday?
    const recentCompletion = await prismaClient.taskCompletion.findFirst({
        where: {
            userId: user.id,
            completionDate: { in: [todayStr, yesterdayStr] }
        },
        select: { id: true }
    });
    if (recentCompletion) {
        return { currentStreak, longestStreak };
    }
    // Check if yesterday was protected by a freeze
    const recentFreeze = await prismaClient.freezeLog.findFirst({
        where: {
            userId: user.id,
            scope: 'OVERALL',
            protectedDate: yesterdayStr
        },
        select: { id: true }
    });
    if (recentFreeze) {
        return { currentStreak, longestStreak };
    }
    // No completion and no freeze for yesterday/today: streak is broken or needs freeze consumption
    const refreshed = await recalculateUserStreaks(prismaClient, user.id, tz);
    return {
        currentStreak: refreshed.currentStreak,
        longestStreak: refreshed.longestStreak
    };
}
/**
 * Fast check for task streak freshness.
 * If task has currentStreak > 0, verifies whether the streak is still alive.
 * If broken, recalculates and updates the database row.
 */
async function ensureTaskStreakCurrent(prismaClient, task, userTimezone) {
    const currentStreak = task.currentStreak || 0;
    const longestStreak = task.longestStreak || 0;
    if (currentStreak === 0 || task.recurrence === 'ONE_TIME') {
        return { currentStreak: 0, longestStreak };
    }
    const tz = userTimezone || timezoneService_1.DEFAULT_TIMEZONE;
    const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
    const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
    const recentCompletion = await prismaClient.taskCompletion.findFirst({
        where: {
            taskId: task.id,
            completionDate: { in: [todayStr, yesterdayStr] }
        },
        select: { id: true }
    });
    if (recentCompletion) {
        return { currentStreak, longestStreak };
    }
    const recentFreeze = await prismaClient.freezeLog.findFirst({
        where: {
            taskId: task.id,
            scope: 'TASK',
            protectedDate: yesterdayStr
        },
        select: { id: true }
    });
    if (recentFreeze) {
        return { currentStreak, longestStreak };
    }
    const refreshed = await recalculateTaskStreaks(prismaClient, task.id, task.userId, tz);
    return {
        currentStreak: refreshed.currentStreak,
        longestStreak: refreshed.longestStreak
    };
}
/**
 * Background / Cron sweeper that finds any inactive users and tasks with currentStreak > 0
 * who missed their schedule without freeze protection and resets their streaks to 0.
 */
async function reconcileStaleStreaks(prismaClient = prisma_1.default) {
    let updatedUsers = 0;
    let updatedTasks = 0;
    try {
        // 1. Reconcile Users with positive streak
        const usersWithStreak = await prismaClient.user.findMany({
            where: { currentStreak: { gt: 0 } },
            select: { id: true, timezone: true, currentStreak: true, longestStreak: true }
        });
        for (const u of usersWithStreak) {
            const tz = u.timezone || timezoneService_1.DEFAULT_TIMEZONE;
            const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
            const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
            const hasRecentActivity = await prismaClient.taskCompletion.findFirst({
                where: {
                    userId: u.id,
                    completionDate: { in: [todayStr, yesterdayStr] }
                },
                select: { id: true }
            });
            if (!hasRecentActivity) {
                const hasRecentFreeze = await prismaClient.freezeLog.findFirst({
                    where: {
                        userId: u.id,
                        scope: 'OVERALL',
                        protectedDate: yesterdayStr
                    },
                    select: { id: true }
                });
                if (!hasRecentFreeze) {
                    const res = await recalculateUserStreaks(prismaClient, u.id, tz);
                    if (res.currentStreak !== u.currentStreak) {
                        updatedUsers++;
                    }
                }
            }
        }
        // 2. Reconcile Active Tasks with positive streak
        const tasksWithStreak = await prismaClient.task.findMany({
            where: {
                status: 'ACTIVE',
                currentStreak: { gt: 0 },
                recurrence: { not: 'ONE_TIME' }
            },
            select: { id: true, userId: true, recurrence: true, scheduledDays: true, currentStreak: true, longestStreak: true }
        });
        for (const t of tasksWithStreak) {
            const user = await prismaClient.user.findUnique({
                where: { id: t.userId },
                select: { timezone: true }
            });
            const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
            const todayStr = (0, timezoneService_1.getLocalDateString)(tz);
            const yesterdayStr = (0, timezoneService_1.getYesterdayDateString)(tz);
            const hasRecentActivity = await prismaClient.taskCompletion.findFirst({
                where: {
                    taskId: t.id,
                    completionDate: { in: [todayStr, yesterdayStr] }
                },
                select: { id: true }
            });
            if (!hasRecentActivity) {
                const hasRecentFreeze = await prismaClient.freezeLog.findFirst({
                    where: {
                        taskId: t.id,
                        scope: 'TASK',
                        protectedDate: yesterdayStr
                    },
                    select: { id: true }
                });
                if (!hasRecentFreeze) {
                    const res = await recalculateTaskStreaks(prismaClient, t.id, t.userId, tz);
                    if (res.currentStreak !== t.currentStreak) {
                        updatedTasks++;
                    }
                }
            }
        }
    }
    catch (err) {
        console.error('Error during reconcileStaleStreaks:', err);
    }
    return { updatedUsers, updatedTasks };
}
