"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReminderCount = validateReminderCount;
exports.runReminderCheck = runReminderCheck;
exports.startReminderScheduler = startReminderScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const luxon_1 = require("luxon");
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const notificationService_1 = require("./notificationService");
const emailService_1 = require("./emailService");
const MAX_REMINDERS_PER_SCOPE = 3;
/**
 * Validates that adding a reminder time does not exceed the maximum of 3 times per scope.
 */
async function validateReminderCount(params) {
    const { userId, scope, taskId } = params;
    const currentCount = await prisma_1.default.reminderSchedule.count({
        where: {
            userId,
            scope,
            taskId: taskId || null,
        },
    });
    return {
        valid: currentCount < MAX_REMINDERS_PER_SCOPE,
        currentCount,
    };
}
/**
 * Checks all active reminder schedules against the current minute in each user's timezone.
 * Skips already-completed tasks/scopes and enforces idempotency.
 */
async function runReminderCheck() {
    const activeSchedules = await prisma_1.default.reminderSchedule.findMany({
        where: { isEnabled: true },
        include: {
            user: true,
            task: true,
        },
    });
    let processed = 0;
    let sent = 0;
    let skipped = 0;
    const nowUtc = luxon_1.DateTime.utc();
    for (const schedule of activeSchedules) {
        processed++;
        const user = schedule.user;
        if (!user)
            continue;
        const userTz = user.timezone || 'Asia/Kolkata';
        const userLocalTime = nowUtc.setZone(userTz);
        const currentLocalHourMinute = userLocalTime.toFormat('HH:mm'); // e.g. "08:00"
        const localDate = userLocalTime.toFormat('yyyy-MM-dd');
        // Only process if current user local minute matches the scheduled time
        if (currentLocalHourMinute !== schedule.time) {
            continue;
        }
        // Calculate time remaining in the user's local day
        const endOfDay = userLocalTime.endOf('day');
        const diff = endOfDay.diff(userLocalTime, ['hours', 'minutes']);
        const remainingHours = Math.floor(diff.hours);
        const remainingMinutes = Math.floor(diff.minutes);
        const timeRemainingStr = `${remainingHours}h ${remainingMinutes}m`;
        if (schedule.scope === client_1.ReminderScope.OVERALL) {
            // 1. Check if user has completed ANY task today
            const overallCompletions = await prisma_1.default.taskCompletion.count({
                where: {
                    userId: user.id,
                    completionDate: localDate,
                },
            });
            if (overallCompletions > 0) {
                // User already qualified today! Skip reminder.
                skipped++;
                continue;
            }
            // User has not completed any task today. Dispatch overall reminder.
            const eventKey = `REMINDER:OVERALL:${user.id}:${localDate}:${schedule.time}`;
            const emailContent = (0, emailService_1.buildOverallReminderEmail)({
                name: user.name,
                currentStreak: user.currentStreak,
                timeRemaining: timeRemainingStr,
            });
            const notif = await (0, notificationService_1.createNotification)({
                userId: user.id,
                category: client_1.NotificationCategory.OVERALL_REMINDER,
                title: '🔥 StreakUp Streak Waiting',
                message: `You haven't completed a task today yet. Complete at least one task before your day ends to maintain your ${user.currentStreak}-day overall streak! (${timeRemainingStr} remaining)`,
                actionUrl: `/dashboard`,
                eventKey,
                emailSubject: emailContent.subject,
                emailText: emailContent.text,
            });
            if (notif)
                sent++;
        }
        else if (schedule.scope === client_1.ReminderScope.TASK && schedule.taskId) {
            const task = schedule.task;
            // Skip if task was archived, deleted, or completed
            if (!task || task.status !== 'ACTIVE') {
                skipped++;
                continue;
            }
            // Check if this specific task has already been completed today
            const taskCompletion = await prisma_1.default.taskCompletion.findFirst({
                where: {
                    taskId: task.id,
                    completionDate: localDate,
                },
            });
            if (taskCompletion) {
                // Specific task already completed today! Skip reminder.
                skipped++;
                continue;
            }
            // Task is incomplete. Dispatch task reminder.
            const eventKey = `REMINDER:TASK:${task.id}:${localDate}:${schedule.time}`;
            const emailContent = (0, emailService_1.buildTaskReminderEmail)({
                name: user.name,
                taskTitle: task.title,
                currentStreak: task.currentStreak,
                timeRemaining: timeRemainingStr,
            });
            const notif = await (0, notificationService_1.createNotification)({
                userId: user.id,
                category: client_1.NotificationCategory.TASK_REMINDER,
                title: `⚡ Reminder: ${task.title}`,
                message: `You haven't completed your "${task.title}" task today. You can still finish it before your day ends (${timeRemainingStr} remaining)!`,
                taskId: task.id,
                actionUrl: `/tasks`,
                eventKey,
                emailSubject: emailContent.subject,
                emailText: emailContent.text,
            });
            if (notif)
                sent++;
        }
    }
    return { processed, sent, skipped };
}
let cronJobStarted = false;
/**
 * Initializes the background node-cron scheduler to run every minute in long-running Node server mode.
 */
function startReminderScheduler() {
    if (cronJobStarted)
        return;
    // Run every minute: '* * * * *'
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await runReminderCheck();
        }
        catch (err) {
            console.error('[ReminderScheduler] Error running scheduled reminder check:', err);
        }
    });
    cronJobStarted = true;
    console.log('⏰ [ReminderScheduler] Cron job registered (runs every minute).');
}
