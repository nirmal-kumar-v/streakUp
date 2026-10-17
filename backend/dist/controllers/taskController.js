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
exports.getDashboardSummary = getDashboardSummary;
exports.getActivityHistory = getActivityHistory;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const streakService_1 = require("../services/streakService");
// Task validation schemas
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Task title is required').max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    category: zod_1.z.string().max(30).optional().default('General'),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
    recurrence: zod_1.z.enum(['DAILY', 'ONE_TIME']).optional().default('DAILY'),
    dueTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Due time must be in HH:MM format').optional().nullable(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(500).optional().nullable(),
    category: zod_1.z.string().max(30).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    recurrence: zod_1.z.enum(['DAILY', 'ONE_TIME']).optional(),
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
                    select: { id: true, completionDate: true, completedAt: true }
                }
            }
        });
        // Transform tasks to attach completedToday flag
        const formattedTasks = tasks.map(task => {
            const completedToday = task.recurrence === 'DAILY'
                ? task.completions.length > 0
                : task.isCompleted;
            return {
                ...task,
                completedToday,
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
                description: data.description?.trim() || null,
                category: data.category?.trim() || 'General',
                priority: data.priority,
                recurrence: data.recurrence,
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
                completedToday: false
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
 * Mark a task as completed (Tick)
 */
async function completeTask(req, res) {
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
        // Create completion record (upsert to prevent duplicate records on same date)
        await prisma_1.default.taskCompletion.upsert({
            where: {
                taskId_completionDate: {
                    taskId: id,
                    completionDate: todayDateStr
                }
            },
            update: {
                completedAt: new Date()
            },
            create: {
                taskId: id,
                userId,
                completionDate: todayDateStr
            }
        });
        // If one-time task, mark isCompleted = true
        if (task.recurrence === 'ONE_TIME') {
            await prisma_1.default.task.update({
                where: { id },
                data: { isCompleted: true }
            });
        }
        // Immediately recalculate streak on backend
        const streakResult = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, timezone);
        return res.json({
            success: true,
            message: 'Task marked as completed.',
            completedToday: true,
            streak: streakResult
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
        // If one-time task, revert isCompleted to false
        if (task.recurrence === 'ONE_TIME') {
            await prisma_1.default.task.update({
                where: { id },
                data: { isCompleted: false }
            });
        }
        // Immediately recalculate streak on backend
        const streakResult = await (0, streakService_1.recalculateUserStreaks)(prisma_1.default, userId, timezone);
        return res.json({
            success: true,
            message: 'Task marked as incomplete.',
            completedToday: false,
            streak: streakResult
        });
    }
    catch (err) {
        console.error('uncompleteTask error:', err);
        return res.status(500).json({ success: false, error: 'Failed to undo task completion.' });
    }
}
/**
 * Get dashboard summary: stats, checklist, clocks, completion rate
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
                timezone: true,
                currentStreak: true,
                longestStreak: true
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const timezone = user.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        const clockInfo = (0, timezoneService_1.getLocalTimeInfo)(timezone);
        // Fetch active tasks
        const activeTasks = await prisma_1.default.task.findMany({
            where: { userId, status: 'ACTIVE' },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            include: {
                completions: {
                    where: { completionDate: todayDateStr },
                    select: { id: true }
                }
            }
        });
        // Calculate completed vs pending today
        const tasksWithStatus = activeTasks.map(task => {
            const completedToday = task.recurrence === 'DAILY'
                ? task.completions.length > 0
                : task.isCompleted;
            return {
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority,
                recurrence: task.recurrence,
                dueTime: task.dueTime,
                status: task.status,
                completedToday
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
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                timezone
            },
            stats: {
                totalActiveTasks,
                completedTodayCount,
                pendingTodayCount,
                completionPercentage,
            },
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
 * Get daily activity history for calendar heatmap
 */
async function getActivityHistory(req, res) {
    try {
        const userId = req.user.userId;
        const completions = await prisma_1.default.taskCompletion.findMany({
            where: { userId },
            select: { completionDate: true },
        });
        // Group completions by date
        const dateCounts = {};
        for (const c of completions) {
            dateCounts[c.completionDate] = (dateCounts[c.completionDate] || 0) + 1;
        }
        const activityList = Object.entries(dateCounts).map(([date, count]) => ({
            date,
            count
        })).sort((a, b) => a.date.localeCompare(b.date));
        return res.json({
            success: true,
            activity: activityList,
            totalCompletions: completions.length
        });
    }
    catch (err) {
        console.error('getActivityHistory error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve activity history.' });
    }
}
