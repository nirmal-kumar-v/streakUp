import cron from 'node-cron';
import { DateTime } from 'luxon';
import prisma from '../config/prisma';
import { ReminderScope, NotificationCategory } from '@prisma/client';
import { getTodayInTimezone } from './timezoneService';
import { createNotification } from './notificationService';
import { buildOverallReminderEmail, buildTaskReminderEmail } from './emailService';
import { cleanupOldAuditLogs } from '../controllers/adminController';

import { getUserReminderLimit } from './adminConfigService';

/**
 * Validates that adding a reminder time does not exceed the allowed quota per scope.
 */
/**
 * Calculates the exact next occurrence for a reminder schedule based on user's timezone and task active days
 */
export function calculateNextOccurrence(
  timeStr: string,
  timezone: string = 'Asia/Kolkata',
  scheduledDays?: number[], // Array of 0..6
  isEnabled: boolean = true
): {
  nextIso: string | null;
  nextDisplay: string;
  relativeDisplay: string;
  isToday: boolean;
} {
  if (!isEnabled) {
    return {
      nextIso: null,
      nextDisplay: 'Schedule is paused/disabled',
      relativeDisplay: 'Disabled',
      isToday: false,
    };
  }

  const zone = timezone || 'Asia/Kolkata';
  const now = DateTime.now().setZone(zone);
  const parts = timeStr.split(':').map(Number);
  const hour = parts[0] || 0;
  const minute = parts[1] || 0;

  const validDays = scheduledDays && scheduledDays.length > 0 ? scheduledDays : [0, 1, 2, 3, 4, 5, 6];

  // Try checking from today up to 7 days ahead
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDate = now.plus({ days: offset }).set({ hour, minute, second: 0, millisecond: 0 });
    const candidateDayOfWeek = candidateDate.weekday % 7;

    if (!validDays.includes(candidateDayOfWeek)) {
      continue;
    }

    if (offset === 0 && candidateDate <= now) {
      // Time has already passed today
      continue;
    }

    // Found next occurrence!
    const isToday = offset === 0;
    const isTomorrow = offset === 1;

    let relative = '';
    const diff = candidateDate.diff(now, ['hours', 'minutes']);
    const diffHours = Math.floor(diff.hours);
    const diffMins = Math.floor(diff.minutes);

    if (isToday) {
      relative = `Today in ${diffHours > 0 ? `${diffHours}h ` : ''}${diffMins}m`;
    } else if (isTomorrow) {
      relative = `Tomorrow at ${candidateDate.toFormat('hh:mm a')}`;
    } else {
      relative = `${candidateDate.toFormat('cccc')} at ${candidateDate.toFormat('hh:mm a')}`;
    }

    return {
      nextIso: candidateDate.toISO(),
      nextDisplay: candidateDate.toFormat('EEE, d MMM yyyy, hh:mm a (ZZZZ)'),
      relativeDisplay: relative,
      isToday,
    };
  }

  return {
    nextIso: null,
    nextDisplay: 'No upcoming scheduled active days',
    relativeDisplay: 'Inactive',
    isToday: false,
  };
}

/**
 * Validates that adding a reminder time does not exceed the allowed quota per scope.
 */
export async function validateReminderCount(params: {
  userId: string;
  scope: ReminderScope;
  taskId?: string | null;
}): Promise<{ valid: boolean; currentCount: number; maxAllowed: number }> {
  const { userId, scope, taskId } = params;

  // Personal and group tasks are strictly permitted up to 2 reminder times
  if (scope === ReminderScope.TASK) {
    const currentCount = await prisma.reminderSchedule.count({
      where: {
        userId,
        scope: ReminderScope.TASK,
        taskId: taskId || null,
      },
    });
    return {
      valid: currentCount < 2,
      currentCount,
      maxAllowed: 2,
    };
  }

  const maxAllowed = getUserReminderLimit(userId);

  const currentCount = await prisma.reminderSchedule.count({
    where: {
      userId,
      scope,
      taskId: taskId || null,
    },
  });

  return {
    valid: currentCount < maxAllowed,
    currentCount,
    maxAllowed,
  };
}

/**
 * Checks all active reminder schedules against the current minute in each user's timezone.
 * Skips already-completed tasks/scopes and enforces idempotency.
 */
export async function runReminderCheck(): Promise<{ processed: number; sent: number; skipped: number }> {
  const activeSchedules = await prisma.reminderSchedule.findMany({
    where: { isEnabled: true },
    include: {
      user: {
        include: {
          notificationPreference: true,
        },
      },
      task: true,
    },
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  const nowUtc = DateTime.utc();

  for (const schedule of activeSchedules) {
    processed++;
    const user = schedule.user;
    if (!user) continue;

    const userTz = user.timezone || 'Asia/Kolkata';
    const userLocalTime = nowUtc.setZone(userTz);
    const currentLocalHourMinute = userLocalTime.toFormat('HH:mm'); // e.g. "08:00"
    const localDate = userLocalTime.toFormat('yyyy-MM-dd');

    // Only process if current user local time has reached or passed the scheduled time
    if (currentLocalHourMinute < schedule.time) {
      continue;
    }

    // Check if this reminder was ALREADY successfully delivered via email today
    const eventKey =
      schedule.scope === ReminderScope.OVERALL
        ? `REMINDER:OVERALL:${user.id}:${localDate}:${schedule.time}`
        : `REMINDER:TASK:${schedule.taskId}:${localDate}:${schedule.time}`;

    const alreadyDelivered = await prisma.emailDelivery.findFirst({
      where: {
        idempotencyKey: `EMAIL:${eventKey}`,
        status: 'SENT',
      },
    });

    if (alreadyDelivered) {
      skipped++;
      continue;
    }

    // Calculate time remaining in the user's local day
    const endOfDay = userLocalTime.endOf('day');
    const diff = endOfDay.diff(userLocalTime, ['hours', 'minutes']);
    const remainingHours = Math.floor(diff.hours);
    const remainingMinutes = Math.floor(diff.minutes);
    const timeRemainingStr = `${remainingHours}h ${remainingMinutes}m`;

    if (schedule.scope === ReminderScope.OVERALL) {
      // 1. Check if user has completed ANY task today
      const overallCompletions = await prisma.taskCompletion.count({
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
      const emailContent = buildOverallReminderEmail({
        name: user.name,
        currentStreak: user.currentStreak,
        timeRemaining: timeRemainingStr,
      });

      const notif = await createNotification({
        userId: user.id,
        category: NotificationCategory.OVERALL_REMINDER,
        title: '🔥 StreakUp Streak Waiting',
        message: `You haven't completed a task today yet. Complete at least one task before your day ends to maintain your ${user.currentStreak}-day overall streak! (${timeRemainingStr} remaining)`,
        actionUrl: `/dashboard`,
        eventKey,
        emailSubject: emailContent.subject,
        emailText: emailContent.text,
      });

      if (notif) sent++;
    } else if (schedule.scope === ReminderScope.TASK && schedule.taskId) {
      const task = schedule.task;
      // Skip if task was archived, deleted, or completed
      if (!task || task.status !== 'ACTIVE') {
        skipped++;
        continue;
      }

      // Check if today is an active scheduled day for this task
      const dayOfWeek = userLocalTime.weekday % 7; // 0=Sunday..6=Saturday
      const scheduledDays = task.scheduledDays || [0, 1, 2, 3, 4, 5, 6];
      if (scheduledDays.length > 0 && !scheduledDays.includes(dayOfWeek)) {
        skipped++;
        continue;
      }

      // Check if this specific task has already been completed today
      const taskCompletion = await prisma.taskCompletion.findFirst({
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
      const emailContent = buildTaskReminderEmail({
        name: user.name,
        taskTitle: task.title,
        currentStreak: task.currentStreak,
        timeRemaining: timeRemainingStr,
      });

      const notif = await createNotification({
        userId: user.id,
        category: NotificationCategory.TASK_REMINDER,
        title: `⚡ Reminder: ${task.title}`,
        message: `You haven't completed your "${task.title}" task today. You can still finish it before your day ends (${timeRemainingStr} remaining)!`,
        taskId: task.id,
        actionUrl: `/tasks`,
        eventKey,
        emailSubject: emailContent.subject,
        emailText: emailContent.text,
      });

      if (notif) sent++;
    }
  }

  // Automatically purge admin audit logs older than 15 days
  try {
    await cleanupOldAuditLogs();
  } catch (err) {
    // Non-blocking cleanup
  }

  return { processed, sent, skipped };
}

let cronJobStarted = false;

/**
 * Initializes the background node-cron scheduler to run every minute in long-running Node server mode.
 */
export function startReminderScheduler() {
  if (cronJobStarted) return;

  // Run every minute: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      await runReminderCheck();
    } catch (err) {
      console.error('[ReminderScheduler] Error running scheduled reminder check:', err);
    }
  });

  cronJobStarted = true;
  console.log('⏰ [ReminderScheduler] Cron job registered (runs every minute).');
}
