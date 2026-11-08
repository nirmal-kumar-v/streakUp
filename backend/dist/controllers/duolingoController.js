"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDuolingoCourses = getDuolingoCourses;
exports.getDuolingoDashboardStreakEndpoint = getDuolingoDashboardStreakEndpoint;
exports.commitDuolingoCourse = commitDuolingoCourse;
exports.uncommitDuolingoCourse = uncommitDuolingoCourse;
exports.completeDuolingoCourse = completeDuolingoCourse;
exports.uncompleteDuolingoCourse = uncompleteDuolingoCourse;
exports.completeAllDuolingoCourses = completeAllDuolingoCourses;
exports.uncompleteAllDuolingoCourses = uncompleteAllDuolingoCourses;
exports.getDuolingoCourseLeaderboard = getDuolingoCourseLeaderboard;
exports.adminMigrateDuolingoGroups = adminMigrateDuolingoGroups;
exports.adminForceDuolingoCommit = adminForceDuolingoCommit;
const prisma_1 = __importDefault(require("../config/prisma"));
const duolingoService_1 = require("../services/duolingoService");
const adminConfigService_1 = require("../services/adminConfigService");
const timezoneService_1 = require("../services/timezoneService");
const notificationService_1 = require("../services/notificationService");
const client_1 = require("@prisma/client");
async function validateDuolingoMembership(groupId, userId) {
    const group = await prisma_1.default.group.findUnique({
        where: { id: groupId },
        include: { members: { where: { userId } } },
    });
    if (!group)
        return { error: 'Group not found', status: 404 };
    const isMember = group.ownerId === userId || group.members.length > 0;
    if (!isMember) {
        return { error: 'You must be a member of this group.', status: 403 };
    }
    const isDuolingo = group.specialPlatform === 'DUOLINGO' || (0, duolingoService_1.isDuolingoName)(group.name);
    if (!isDuolingo) {
        return { error: 'This group is not a Duolingo group.', status: 400 };
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
    });
    const userTimezone = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
    return { group, isMember: true, userTimezone };
}
// ─── GET /api/groups/:id/duolingo/courses ────────────────────────────────────
/**
 * Returns all 45 courses with commitment + streak status for the requesting member.
 */
async function getDuolingoCourses(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const courses = await (0, duolingoService_1.getAllCoursesForMember)(groupId, userId, validation.userTimezone);
        const committed = courses.filter((c) => c.isCommitted);
        const courseLimit = (0, adminConfigService_1.getUserDuolingoCourseLimit)(userId);
        return res.json({
            success: true,
            groupId,
            groupName: validation.group.name,
            courses,
            committedCount: committed.length,
            courseLimit,
            totalCourses: duolingoService_1.DUOLINGO_COURSES.length,
        });
    }
    catch (err) {
        console.error('[getDuolingoCourses]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch Duolingo courses.' });
    }
}
// ─── GET /api/groups/:id/duolingo/dashboard-streak ──────────────────────────
async function getDuolingoDashboardStreakEndpoint(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const summary = await (0, duolingoService_1.getDuolingoDashboardStreak)(groupId, userId, validation.userTimezone);
        return res.json({ success: true, ...summary });
    }
    catch (err) {
        console.error('[getDuolingoDashboardStreak]', err);
        return res.status(500).json({ success: false, error: 'Failed to compute dashboard streak.' });
    }
}
// ─── POST /api/groups/:id/duolingo/commit ────────────────────────────────────
async function commitDuolingoCourse(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const { courseId } = req.body || {};
        if (!courseId) {
            return res.status(400).json({ success: false, error: 'courseId is required.' });
        }
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const courseLimit = (0, adminConfigService_1.getUserDuolingoCourseLimit)(userId);
        const result = await (0, duolingoService_1.commitToCourse)(groupId, userId, courseId, courseLimit, validation.userTimezone);
        if (!result.success) {
            return res.status(409).json({ success: false, error: result.error });
        }
        return res.json({
            success: true,
            message: `You are now committed to ${result.data?.name}.`,
            course: result.data,
        });
    }
    catch (err) {
        console.error('[commitDuolingoCourse]', err);
        return res.status(500).json({ success: false, error: 'Failed to commit to course.' });
    }
}
// ─── POST /api/groups/:id/duolingo/uncommit ──────────────────────────────────
async function uncommitDuolingoCourse(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const { courseId } = req.body || {};
        if (!courseId) {
            return res.status(400).json({ success: false, error: 'courseId is required.' });
        }
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const result = await (0, duolingoService_1.uncommitFromCourse)(groupId, userId, courseId, validation.userTimezone);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        return res.json({
            success: true,
            message: `You have uncommitted from ${result.data?.name}.`,
            course: result.data,
        });
    }
    catch (err) {
        console.error('[uncommitDuolingoCourse]', err);
        return res.status(500).json({ success: false, error: 'Failed to uncommit from course.' });
    }
}
// ─── POST /api/groups/:id/duolingo/courses/:courseId/complete ───────────────
async function completeDuolingoCourse(req, res) {
    try {
        const { id: groupId, courseId } = req.params;
        const userId = req.user.userId;
        const { studyNote, completionDate } = req.body || {};
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const normalized = (0, duolingoService_1.normalizeCourseId)(courseId);
        if (!normalized) {
            return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
        }
        const updatedCourse = await (0, duolingoService_1.completeCourse)(groupId, userId, normalized, validation.userTimezone, studyNote, completionDate);
        // Leaderboard update (async – best-effort)
        const leaderboard = await (0, duolingoService_1.getCourseLeaderboard)(groupId, normalized).catch(() => []);
        // Notify user (fire and forget)
        const today = completionDate || (0, timezoneService_1.getTodayInTimezone)(validation.userTimezone);
        (0, notificationService_1.createNotification)({
            userId,
            category: client_1.NotificationCategory.MY_MILESTONE,
            title: `${updatedCourse.name} Completed 🎉`,
            message: `You completed your ${updatedCourse.name} lesson today! Streak: ${updatedCourse.currentStreak} day${updatedCourse.currentStreak === 1 ? '' : 's'}.`,
            actionUrl: `/groups/${groupId}`,
            eventKey: `DUOLINGO_COURSE:${userId}:${groupId}:${normalized}:${today}`,
        }).catch(() => { });
        return res.json({
            success: true,
            message: `${updatedCourse.name} completed!`,
            course: updatedCourse,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[completeDuolingoCourse]', err);
        return res.status(500).json({ success: false, error: 'Failed to complete course.' });
    }
}
// ─── POST /api/groups/:id/duolingo/courses/:courseId/uncomplete ─────────────
async function uncompleteDuolingoCourse(req, res) {
    try {
        const { id: groupId, courseId } = req.params;
        const userId = req.user.userId;
        const { completionDate } = req.body || {};
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const normalized = (0, duolingoService_1.normalizeCourseId)(courseId);
        if (!normalized) {
            return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
        }
        const updatedCourse = await (0, duolingoService_1.uncompleteCourse)(groupId, userId, normalized, validation.userTimezone, completionDate);
        return res.json({
            success: true,
            message: `${updatedCourse.name} completion undone.`,
            course: updatedCourse,
        });
    }
    catch (err) {
        console.error('[uncompleteDuolingoCourse]', err);
        return res.status(500).json({ success: false, error: 'Failed to undo course completion.' });
    }
}
// ─── POST /api/groups/:id/duolingo/complete-all ──────────────────────────────
async function completeAllDuolingoCourses(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const { studyNote, completionDate } = req.body || {};
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const result = await (0, duolingoService_1.completeAllCommittedCourses)(groupId, userId, validation.userTimezone, studyNote, completionDate);
        const summary = await (0, duolingoService_1.getDuolingoDashboardStreak)(groupId, userId, validation.userTimezone);
        return res.json({
            success: true,
            message: `Completed ${result.newlyCompleted} course${result.newlyCompleted === 1 ? '' : 's'}.`,
            ...result,
            dashboardStreak: summary,
        });
    }
    catch (err) {
        console.error('[completeAllDuolingoCourses]', err);
        return res.status(500).json({ success: false, error: 'Failed to complete all courses.' });
    }
}
// ─── POST /api/groups/:id/duolingo/uncomplete-all ───────────────────────────
async function uncompleteAllDuolingoCourses(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const { completionDate } = req.body || {};
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        await (0, duolingoService_1.uncompleteAllCommittedCourses)(groupId, userId, validation.userTimezone, completionDate);
        const summary = await (0, duolingoService_1.getDuolingoDashboardStreak)(groupId, userId, validation.userTimezone);
        return res.json({
            success: true,
            message: 'All course completions undone for today.',
            dashboardStreak: summary,
        });
    }
    catch (err) {
        console.error('[uncompleteAllDuolingoCourses]', err);
        return res.status(500).json({ success: false, error: 'Failed to undo completions.' });
    }
}
// ─── GET /api/groups/:id/duolingo/leaderboard/:courseId ─────────────────────
async function getDuolingoCourseLeaderboard(req, res) {
    try {
        const { id: groupId, courseId } = req.params;
        const userId = req.user.userId;
        const validation = await validateDuolingoMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status).json({ success: false, error: validation.error });
        }
        const normalized = (0, duolingoService_1.normalizeCourseId)(courseId);
        if (!normalized) {
            return res.status(400).json({ success: false, error: `Unknown course: ${courseId}` });
        }
        // Fetch leaderboard for this course across all committed members in the group
        const leaderboard = await (0, duolingoService_1.getCourseLeaderboard)(groupId, normalized);
        return res.json({
            success: true,
            groupId,
            courseId: normalized,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[getDuolingoCourseLeaderboard]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
    }
}
// ─── POST /api/admin/groups/:id/duolingo/migrate ────────────────────────────
async function adminMigrateDuolingoGroups(req, res) {
    try {
        const result = await (0, duolingoService_1.migrateDuolingoGroups)();
        return res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[adminMigrateDuolingoGroups]', err);
        return res.status(500).json({ success: false, error: 'Migration failed.' });
    }
}
// ─── POST /api/admin/users/:userId/duolingo/force-commit ────────────────────
async function adminForceDuolingoCommit(req, res) {
    try {
        const { userId } = req.params;
        const { groupId, courseId } = req.body || {};
        if (!groupId || !courseId) {
            return res.status(400).json({ success: false, error: 'groupId and courseId are required.' });
        }
        const result = await (0, duolingoService_1.adminForceCommitCourse)(groupId, userId, courseId);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        return res.json({
            success: true,
            message: `Admin force-committed user to ${result.data?.name}.`,
            course: result.data,
        });
    }
    catch (err) {
        console.error('[adminForceDuolingoCommit]', err);
        return res.status(500).json({ success: false, error: 'Failed to force-commit.' });
    }
}
