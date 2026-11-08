import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/prisma';
import {
  DUOLINGO_COURSES,
  normalizeCourseId,
  isDuolingoName,
  getAllCoursesForMember,
  getCommittedCoursesForMember,
  commitToCourse,
  uncommitFromCourse,
  completeCourse,
  uncompleteCourse,
  completeAllCommittedCourses,
  uncompleteAllCommittedCourses,
  getDuolingoDashboardStreak,
  getCourseLeaderboard,
  adminCorrectCourseStreak,
  adminGrantCourseDate,
  adminForceCommitCourse,
  migrateDuolingoGroups,
} from '../services/duolingoService';
import { getUserDuolingoCourseLimit } from '../services/adminConfigService';
import { DEFAULT_TIMEZONE, getTodayInTimezone } from '../services/timezoneService';
import { createNotification } from '../services/notificationService';
import { NotificationCategory } from '@prisma/client';

// ─── Shared Validation ───────────────────────────────────────────────────────

interface ValidationSuccess {
  group: any;
  isMember: true;
  userTimezone: string;
}
interface ValidationFailure {
  error: string;
  status: number;
}
type ValidationResult = ValidationSuccess | ValidationFailure;

async function validateDuolingoMembership(
  groupId: string,
  userId: string
): Promise<ValidationResult> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { where: { userId } } },
  });

  if (!group) return { error: 'Group not found', status: 404 };

  const isMember = group.ownerId === userId || group.members.length > 0;
  if (!isMember) {
    return { error: 'You must be a member of this group.', status: 403 };
  }

  const isDuolingo =
    group.specialPlatform === 'DUOLINGO' || isDuolingoName(group.name);
  if (!isDuolingo) {
    return { error: 'This group is not a Duolingo group.', status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const userTimezone = user?.timezone || DEFAULT_TIMEZONE;

  return { group, isMember: true, userTimezone };
}

// ─── GET /api/groups/:id/duolingo/courses ────────────────────────────────────

/**
 * Returns all 45 courses with commitment + streak status for the requesting member.
 */
export async function getDuolingoCourses(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const courses = await getAllCoursesForMember(groupId, userId, validation.userTimezone);
    const committed = courses.filter((c) => c.isCommitted);
    const courseLimit = getUserDuolingoCourseLimit(userId);

    return res.json({
      success: true,
      groupId,
      groupName: validation.group.name,
      courses,
      committedCount: committed.length,
      courseLimit,
      totalCourses: DUOLINGO_COURSES.length,
    });
  } catch (err: any) {
    console.error('[getDuolingoCourses]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch Duolingo courses.' });
  }
}

// ─── GET /api/groups/:id/duolingo/dashboard-streak ──────────────────────────

export async function getDuolingoDashboardStreakEndpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const summary = await getDuolingoDashboardStreak(groupId, userId, validation.userTimezone);
    return res.json({ success: true, ...summary });
  } catch (err: any) {
    console.error('[getDuolingoDashboardStreak]', err);
    return res.status(500).json({ success: false, error: 'Failed to compute dashboard streak.' });
  }
}

// ─── POST /api/groups/:id/duolingo/commit ────────────────────────────────────

export async function commitDuolingoCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;
    const { courseId } = req.body || {};

    if (!courseId) {
      return res.status(400).json({ success: false, error: 'courseId is required.' });
    }

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const courseLimit = getUserDuolingoCourseLimit(userId);
    const result = await commitToCourse(
      groupId, userId, courseId, courseLimit, validation.userTimezone
    );

    if (!result.success) {
      return res.status(409).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `You are now committed to ${result.data?.name}.`,
      course: result.data,
    });
  } catch (err: any) {
    console.error('[commitDuolingoCourse]', err);
    return res.status(500).json({ success: false, error: 'Failed to commit to course.' });
  }
}

// ─── POST /api/groups/:id/duolingo/uncommit ──────────────────────────────────

export async function uncommitDuolingoCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;
    const { courseId } = req.body || {};

    if (!courseId) {
      return res.status(400).json({ success: false, error: 'courseId is required.' });
    }

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const result = await uncommitFromCourse(groupId, userId, courseId, validation.userTimezone);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `You have uncommitted from ${result.data?.name}.`,
      course: result.data,
    });
  } catch (err: any) {
    console.error('[uncommitDuolingoCourse]', err);
    return res.status(500).json({ success: false, error: 'Failed to uncommit from course.' });
  }
}

// ─── POST /api/groups/:id/duolingo/courses/:courseId/complete ───────────────

export async function completeDuolingoCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, courseId } = req.params;
    const userId = req.user!.userId;
    const { studyNote, completionDate } = req.body || {};

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const normalized = normalizeCourseId(courseId);
    if (!normalized) {
      return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
    }

    const updatedCourse = await completeCourse(
      groupId, userId, normalized, validation.userTimezone, studyNote, completionDate
    );

    // Leaderboard update (async – best-effort)
    const leaderboard = await getCourseLeaderboard(groupId, normalized).catch(() => []);

    // Notify user (fire and forget)
    const today = completionDate || getTodayInTimezone(validation.userTimezone);
    createNotification({
      userId,
      category: NotificationCategory.MY_MILESTONE,
      title: `${updatedCourse.name} Completed 🎉`,
      message: `You completed your ${updatedCourse.name} lesson today! Streak: ${updatedCourse.currentStreak} day${updatedCourse.currentStreak === 1 ? '' : 's'}.`,
      actionUrl: `/groups/${groupId}`,
      eventKey: `DUOLINGO_COURSE:${userId}:${groupId}:${normalized}:${today}`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: `${updatedCourse.name} completed!`,
      course: updatedCourse,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[completeDuolingoCourse]', err);
    return res.status(500).json({ success: false, error: 'Failed to complete course.' });
  }
}

// ─── POST /api/groups/:id/duolingo/courses/:courseId/uncomplete ─────────────

export async function uncompleteDuolingoCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, courseId } = req.params;
    const userId = req.user!.userId;
    const { completionDate } = req.body || {};

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const normalized = normalizeCourseId(courseId);
    if (!normalized) {
      return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
    }

    const updatedCourse = await uncompleteCourse(
      groupId, userId, normalized, validation.userTimezone, completionDate
    );

    return res.json({
      success: true,
      message: `${updatedCourse.name} completion undone.`,
      course: updatedCourse,
    });
  } catch (err: any) {
    console.error('[uncompleteDuolingoCourse]', err);
    return res.status(500).json({ success: false, error: 'Failed to undo course completion.' });
  }
}

// ─── POST /api/groups/:id/duolingo/complete-all ──────────────────────────────

export async function completeAllDuolingoCourses(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;
    const { studyNote, completionDate } = req.body || {};

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const result = await completeAllCommittedCourses(
      groupId, userId, validation.userTimezone, studyNote, completionDate
    );

    const summary = await getDuolingoDashboardStreak(groupId, userId, validation.userTimezone);

    return res.json({
      success: true,
      message: `Completed ${result.newlyCompleted} course${result.newlyCompleted === 1 ? '' : 's'}.`,
      ...result,
      dashboardStreak: summary,
    });
  } catch (err: any) {
    console.error('[completeAllDuolingoCourses]', err);
    return res.status(500).json({ success: false, error: 'Failed to complete all courses.' });
  }
}

// ─── POST /api/groups/:id/duolingo/uncomplete-all ───────────────────────────

export async function uncompleteAllDuolingoCourses(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;
    const { completionDate } = req.body || {};

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    await uncompleteAllCommittedCourses(
      groupId, userId, validation.userTimezone, completionDate
    );

    const summary = await getDuolingoDashboardStreak(groupId, userId, validation.userTimezone);

    return res.json({
      success: true,
      message: 'All course completions undone for today.',
      dashboardStreak: summary,
    });
  } catch (err: any) {
    console.error('[uncompleteAllDuolingoCourses]', err);
    return res.status(500).json({ success: false, error: 'Failed to undo completions.' });
  }
}

// ─── GET /api/groups/:id/duolingo/leaderboard/:courseId ─────────────────────

export async function getDuolingoCourseLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, courseId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateDuolingoMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
    }

    const normalized = normalizeCourseId(courseId);
    if (!normalized) {
      return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
    }

    // Fetch leaderboard for this course across all committed members in the group
    const leaderboard = await getCourseLeaderboard(groupId, normalized);

    return res.json({
      success: true,
      groupId,
      courseId: normalized,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[getDuolingoCourseLeaderboard]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
  }
}

// ─── POST /api/admin/groups/:id/duolingo/migrate ────────────────────────────

export async function adminMigrateDuolingoGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await migrateDuolingoGroups();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[adminMigrateDuolingoGroups]', err);
    return res.status(500).json({ success: false, error: 'Migration failed.' });
  }
}

// ─── POST /api/admin/users/:userId/duolingo/force-commit ────────────────────

export async function adminForceDuolingoCommit(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { groupId, courseId } = req.body || {};

    if (!groupId || !courseId) {
      return res.status(400).json({ success: false, error: 'groupId and courseId are required.' });
    }

    const result = await adminForceCommitCourse(groupId, userId, courseId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Admin force-committed user to ${result.data?.name}.`,
      course: result.data,
    });
  } catch (err: any) {
    console.error('[adminForceDuolingoCommit]', err);
    return res.status(500).json({ success: false, error: 'Failed to force-commit.' });
  }
}

