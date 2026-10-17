import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getLocalDateString, getLocalTimeInfo } from '../services/timezoneService';
import { recalculateUserStreaks, recalculateTaskStreaks } from '../services/streakService';
import { getCanonicalTaskTitle } from '../services/fuzzyMatchService';
import { checkAndTriggerMilestones, checkAndTriggerFriendActivityAlerts } from '../services/notificationService';
import { awardCompletionPoints, reconcileMissedPointsForUser, getUserPointsStats } from '../services/pointsService';
import { FreezeScope } from '@prisma/client';

// Task validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(30).optional().default('General'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  recurrence: z.enum(['DAILY', 'ONE_TIME']).optional().default('DAILY'),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional().default([0, 1, 2, 3, 4, 5, 6]),
  dueTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Due time must be in HH:MM format').optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(30).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  recurrence: z.enum(['DAILY', 'ONE_TIME']).optional(),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional(),
  dueTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

/**
 * List user tasks with today's completion status
 */
export async function getTasks(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { status, priority, category, sortBy, sortOrder } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    const timezone = user?.timezone || 'Asia/Kolkata';
    const todayDateStr = getLocalDateString(timezone);

    // Build filter
    const where: any = { userId };
    if (status && (status === 'ACTIVE' || status === 'ARCHIVED')) {
      where.status = status;
    } else if (!status) {
      where.status = 'ACTIVE'; // default active
    }

    if (priority && ['LOW', 'MEDIUM', 'HIGH'].includes(priority as string)) {
      where.priority = priority;
    }

    if (category && typeof category === 'string' && category.trim() !== 'ALL') {
      where.category = category.trim();
    }

    // Build sorting
    let orderBy: any = { createdAt: 'desc' };
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'priority') {
      orderBy = { priority: orderDirection };
    } else if (sortBy === 'dueTime') {
      orderBy = { dueTime: orderDirection };
    } else if (sortBy === 'title') {
      orderBy = { title: orderDirection };
    }

    const tasks = await prisma.task.findMany({
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
  } catch (err: any) {
    console.error('getTasks error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve tasks.' });
  }
}

/**
 * Create a new task
 */
export async function createTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const parseResult = createTaskSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid task input'
      });
    }

    const data = parseResult.data;

    const task = await prisma.task.create({
      data: {
        userId,
        title: data.title.trim(),
        normalizedTitle: getCanonicalTaskTitle(data.title),
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
  } catch (err: any) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create task.' });
  }
}

/**
 * Edit an existing task
 */
export async function updateTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Check ownership
    const existingTask = await prisma.task.findUnique({
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

    const updatedTask = await prisma.task.update({
      where: { id },
      data: parseResult.data
    });

    return res.json({
      success: true,
      message: 'Task updated successfully.',
      task: updatedTask
    });
  } catch (err: any) {
    console.error('updateTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update task.' });
  }
}

/**
 * Archive or Restore a task
 */
export async function toggleArchiveTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    if (existingTask.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }

    const newStatus = existingTask.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const updated = await prisma.task.update({
      where: { id },
      data: { status: newStatus }
    });

    return res.json({
      success: true,
      message: `Task ${newStatus === 'ACTIVE' ? 'restored' : 'archived'} successfully.`,
      task: updated
    });
  } catch (err: any) {
    console.error('toggleArchiveTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update task archive status.' });
  }
}

/**
 * Delete a task
 */
export async function deleteTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    if (existingTask.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }

    await prisma.task.delete({ where: { id } });

    // Recalculate streaks in case completed tasks were deleted
    const streakResult = await recalculateUserStreaks(prisma, userId);

    return res.json({
      success: true,
      message: 'Task deleted successfully.',
      streak: streakResult
    });
  } catch (err: any) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete task.' });
  }
}

/**
 * Mark a task as completed (Tick) with mandatory study note
 */
export async function completeTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { studyNote } = req.body || {};

    const task = await prisma.task.findUnique({
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
    const todayDateStr = getLocalDateString(timezone);

    // Create or update completion record (upsert to prevent duplicate records on same date)
    const completion = await prisma.taskCompletion.upsert({
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
      await prisma.task.update({
        where: { id },
        data: { isCompleted: true }
      });
    }

    // Immediately recalculate independent task streak
    const taskStreak = await recalculateTaskStreaks(prisma, id, userId, timezone);

    // Immediately recalculate overall streak
    const overallStreak = await recalculateUserStreaks(prisma, userId, timezone);

    // Award +5 points for scheduled habit completion (Requirement 9)
    let pointsAwarded = 0;
    let newTotalPoints = 0;
    if (task.recurrence === 'DAILY') {
      const pointsRes = await awardCompletionPoints(
        prisma,
        userId,
        task.id,
        todayDateStr,
        task.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
        timezone
      );
      pointsAwarded = pointsRes.pointsAwarded;
      newTotalPoints = pointsRes.newTotalPoints;
    } else {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
      newTotalPoints = u?.points || 0;
    }

    // Trigger milestone checks and friend activity alerts (non-blocking)
    checkAndTriggerMilestones({
      userId,
      scope: FreezeScope.OVERALL,
      scopeId: 'OVERALL',
      currentStreak: overallStreak.currentStreak,
    }).catch((err) => console.error('[completeTask] Milestone check error:', err));

    if (task.recurrence === 'DAILY') {
      checkAndTriggerMilestones({
        userId,
        scope: FreezeScope.TASK,
        scopeId: id,
        currentStreak: taskStreak.currentStreak,
        taskTitle: task.title,
      }).catch((err) => console.error('[completeTask] Task milestone check error:', err));

      checkAndTriggerFriendActivityAlerts({
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
  } catch (err: any) {
    console.error('completeTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to complete task.' });
  }
}

/**
 * Untick a task (Undo completion)
 */
export async function uncompleteTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
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
    const todayDateStr = getLocalDateString(timezone);

    // Delete today's completion record if it exists
    await prisma.taskCompletion.deleteMany({
      where: {
        taskId: id,
        completionDate: todayDateStr
      }
    });

    // Remove any completion points awarded for today
    await prisma.pointLedger.deleteMany({
      where: {
        userId,
        taskId: id,
        date: todayDateStr,
        reason: 'COMPLETION'
      }
    });

    // Recompute total user points from ledger
    const aggregate = await prisma.pointLedger.aggregate({
      where: { userId },
      _sum: { points: true }
    });
    const updatedTotalPoints = aggregate._sum.points || 0;
    await prisma.user.update({
      where: { id: userId },
      data: { points: updatedTotalPoints }
    });

    // If one-time task, revert isCompleted to false
    if (task.recurrence === 'ONE_TIME') {
      await prisma.task.update({
        where: { id },
        data: { isCompleted: false }
      });
    }

    // Immediately recalculate independent task streak
    const taskStreak = await recalculateTaskStreaks(prisma, id, userId, timezone);

    // Immediately recalculate overall streak
    const overallStreak = await recalculateUserStreaks(prisma, userId, timezone);

    return res.json({
      success: true,
      message: 'Task marked as incomplete.',
      completedToday: false,
      taskStreak,
      overallStreak,
      streak: overallStreak,
      totalPoints: updatedTotalPoints
    });
  } catch (err: any) {
    console.error('uncompleteTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to undo task completion.' });
  }
}

/**
 * Edit study note on an existing completion
 * Only owner can edit their own completion note. Does not alter streak or completedAt.
 */
export async function updateCompletionNote(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id, date } = req.params;
    const { note } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    if (task.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized. You can only edit your own notes.' });
    }

    const completion = await prisma.taskCompletion.findUnique({
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

    const updated = await prisma.taskCompletion.update({
      where: { id: completion.id },
      data: { studyNote: trimmedNote }
    });

    return res.json({
      success: true,
      message: 'Study note updated.',
      completion: updated
    });
  } catch (err: any) {
    console.error('updateCompletionNote error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update study note.' });
  }
}

/**
 * Get comprehensive task details: streaks, freeze stats, calendar, notes
 * Accessible only to owner and accepted friends!
 */
export async function getTaskDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const requesterId = req.user!.userId;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
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
      const friendship = await prisma.friendship.findUnique({
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
    const todayDateStr = getLocalDateString(timezone);

    // Fetch completions with notes
    const completions = await prisma.taskCompletion.findMany({
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
    const freezeLogs = await prisma.freezeLog.findMany({
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
  } catch (err: any) {
    console.error('getTaskDetails error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve task details.' });
  }
}


/**
 * Get dashboard summary: stats, checklist, clocks, completion rate, points
 */
export async function getDashboardSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
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
    const todayDateStr = getLocalDateString(timezone);
    const clockInfo = getLocalTimeInfo(timezone);

    // Reconcile missed points for user asynchronously to keep points accurate
    await reconcileMissedPointsForUser(prisma, userId, timezone).catch((e) =>
      console.error('Missed points reconcile error:', e)
    );

    // Fetch points summary stats
    const pointsStats = await getUserPointsStats(prisma, userId);

    // Fetch overall freeze logs for recent protected dates
    const overallFreezeLogs = await prisma.freezeLog.findMany({
      where: { userId, scope: 'OVERALL' },
      orderBy: { protectedDate: 'desc' },
      take: 10,
      select: { protectedDate: true }
    });

    // Fetch active tasks
    const activeTasks = await prisma.task.findMany({
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
        todayStudyNote
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
  } catch (err: any) {
    console.error('getDashboardSummary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve dashboard summary.' });
  }
}

/**
 * Get daily activity history for calendar heatmap with year filter and details
 */
export async function getActivityHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    const timezone = user?.timezone || 'Asia/Kolkata';

    const currentYear = new Date().getFullYear();
    const requestedYear = req.query.year ? parseInt(req.query.year as string, 10) : currentYear;
    const targetYear = !isNaN(requestedYear) ? requestedYear : currentYear;

    // Fetch completions for the requested year
    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId,
        completionDate: {
          startsWith: `${targetYear}-`
        }
      },
      include: {
        task: {
          select: { title: true, category: true }
        }
      },
      orderBy: { completionDate: 'asc' }
    });

    // Group completions by date
    const dateMap: Record<string, { count: number; tasks: Array<{ title: string; note: string | null }> }> = {};
    for (const c of completions) {
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

    // Determine available years from all user completions
    const allCompletions = await prisma.taskCompletion.findMany({
      where: { userId },
      select: { completionDate: true }
    });
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    allCompletions.forEach((c) => {
      const yr = parseInt(c.completionDate.split('-')[0], 10);
      if (!isNaN(yr)) yearsSet.add(yr);
    });
    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);

    return res.json({
      success: true,
      year: targetYear,
      availableYears,
      activity: activityList,
      totalCompletions: completions.length,
      activeDaysCount: activityList.filter((a) => a.count > 0).length
    });
  } catch (err: any) {
    console.error('getActivityHistory error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve activity history.' });
  }
}
