"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasks = getTasks;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.toggleArchiveTask = toggleArchiveTask;
exports.deleteTask = deleteTask;
exports.completeTask = completeTask;
exports.uncompleteTask = uncompleteTask;
exports.updateCompletionNote = updateCompletionNote;
exports.getTaskDetails = getTaskDetails;
exports.getDashboardSummary = getDashboardSummary;
exports.getActivityHistory = getActivityHistory;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const luxon_1 = require("luxon");
const streakService_1 = require("../services/streakService");
const fuzzyMatchService_1 = require("../services/fuzzyMatchService");
const notificationService_1 = require("../services/notificationService");
const pointsService_1 = require("../services/pointsService");
const client_1 = require("@prisma/client");
// Task validation schemas
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Task title is required').max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    category: zod_1.z.string().max(30).optional().default('General'),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
    recurrence: zod_1.z.enum(['DAILY', 'ONE_TIME']).optional().default('DAILY'),
    scheduledDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional().default([0, 1, 2, 3, 4, 5, 6]),
    dueTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Due time must be in HH:MM format').optional().nullable(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(500).optional().nullable(),
    category: zod_1.z.string().max(30).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    recurrence: zod_1.z.enum(['DAILY', 'ONE_TIME']).optional(),
    scheduledDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional(),
    dueTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    status: zod_1.z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});
/**
 * List user tasks with today's completion status
 */
async function getTasks(req, res) {
    try {
        const userId = req.user.userId;
        const { status, priority, category, sortBy, sortOrder } = req.query;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true }
        });
        const timezone = user?.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        // Build filter
        const where = { userId };
        if (status && (status === 'ACTIVE' || status === 'ARCHIVED')) {
            where.status = status;
        }
        else if (!status) {
            where.status = 'ACTIVE'; // default active
        }
        if (priority && ['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
            where.priority = priority;
        }
        if (category && typeof category === 'string' && category.trim() !== 'ALL') {
            where.category = category.trim();
        }
        // Build sorting
        let orderBy = { createdAt: 'desc' };
        const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';
        if (sortBy === 'priority') {
            orderBy = { priority: orderDirection };
        }
        else if (sortBy === 'dueTime') {
            orderBy = { dueTime: orderDirection };
        }
        else if (sortBy === 'title') {
            orderBy = { title: orderDirection };
        }
        const tasks = await prisma_1.default.task.findMany({
            where,
            orderBy,
            include: {
                completions: {
                    where: { completionDate: todayDateStr },
                    select: { id: true, completionDate: true, completedAt: true, studyNote: true }
                }
            }
        });
        // Transform tasks to attach completedToday flag and todayStudyNote
        const formattedTasks = tasks.map(task => {
            const completedToday = task.recurrence === 'DAILY'
                ? task.completions.length > 0
                : task.isCompleted;
            const todayStudyNote = task.completions.length > 0 ? task.completions[0].studyNote : null;
            return {
                ...task,
                completedToday,
                todayStudyNote,
                completions: undefined // hide raw completions array
            };
        });
        return res.json({
            success: true,
            tasks: formattedTasks,
            todayDateStr,
            timezone
        });
    }
    catch (err) {
        console.error('getTasks error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve tasks.' });
    }
}
/**
 * Create a new task
 */
async function createTask(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = createTaskSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid task input'
            });
        }
        const data = parseResult.data;
        const task = await prisma_1.default.task.create({
            data: {
                userId,
                title: data.title.trim(),
                normalizedTitle: (0, fuzzyMatchService_1.getCanonicalTaskTitle)(data.title),
                description: data.description?.trim() || null,
                category: data.category?.trim() || 'General',
                priority: data.priority,
                recurrence: data.recurrence,
                scheduledDays: data.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
                dueTime: data.dueTime || null,
                status: 'ACTIVE',
                isCompleted: false,
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Task created successfully.',
            task: {
                ...task,
                completedToday: false,
                todayStudyNote: null
            }
        });
    }
    catch (err) {
        console.error('createTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to create task.' });
    }
}
/**
 * Edit an existing task
 */
async function updateTask(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        // Check ownership
        const existingTask = await prisma_1.default.task.findUnique({
            where: { id }
        });
        if (!existingTask) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (existingTask.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied. You do not own this task.' });
        }
        const parseResult = updateTaskSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid task update data'
            });
        }
        const updatedTask = await prisma_1.default.task.update({
            where: { id },
            data: parseResult.data
        });
        return res.json({
            success: true,
            message: 'Task updated successfully.',
            task: updatedTask
        });
    }
    catch (err) {
        console.error('updateTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update task.' });
    }
}
/**
 * Archive or Restore a task
 */
async function toggleArchiveTask(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const existingTask = await prisma_1.default.task.findUnique({ where: { id } });
        if (!existingTask) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (existingTask.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        const newStatus = existingTask.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
        const updated = await prisma_1.default.task.update({
            where: { id },
            data: { status: newStatus }
        });
        return res.json({
            success: true,
            message: `Task ${newStatus === 'ACTIVE' ? 'restored' : 'archived'} successfully.`,
            task: updated
        });
    }
    catch (err) {
        console.error('toggleArchiveTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update task archive status.' });
    }
}
/**
 * Delete a task
 */
async function deleteTask(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const existingTask = await prisma_1.default.task.findUnique({ where: { id } });
        if (!existingTask) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (existingTask.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        await prisma_1.default.task.delete({ where: { id } });
        // Recalculate streaks in case completed tasks were deleted
        const streakResult = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId);
        return res.json({
            success: true,
            message: 'Task deleted successfully.',
            streak: streakResult
        });
    }
    catch (err) {
        console.error('deleteTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete task.' });
    }
}
/**
 * Mark a task as completed (Tick) with mandatory study note
 */
async function completeTask(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { studyNote } = req.body || {};
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            include: { user: { select: { timezone: true } } }
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (task.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        // Study note is strictly mandatory (Requirement 13)
        if (!studyNote || typeof studyNote !== 'string' || studyNote.trim().length < 3) {
            return res.status(400).json({
                success: false,
                error: 'A meaningful study note (at least 3 characters) is required to complete this habit.'
            });
        }
        const trimmedNote = studyNote.trim();
        if (trimmedNote.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Study note cannot exceed 500 characters.'
            });
        }
        const timezone = task.user?.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        // Create or update completion record (upsert to prevent duplicate records on same date)
        const completion = await prisma_1.default.taskCompletion.upsert({
            where: {
                taskId_completionDate: {
                    taskId: id,
                    completionDate: todayDateStr
                }
            },
            update: {
                completedAt: new Date(),
                studyNote: trimmedNote
            },
            create: {
                taskId: id,
                userId,
                completionDate: todayDateStr,
                studyNote: trimmedNote
            }
        });
        // If one-time task, mark isCompleted = true
        if (task.recurrence === 'ONE_TIME') {
            await prisma_1.default.task.update({
                where: { id },
                data: { isCompleted: true }
            });
        }
        // Immediately recalculate independent task streak
        const taskStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, id, userId, timezone);
        // Immediately recalculate overall streak
        const overallStreak = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, timezone);
        // Award +5 points for scheduled habit completion (Requirement 9)
        let pointsAwarded = 0;
        let newTotalPoints = 0;
        if (task.recurrence === 'DAILY' && !task.groupId && !task.isGroupTask) {
            const pointsRes = await (0, pointsService_1.awardCompletionPoints)(prisma_1.default, userId, task.id, todayDateStr, task.scheduledDays || [0, 1, 2, 3, 4, 5, 6], timezone);
            pointsAwarded = pointsRes.pointsAwarded;
            newTotalPoints = pointsRes.newTotalPoints;
        }
        else {
            const u = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { points: true } });
            newTotalPoints = u?.points || 0;
        }
        // Trigger milestone checks and friend activity alerts (non-blocking)
        (0, notificationService_1.checkAndTriggerMilestones)({
            userId,
            scope: client_1.FreezeScope.OVERALL,
            scopeId: 'OVERALL',
            currentStreak: overallStreak.currentStreak,
        }).catch((err) => console.error('[completeTask] Milestone check error:', err));
        if (task.recurrence === 'DAILY') {
            (0, notificationService_1.checkAndTriggerMilestones)({
                userId,
                scope: client_1.FreezeScope.TASK,
                scopeId: id,
                currentStreak: taskStreak.currentStreak,
                taskTitle: task.title,
            }).catch((err) => console.error('[completeTask] Task milestone check error:', err));
            (0, notificationService_1.checkAndTriggerFriendActivityAlerts)({
                completedUserId: userId,
                completedTaskId: id,
                completedTaskTitle: task.title,
                studyNote: completion.studyNote,
            }).catch((err) => console.error('[completeTask] Friend activity alert error:', err));
        }
        return res.json({
            success: true,
            message: 'Task marked as completed.',
            completedToday: true,
            studyNote: completion.studyNote,
            taskStreak,
            overallStreak,
            streak: overallStreak, // backwards compatibility
            pointsAwarded,
            totalPoints: newTotalPoints
        });
    }
    catch (err) {
        console.error('completeTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to complete task.' });
    }
}
/**
 * Untick a task (Undo completion)
 */
async function uncompleteTask(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            include: { user: { select: { timezone: true } } }
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (task.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized.' });
        }
        const timezone = task.user?.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        // Delete today's completion record if it exists
        await prisma_1.default.taskCompletion.deleteMany({
            where: {
                taskId: id,
                completionDate: todayDateStr
            }
        });
        // Remove any completion points awarded for today
        await prisma_1.default.pointLedger.deleteMany({
            where: {
                userId,
                taskId: id,
                date: todayDateStr,
                reason: 'COMPLETION'
            }
        });
        // Recompute total user points from ledger
        const aggregate = await prisma_1.default.pointLedger.aggregate({
            where: { userId },
            _sum: { points: true }
        });
        const updatedTotalPoints = aggregate._sum.points || 0;
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { points: updatedTotalPoints }
        });
        // If one-time task, revert isCompleted to false
        if (task.recurrence === 'ONE_TIME') {
            await prisma_1.default.task.update({
                where: { id },
                data: { isCompleted: false }
            });
        }
        // Immediately recalculate independent task streak
        const taskStreak = await (0, streakService_1.recalculateTaskStreaks)(prisma_1.default, id, userId, timezone);
        // Immediately recalculate overall streak
        const overallStreak = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, timezone);
        return res.json({
            success: true,
            message: 'Task marked as incomplete.',
            completedToday: false,
            taskStreak,
            overallStreak,
            streak: overallStreak,
            totalPoints: updatedTotalPoints
        });
    }
    catch (err) {
        console.error('uncompleteTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to undo task completion.' });
    }
}
/**
 * Edit study note on an existing completion
 * Only owner can edit their own completion note. Does not alter streak or completedAt.
 */
async function updateCompletionNote(req, res) {
    try {
        const userId = req.user.userId;
        const { id, date } = req.params;
        const { note } = req.body;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD.' });
        }
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (task.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized. You can only edit your own notes.' });
        }
        const completion = await prisma_1.default.taskCompletion.findUnique({
            where: {
                taskId_completionDate: {
                    taskId: id,
                    completionDate: date
                }
            }
        });
        if (!completion) {
            return res.status(404).json({ success: false, error: `No completion found for date ${date}.` });
        }
        const trimmedNote = typeof note === 'string' && note.trim()
            ? note.trim().slice(0, 500)
            : null;
        const updated = await prisma_1.default.taskCompletion.update({
            where: { id: completion.id },
            data: { studyNote: trimmedNote }
        });
        return res.json({
            success: true,
            message: 'Study note updated.',
            completion: updated
        });
    }
    catch (err) {
        console.error('updateCompletionNote error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update study note.' });
    }
}
/**
 * Get comprehensive task details: streaks, freeze stats, calendar, notes
 * Accessible only to owner and accepted friends!
 */
async function getTaskDetails(req, res) {
    try {
        const requesterId = req.user.userId;
        const { id } = req.params;
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        profileImage: true,
                        timezone: true
                    }
                }
            }
        });
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        // Check authorization: must be owner OR accepted friend
        const isOwner = task.userId === requesterId;
        let isAcceptedFriend = false;
        if (!isOwner) {
            const [u1, u2] = requesterId < task.userId ? [requesterId, task.userId] : [task.userId, requesterId];
            const friendship = await prisma_1.default.friendship.findUnique({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
            });
            isAcceptedFriend = !!friendship;
        }
        if (!isOwner && !isAcceptedFriend) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden. You must be an accepted friend to view this task details.'
            });
        }
        const timezone = task.user.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        // Fetch completions with notes
        const completions = await prisma_1.default.taskCompletion.findMany({
            where: { taskId: id },
            orderBy: { completionDate: 'desc' },
            select: {
                id: true,
                completionDate: true,
                completedAt: true,
                studyNote: true
            }
        });
        // Fetch freeze logs for this task
        const freezeLogs = await prisma_1.default.freezeLog.findMany({
            where: { taskId: id, scope: 'TASK' },
            orderBy: { protectedDate: 'desc' },
            select: {
                id: true,
                protectedDate: true,
                usedAt: true
            }
        });
        const completedDates = completions.map(c => c.completionDate);
        const protectedDates = freezeLogs.map(l => l.protectedDate);
        const completedToday = completedDates.includes(todayDateStr);
        return res.json({
            success: true,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority,
                recurrence: task.recurrence,
                dueTime: task.dueTime,
                status: task.status,
                currentStreak: task.currentStreak,
                longestStreak: task.longestStreak,
                freezeBalance: task.freezeBalance,
                freezeRechargeDays: task.freezeRechargeDays,
                totalCompletedDays: completions.length,
                completedToday,
                isOwner,
                owner: task.user
            },
            completions,
            freezeLogs,
            calendar: {
                completedDates,
                protectedDates,
                todayDateStr
            }
        });
    }
    catch (err) {
        console.error('getTaskDetails error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve task details.' });
    }
}
/**
 * Get dashboard summary: stats, checklist, clocks, completion rate, points
 */
async function getDashboardSummary(req, res) {
    try {
        const userId = req.user.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
                timezone: true,
                currentStreak: true,
                longestStreak: true,
                overallFreezeBalance: true,
                overallFreezeRechargeDays: true,
                points: true,
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const timezone = user.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        const clockInfo = (0, timezoneService_1.getLocalTimeInfo)(timezone);
        // Reconcile missed points for user asynchronously to keep points accurate
        await (0, pointsService_1.reconcileMissedPointsForUser)(prisma_1.default, userId, timezone).catch((e) => console.error('Missed points reconcile error:', e));
        // Fetch points summary stats
        const pointsStats = await (0, pointsService_1.getUserPointsStats)(prisma_1.default, userId);
        // Fetch overall freeze logs for recent protected dates
        const overallFreezeLogs = await prisma_1.default.freezeLog.findMany({
            where: { userId, scope: 'OVERALL' },
            orderBy: { protectedDate: 'desc' },
            take: 10,
            select: { protectedDate: true }
        });
        // Fetch active tasks
        const activeTasks = await prisma_1.default.task.findMany({
            where: { userId, status: 'ACTIVE' },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            include: {
                completions: {
                    where: { completionDate: todayDateStr },
                    select: { id: true, studyNote: true }
                }
            }
        });
        // Calculate completed vs pending today
        const tasksWithStatus = activeTasks.map(task => {
            const completedToday = task.recurrence === 'DAILY'
                ? task.completions.length > 0
                : task.isCompleted;
            const todayStudyNote = task.completions.length > 0 ? task.completions[0].studyNote : null;
            return {
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority,
                recurrence: task.recurrence,
                scheduledDays: task.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
                dueTime: task.dueTime,
                status: task.status,
                currentStreak: task.currentStreak,
                longestStreak: task.longestStreak,
                freezeBalance: task.freezeBalance,
                freezeRechargeDays: task.freezeRechargeDays,
                completedToday,
                todayStudyNote,
                groupId: task.groupId,
                isGroupTask: task.isGroupTask || !!task.groupId
            };
        });
        const totalActiveTasks = tasksWithStatus.length;
        const completedTodayCount = tasksWithStatus.filter(t => t.completedToday).length;
        const pendingTodayCount = totalActiveTasks - completedTodayCount;
        const completionPercentage = totalActiveTasks > 0
            ? Math.round((completedTodayCount / totalActiveTasks) * 100)
            : 0;
        return res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                profileImage: user.profileImage,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                overallFreezeBalance: user.overallFreezeBalance,
                overallFreezeRechargeDays: user.overallFreezeRechargeDays,
                protectedDates: overallFreezeLogs.map(l => l.protectedDate),
                timezone,
                points: pointsStats.totalPoints,
            },
            stats: {
                totalActiveTasks,
                completedTodayCount,
                pendingTodayCount,
                completionPercentage,
            },
            pointsStats,
            todayTasks: tasksWithStatus,
            clockInfo,
        });
    }
    catch (err) {
        console.error('getDashboardSummary error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve dashboard summary.' });
    }
}
/**
 * Get daily activity history for calendar heatmap with year filter and details
 */
async function getActivityHistory(req, res) {
    try {
        const userId = req.user.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true }
        });
        const timezone = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const todayStr = (0, timezoneService_1.getTodayInTimezone)(timezone);
        const currentYear = parseInt(todayStr.slice(0, 4), 10);
        const { startDate, endDate, year } = req.query;
        let rangeStart;
        let rangeEnd;
        let targetYear = null;
        if (startDate && endDate) {
            rangeStart = String(startDate);
            rangeEnd = String(endDate);
        }
        else if (year) {
            const yr = parseInt(String(year), 10);
            targetYear = !isNaN(yr) ? yr : currentYear;
            rangeStart = `${targetYear}-01-01`;
            rangeEnd = `${targetYear}-12-31`;
        }
        else {
            // Default to 365 consecutive calendar days ending today in user's timezone
            const todayDt = luxon_1.DateTime.fromISO(todayStr, { zone: timezone });
            rangeEnd = todayStr;
            rangeStart = todayDt.minus({ days: 364 }).toFormat('yyyy-MM-dd');
        }
        // Fetch completions within date range
        const completions = await prisma_1.default.taskCompletion.findMany({
            where: {
                userId,
                completionDate: {
                    gte: rangeStart,
                    lte: rangeEnd
                }
            },
            include: {
                task: {
                    select: { title: true, category: true }
                }
            },
            orderBy: { completionDate: 'asc' }
        });
        // Group completions by date (shield future dates from having completed activity)
        const dateMap = {};
        for (const c of completions) {
            if (c.completionDate > todayStr)
                continue; // Future dates can never have completions
            if (!dateMap[c.completionDate]) {
                dateMap[c.completionDate] = { count: 0, tasks: [] };
            }
            dateMap[c.completionDate].count += 1;
            dateMap[c.completionDate].tasks.push({
                title: c.task?.title || 'Habit',
                note: c.studyNote
            });
        }
        const activityList = Object.entries(dateMap).map(([date, data]) => ({
            date,
            count: data.count,
            tasks: data.tasks
        })).sort((a, b) => a.date.localeCompare(b.date));
        // Determine available years efficiently using min and max completions
        const [oldestCompletion, newestCompletion] = await Promise.all([
            prisma_1.default.taskCompletion.findFirst({
                where: { userId },
                orderBy: { completionDate: 'asc' },
                select: { completionDate: true }
            }),
            prisma_1.default.taskCompletion.findFirst({
                where: { userId },
                orderBy: { completionDate: 'desc' },
                select: { completionDate: true }
            })
        ]);
        const yearsSet = new Set([currentYear]);
        if (oldestCompletion?.completionDate) {
            const startYr = parseInt(oldestCompletion.completionDate.slice(0, 4), 10);
            const endYr = newestCompletion?.completionDate
                ? parseInt(newestCompletion.completionDate.slice(0, 4), 10)
                : currentYear;
            if (!isNaN(startYr) && !isNaN(endYr)) {
                for (let y = Math.min(startYr, currentYear); y <= Math.max(endYr, currentYear); y++) {
                    yearsSet.add(y);
                }
            }
        }
        const availableYears = Array.from(yearsSet).sort((a, b) => a - b);
        return res.json({
            success: true,
            year: targetYear,
            startDate: rangeStart,
            endDate: rangeEnd,
            today: todayStr,
            timezone,
            availableYears,
            activity: activityList,
            totalCompletions: completions.length,
            activeDaysCount: activityList.filter((a) => a.count > 0).length
        });
    }
    catch (err) {
        console.error('getActivityHistory error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve activity history.' });
    }
}
