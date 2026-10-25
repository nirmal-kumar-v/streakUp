import prisma from '../config/prisma';
import {
  detectSpecialPlatform,
  getSpecialGroupDefinition,
  SpecialPlatformType,
  SPECIAL_GROUP_REGISTRY,
} from './specialGroupRegistry';
import { recalculateTaskStreaks, ensureTaskStreakCurrent } from './streakService';
import { awardCompletionPoints } from './pointsService';
import {
  getAllGamesForMember,
  adminCorrectGameStreak,
  adminGrantGameDate,
  setGameCommitment,
} from './linkedInGameService';
import { getTodayInTimezone, DEFAULT_TIMEZONE } from './timezoneService';

export interface SpecialActivityStatus {
  id: string; // 'daily' | 'potd'
  taskId: string;
  name: string;
  shortLabel: string;
  tagline: string;
  description: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  todayStudyNote: string | null;
  isCommitted: boolean;
  lastCompletedDate: string | null;
  completionsCount: number;
}

export interface SpecialGroupMemberView {
  groupId: string;
  groupName: string;
  platform: SpecialPlatformType;
  displayName: string;
  activityModel: 'LINKEDIN_GAMES' | 'DAILY_POTD';
  isPotdCommitted: boolean;
  activities: SpecialActivityStatus[];
}

/**
 * Ensures that a member has all required special group tasks (Daily and POTD).
 */
export async function ensureSpecialGroupMemberTasks(
  groupId: string,
  userId: string
): Promise<void> {
  const group = await prisma.group.findUnique({
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

  const def = getSpecialGroupDefinition(group.specialPlatform);
  if (!def || def.activityModel !== 'DAILY_POTD') {
    return;
  }

  // Ensure member record has isPotdCommitted initialized
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (member && member.isPotdCommitted === undefined) {
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isPotdCommitted: true },
    });
  }

  const existingTasks = await prisma.task.findMany({
    where: { groupId, userId },
  });

  const dailyDef = def.activities.find((a) => a.id === 'daily') || def.activities[0];
  const potdDef = def.activities.find((a) => a.id === 'potd') || def.activities[1];

  let dailyTask = existingTasks.find((t) => t.specialActivity === 'DAILY');
  let potdTask = existingTasks.find((t) => t.specialActivity === 'POTD');

  if (!dailyTask) {
    const genericTask = existingTasks.find((t) => !t.specialActivity);
    if (genericTask) {
      dailyTask = await prisma.task.update({
        where: { id: genericTask.id },
        data: {
          title: dailyDef.name,
          specialActivity: 'DAILY',
        },
      });
    } else {
      dailyTask = await prisma.task.create({
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
    potdTask = await prisma.task.create({
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
export async function getSpecialGroupActivitiesForMember(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<SpecialGroupMemberView | null> {
  const group = await prisma.group.findUnique({
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

  const platform = group.specialPlatform as SpecialPlatformType;
  const def = getSpecialGroupDefinition(platform);
  if (!def) return null;

  await ensureSpecialGroupMemberTasks(groupId, userId);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { isPotdCommitted: true },
  });
  const isPotdCommitted = member?.isPotdCommitted !== false;

  const todayDateStr = getTodayInTimezone(userTimezone);

  const tasks = await prisma.task.findMany({
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

  const activities: SpecialActivityStatus[] = [];

  const dailyDef = def.activities.find((a) => a.id === 'daily') || def.activities[0];
  const potdDef = def.activities.find((a) => a.id === 'potd') || def.activities[1];

  if (dailyTask) {
    let dailyStreak = dailyTask.currentStreak;
    let dailyLongest = dailyTask.longestStreak;
    if (dailyStreak > 0 && dailyTask.completions.length === 0) {
      const fresh = await ensureTaskStreakCurrent(prisma, dailyTask, userTimezone);
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
      const fresh = await ensureTaskStreakCurrent(prisma, potdTask, userTimezone);
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
export async function completeSpecialActivity(
  groupId: string,
  userId: string,
  activityType: 'daily' | 'potd',
  userTimezone: string = DEFAULT_TIMEZONE,
  studyNote?: string
) {
  const todayDateStr = getTodayInTimezone(userTimezone);
  await ensureSpecialGroupMemberTasks(groupId, userId);

  const tasks = await prisma.task.findMany({
    where: { groupId, userId },
  });

  const dailyTask = tasks.find((t) => t.specialActivity === 'DAILY');
  const potdTask = tasks.find((t) => t.specialActivity === 'POTD');

  if (activityType === 'potd') {
    if (!potdTask) throw new Error('POTD activity task not found.');

    // Transaction: complete POTD and ensure Daily is completed
    await prisma.$transaction(
      async (tx) => {
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
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Recalculate streaks independently
    const potdStreak = await recalculateTaskStreaks(prisma, potdTask.id, userId, userTimezone);
    let dailyStreak = null;
    if (dailyTask) {
      dailyStreak = await recalculateTaskStreaks(prisma, dailyTask.id, userId, userTimezone);
    }

    return {
      success: true,
      completedActivity: 'potd',
      potdStreak,
      dailyStreak,
      dailyAlsoCompleted: true,
    };
  } else {
    // Daily completion
    if (!dailyTask) throw new Error('Daily activity task not found.');

    await prisma.taskCompletion.upsert({
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

    const dailyStreak = await recalculateTaskStreaks(prisma, dailyTask.id, userId, userTimezone);

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
export async function uncompleteSpecialActivity(
  groupId: string,
  userId: string,
  activityType: 'daily' | 'potd',
  userTimezone: string = DEFAULT_TIMEZONE
) {
  const todayDateStr = getTodayInTimezone(userTimezone);

  const targetTask = await prisma.task.findFirst({
    where: {
      groupId,
      userId,
      specialActivity: activityType.toUpperCase(),
    },
  });

  if (!targetTask) {
    throw new Error(`Target ${activityType} activity task not found.`);
  }

  await prisma.taskCompletion.deleteMany({
    where: {
      taskId: targetTask.id,
      completionDate: todayDateStr,
    },
  });

  const updatedStreak = await recalculateTaskStreaks(
    prisma,
    targetTask.id,
    userId,
    userTimezone
  );

  return {
    success: true,
    uncompletedActivity: activityType,
    updatedStreak,
  };
}

/**
 * Super Admin streak correction for LeetCode / GeeksforGeeks activities
 */
export async function adminCorrectSpecialActivityStreak(
  groupId: string,
  userId: string,
  activityType: string,
  currentStreak: number,
  longestStreak: number
) {
  const norm = activityType.trim().toUpperCase();
  const task = await prisma.task.findFirst({
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
  const updated = await prisma.task.update({
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
export async function adminGrantSpecialActivityDate(
  groupId: string,
  userId: string,
  activityType: string,
  date: string,
  studyNote?: string
) {
  const norm = activityType.trim().toUpperCase();
  const task = await prisma.task.findFirst({
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

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_completionDate: { taskId: task.id, completionDate: date } },
  });

  if (existing) {
    await prisma.taskCompletion.delete({
      where: { id: existing.id },
    });
  } else {
    await prisma.taskCompletion.create({
      data: {
        taskId: task.id,
        userId,
        completionDate: date,
        studyNote: studyNote || 'Granted by Super Admin',
      },
    });
  }

  const refreshedStreak = await recalculateTaskStreaks(
    prisma,
    task.id,
    userId,
    task.user?.timezone || DEFAULT_TIMEZONE
  );

  return {
    taskId: task.id,
    date,
    isCompleted: !existing,
    streak: refreshedStreak,
  };
}
