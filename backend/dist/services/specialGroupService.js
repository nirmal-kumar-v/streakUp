"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSpecialGroupMemberTasks = ensureSpecialGroupMemberTasks;
exports.getSpecialGroupActivitiesForMember = getSpecialGroupActivitiesForMember;
exports.completeSpecialActivity = completeSpecialActivity;
exports.uncompleteSpecialActivity = uncompleteSpecialActivity;
exports.adminCorrectSpecialActivityStreak = adminCorrectSpecialActivityStreak;
exports.adminGrantSpecialActivityDate = adminGrantSpecialActivityDate;
const prisma_1 = __importDefault(require("../config/prisma"));
const specialGroupRegistry_1 = require("./specialGroupRegistry");
const streakService_1 = require("./streakService");
const timezoneService_1 = require("./timezoneService");
/**
 * Ensures that a member has all required special group tasks (Daily and POTD).
 */
async function ensureSpecialGroupMemberTasks(groupId, userId) {
    const group = await prisma_1.default.group.findUnique({
        where: { id: groupId },
        select: {
            id: true,
            name: true,
            scheduledDays: true,
            isSpecialGroup: true,
            specialPlatform: true,
        },
    });
    if (!group || !group.isSpecialGroup || !group.specialPlatform) {
        return;
    }
    const def = (0, specialGroupRegistry_1.getSpecialGroupDefinition)(group.specialPlatform);
    if (!def || def.activityModel !== 'DAILY_POTD') {
        return;
    }
    // Ensure member record has isPotdCommitted initialized
    const member = await prisma_1.default.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
    });
    if (member && member.isPotdCommitted === undefined) {
        await prisma_1.default.groupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: { isPotdCommitted: true },
        });
    }
    const existingTasks = await prisma_1.default.task.findMany({
        where: { groupId, userId },
    });
    const dailyDef = def.activities.find((a) => a.id === 'daily') || def.activities[0];
    const potdDef = def.activities.find((a) => a.id === 'potd') || def.activities[1];
    let dailyTask = existingTasks.find((t) => t.specialActivity === 'DAILY');
    let potdTask = existingTasks.find((t) => t.specialActivity === 'POTD');
    if (!dailyTask) {
        const genericTask = existingTasks.find((t) => !t.specialActivity);
        if (genericTask) {
            dailyTask = await prisma_1.default.task.update({
                where: { id: genericTask.id },
                data: {
                    title: dailyDef.name,
                    specialActivity: 'DAILY',
                },
            });
        }
        else {
            dailyTask = await prisma_1.default.task.create({
                data: {
                    userId,
                    groupId,
                    isGroupTask: true,
                    title: dailyDef.name,
                    description: dailyDef.description,
                    scheduledDays: group.scheduledDays,
                    category: 'Group Task',
                    recurrence: 'DAILY',
                    status: 'ACTIVE',
                    specialActivity: 'DAILY',
                },
            });
        }
    }
    if (!potdTask) {
        potdTask = await prisma_1.default.task.create({
            data: {
                userId,
                groupId,
                isGroupTask: true,
                title: potdDef.name,
                description: potdDef.description,
                scheduledDays: group.scheduledDays,
                category: 'Group Task',
                recurrence: 'DAILY',
                status: 'ACTIVE',
                specialActivity: 'POTD',
            },
        });
    }
}
/**
 * Retrieves the full activity status for a member in a Daily/POTD special group.
 */
async function getSpecialGroupActivitiesForMember(groupId, userId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const group = await prisma_1.default.group.findUnique({
        where: { id: groupId },
        select: {
            id: true,
            name: true,
            isSpecialGroup: true,
            specialPlatform: true,
        },
    });
    if (!group || !group.isSpecialGroup || !group.specialPlatform) {
        return null;
    }
    const platform = group.specialPlatform;
    const def = (0, specialGroupRegistry_1.getSpecialGroupDefinition)(platform);
    if (!def)
        return null;
    await ensureSpecialGroupMemberTasks(groupId, userId);
    const member = await prisma_1.default.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { isPotdCommitted: true },
    });
    const isPotdCommitted = member?.isPotdCommitted !== false;
    const todayDateStr = (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const tasks = await prisma_1.default.task.findMany({
        where: { groupId, userId },
        include: {
            completions: {
                where: { completionDate: todayDateStr },
                select: { id: true, studyNote: true },
            },
            _count: {
                select: { completions: true },
            },
        },
    });
    const dailyTask = tasks.find((t) => t.specialActivity === 'DAILY');
    const potdTask = tasks.find((t) => t.specialActivity === 'POTD');
    const activities = [];
    const dailyDef = def.activities.find((a) => a.id === 'daily') || def.activities[0];
    const potdDef = def.activities.find((a) => a.id === 'potd') || def.activities[1];
    if (dailyTask) {
        let dailyStreak = dailyTask.currentStreak;
        let dailyLongest = dailyTask.longestStreak;
        if (dailyStreak > 0 && dailyTask.completions.length === 0) {
            const fresh = await (0, streakService_1.ensureTaskStreakCurrent)(prisma_1.default, dailyTask, userTimezone);
            dailyStreak = fresh.currentStreak;
            dailyLongest = fresh.longestStreak;
        }
        activities.push({
            id: 'daily',
            taskId: dailyTask.id,
            name: dailyDef?.name || dailyTask.title,
            shortLabel: dailyDef?.shortLabel || 'Daily',
            tagline: dailyDef?.tagline || 'Daily Practice',
            description: dailyDef?.description || '',
            currentStreak: dailyStreak,
            longestStreak: dailyLongest,
            completedToday: dailyTask.completions.length > 0,
            todayStudyNote: dailyTask.completions[0]?.studyNote || null,
            isCommitted: true,
            lastCompletedDate: null,
            completionsCount: dailyTask._count.completions,
        });
    }
    if (potdTask) {
        let potdStreak = potdTask.currentStreak;
        let potdLongest = potdTask.longestStreak;
        if (potdStreak > 0 && potdTask.completions.length === 0) {
            const fresh = await (0, streakService_1.ensureTaskStreakCurrent)(prisma_1.default, potdTask, userTimezone);
            potdStreak = fresh.currentStreak;
            potdLongest = fresh.longestStreak;
        }
        activities.push({
            id: 'potd',
            taskId: potdTask.id,
            name: potdDef?.name || potdTask.title,
            shortLabel: potdDef?.shortLabel || 'POTD',
            tagline: potdDef?.tagline || 'Problem of the Day',
            description: potdDef?.description || '',
            currentStreak: potdStreak,
            longestStreak: potdLongest,
            completedToday: potdTask.completions.length > 0,
            todayStudyNote: potdTask.completions[0]?.studyNote || null,
            isCommitted: isPotdCommitted,
            lastCompletedDate: null,
            completionsCount: potdTask._count.completions,
        });
    }
    return {
        groupId,
        groupName: group.name,
        platform,
        displayName: def.displayName,
        activityModel: def.activityModel,
        isPotdCommitted,
        activities,
    };
}
/**
 * Completes a special activity (Daily or POTD).
 * If POTD is completed: atomically completes Daily as well (one-way).
 * If Daily is completed: POTD is unaffected.
 */
async function completeSpecialActivity(groupId, userId, activityType, userTimezone = timezoneService_1.DEFAULT_TIMEZONE, studyNote) {
    const todayDateStr = (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    await ensureSpecialGroupMemberTasks(groupId, userId);
    const tasks = await prisma_1.default.task.findMany({
        where: { groupId, userId },
    });
    const dailyTask = tasks.find((t) => t.specialActivity === 'DAILY');
    const potdTask = tasks.find((t) => t.specialActivity === 'POTD');
    if (activityType === 'potd') {
        if (!potdTask)
            throw new Error('POTD activity task not found.');
        // Transaction: complete POTD and ensure Daily is completed
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Complete POTD
            await tx.taskCompletion.upsert({
                where: {
                    taskId_completionDate: { taskId: potdTask.id, completionDate: todayDateStr },
                },
                create: {
                    taskId: potdTask.id,
                    userId,
                    completionDate: todayDateStr,
                    studyNote: studyNote || null,
                },
                update: {
                    studyNote: studyNote || undefined,
                },
            });
            // 2. Automatically complete Daily if not already completed
            if (dailyTask) {
                await tx.taskCompletion.upsert({
                    where: {
                        taskId_completionDate: { taskId: dailyTask.id, completionDate: todayDateStr },
                    },
                    create: {
                        taskId: dailyTask.id,
                        userId,
                        completionDate: todayDateStr,
                        studyNote: studyNote || 'Completed via POTD challenge',
                    },
                    update: {},
                });
            }
        }, { timeout: 30000, maxWait: 10000 });
        // Recalculate streaks independently
        const potdStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, potdTask.id, userId, userTimezone);
        let dailyStreak = null;
        if (dailyTask) {
            dailyStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, dailyTask.id, userId, userTimezone);
        }
        return {
            success: true,
            completedActivity: 'potd',
            potdStreak,
            dailyStreak,
            dailyAlsoCompleted: true,
        };
    }
    else {
        // Daily completion
        if (!dailyTask)
            throw new Error('Daily activity task not found.');
        await prisma_1.default.taskCompletion.upsert({
            where: {
                taskId_completionDate: { taskId: dailyTask.id, completionDate: todayDateStr },
            },
            create: {
                taskId: dailyTask.id,
                userId,
                completionDate: todayDateStr,
                studyNote: studyNote || null,
            },
            update: {
                studyNote: studyNote || undefined,
            },
        });
        const dailyStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, dailyTask.id, userId, userTimezone);
        return {
            success: true,
            completedActivity: 'daily',
            dailyStreak,
            potdStreak: null,
            dailyAlsoCompleted: false,
        };
    }
}
/**
 * Uncompletes a special activity.
 * If POTD is uncompleted: Daily remains completed!
 * If Daily is uncompleted: Daily is uncompleted.
 */
async function uncompleteSpecialActivity(groupId, userId, activityType, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const todayDateStr = (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const targetTask = await prisma_1.default.task.findFirst({
        where: {
            groupId,
            userId,
            specialActivity: activityType.toUpperCase(),
        },
    });
    if (!targetTask) {
        throw new Error(`Target ${activityType} activity task not found.`);
    }
    await prisma_1.default.taskCompletion.deleteMany({
        where: {
            taskId: targetTask.id,
            completionDate: todayDateStr,
        },
    });
    const updatedStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, targetTask.id, userId, userTimezone);
    return {
        success: true,
        uncompletedActivity: activityType,
        updatedStreak,
    };
}
/**
 * Super Admin streak correction for LeetCode / GeeksforGeeks activities
 */
async function adminCorrectSpecialActivityStreak(groupId, userId, activityType, currentStreak, longestStreak) {
    const norm = activityType.trim().toUpperCase();
    const task = await prisma_1.default.task.findFirst({
        where: {
            groupId,
            userId,
            specialActivity: norm,
        },
    });
    if (!task) {
        throw new Error(`Special activity task for ${activityType} not found.`);
    }
    const newLongest = Math.max(longestStreak, currentStreak);
    const updated = await prisma_1.default.task.update({
        where: { id: task.id },
        data: {
            currentStreak,
            longestStreak: newLongest,
        },
    });
    return updated;
}
/**
 * Super Admin retroactively grants or toggles completion on a date
 */
async function adminGrantSpecialActivityDate(groupId, userId, activityType, date, studyNote) {
    const norm = activityType.trim().toUpperCase();
    const task = await prisma_1.default.task.findFirst({
        where: {
            groupId,
            userId,
            specialActivity: norm,
        },
        include: { user: { select: { timezone: true } } },
    });
    if (!task) {
        throw new Error(`Special activity task for ${activityType} not found.`);
    }
    const existing = await prisma_1.default.taskCompletion.findUnique({
        where: { taskId_completionDate: { taskId: task.id, completionDate: date } },
    });
    if (existing) {
        await prisma_1.default.taskCompletion.delete({
            where: { id: existing.id },
        });
    }
    else {
        await prisma_1.default.taskCompletion.create({
            data: {
                taskId: task.id,
                userId,
                completionDate: date,
                studyNote: studyNote || 'Granted by Super Admin',
            },
        });
    }
    const refreshedStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, task.id, userId, task.user?.timezone || timezoneService_1.DEFAULT_TIMEZONE);
    return {
        taskId: task.id,
        date,
        isCompleted: !existing,
        streak: refreshedStreak,
    };
}
