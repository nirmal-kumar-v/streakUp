"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQualifyingMilestone = isQualifyingMilestone;
exports.getOrCreateNotificationPreferences = getOrCreateNotificationPreferences;
exports.createNotification = createNotification;
exports.checkAndTriggerMilestones = checkAndTriggerMilestones;
exports.checkAndTriggerFriendActivityAlerts = checkAndTriggerFriendActivityAlerts;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const timezoneService_1 = require("./timezoneService");
const fuzzyMatchService_1 = require("./fuzzyMatchService");
const emailService_1 = require("./emailService");
// Milestone schedule required by Section 10:
// 5, 10, 25, 50, 100, and every additional 50 days after 100 (150, 200, 250, 300...)
function isQualifyingMilestone(streak) {
    if (streak === 5 || streak === 10 || streak === 25 || streak === 50 || streak === 100) {
        return true;
    }
    if (streak > 100 && streak % 50 === 0) {
        return true;
    }
    return false;
}
/**
 * Ensures a user has a NotificationPreference record in DB, returning default settings if new.
 */
async function getOrCreateNotificationPreferences(userId) {
    let pref = await prisma_1.default.notificationPreference.findUnique({
        where: { userId },
    });
    if (!pref) {
        pref = await prisma_1.default.notificationPreference.create({
            data: {
                userId,
                emailNotificationsEnabled: true,
                inAppNotificationsEnabled: true,
                overallStreakRemindersEmail: true,
                taskRemindersEmail: true,
                friendOverallActivityAlerts: true,
                friendTaskActivityAlerts: true,
                friendOverallMilestones: true,
                friendTaskMilestones: true,
                myMilestonesEmail: true,
                freezeStatusNotifications: true,
            },
        });
    }
    return pref;
}
/**
 * Creates an in-app notification and dispatches an email if user preferences permit.
 */
async function createNotification(params) {
    const { userId, category, title, message, friendId, taskId, actionUrl, eventKey, emailSubject, emailHtml, emailText, } = params;
    // 1. Fetch User & Preferences
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return null;
    const pref = await getOrCreateNotificationPreferences(userId);
    // 2. Check if an in-app notification already exists for this eventKey
    let existingNotification = null;
    if (eventKey) {
        existingNotification = await prisma_1.default.notification.findFirst({
            where: { userId, eventKey },
        });
    }
    // 3. Create In-App Notification (if in-app channel enabled and not already recorded)
    let notification = existingNotification;
    if (!existingNotification && pref.inAppNotificationsEnabled) {
        notification = await prisma_1.default.notification.create({
            data: {
                userId,
                category,
                title,
                message,
                friendId,
                taskId,
                actionUrl,
                eventKey,
            },
        });
    }
    // 4. Check if Email delivery is enabled for this category
    const isEmailCategoryEnabled = () => {
        if (!pref.emailNotificationsEnabled)
            return false;
        switch (category) {
            case client_1.NotificationCategory.OVERALL_REMINDER:
                return pref.overallStreakRemindersEmail;
            case client_1.NotificationCategory.TASK_REMINDER:
                return pref.taskRemindersEmail;
            case client_1.NotificationCategory.FRIEND_OVERALL_ACTIVITY:
                return pref.friendOverallActivityAlerts;
            case client_1.NotificationCategory.FRIEND_TASK_ACTIVITY:
                return pref.friendTaskActivityAlerts;
            case client_1.NotificationCategory.FRIEND_OVERALL_MILESTONE:
                return pref.friendOverallMilestones;
            case client_1.NotificationCategory.FRIEND_TASK_MILESTONE:
                return pref.friendTaskMilestones;
            case client_1.NotificationCategory.MY_MILESTONE:
                return pref.myMilestonesEmail;
            case client_1.NotificationCategory.SYSTEM:
                return true;
            default:
                return false;
        }
    };
    if (isEmailCategoryEnabled() && emailSubject && emailText) {
        // Determine destination email (custom verified email or user registered email)
        const destinationEmail = pref.customNotificationEmail && pref.isCustomEmailVerified
            ? pref.customNotificationEmail
            : user.email;
        const emailIdempotencyKey = eventKey ? `EMAIL:${eventKey}` : `EMAIL:${userId}:${Date.now()}`;
        await (0, emailService_1.sendEmail)({
            userId,
            recipientEmail: destinationEmail,
            category,
            subject: emailSubject,
            text: emailText,
            idempotencyKey: emailIdempotencyKey,
        });
    }
    return notification;
}
/**
 * Checks for streak milestones and creates idempotent records & notifications
 * for the user and their accepted friends.
 */
async function checkAndTriggerMilestones(params) {
    const { userId, scope, scopeId, currentStreak, taskTitle } = params;
    if (!isQualifyingMilestone(currentStreak)) {
        return;
    }
    const scopeKey = scope === client_1.FreezeScope.OVERALL ? 'OVERALL' : `TASK:${scopeId}`;
    // 1. Idempotency: Has this milestone already been recorded?
    const existingMilestone = await prisma_1.default.milestoneEvent.findUnique({
        where: {
            userId_scopeKey_milestone: {
                userId,
                scopeKey,
                milestone: currentStreak,
            },
        },
    });
    if (existingMilestone) {
        return; // Already awarded!
    }
    // 2. Persist MilestoneEvent record
    await prisma_1.default.milestoneEvent.create({
        data: {
            userId,
            scope,
            scopeKey,
            milestone: currentStreak,
        },
    });
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return;
    // 3. User's Own Milestone Notification
    const scopeDesc = scope === client_1.FreezeScope.OVERALL ? 'overall' : taskTitle || 'task';
    const myEmail = (0, emailService_1.buildMyMilestoneEmail)({
        name: user.name,
        scopeDescription: scopeDesc,
        milestone: currentStreak,
    });
    await createNotification({
        userId,
        category: client_1.NotificationCategory.MY_MILESTONE,
        title: `🎉 ${currentStreak}-Day Streak Milestone!`,
        message: `Congratulations! You reached an incredible ${currentStreak}-day ${scopeDesc} streak on StreakUp. Keep up the dedication!`,
        taskId: scope === client_1.FreezeScope.TASK ? scopeId : null,
        actionUrl: scope === client_1.FreezeScope.TASK ? `/tasks` : `/dashboard`,
        eventKey: `MILESTONE:SELF:${userId}:${scopeKey}:${currentStreak}`,
        emailSubject: myEmail.subject,
        emailText: myEmail.text,
    });
    // 4. Find all Accepted Friends to notify them
    const friendships = await prisma_1.default.friendship.findMany({
        where: {
            OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        include: {
            user1: true,
            user2: true,
        },
    });
    const friends = friendships.map((f) => (f.user1Id === userId ? f.user2 : f.user1));
    for (const friend of friends) {
        if (scope === client_1.FreezeScope.OVERALL) {
            // Overall milestone alert for friend
            const friendEmail = (0, emailService_1.buildOverallMilestoneEmail)({
                friendName: user.name,
                milestone: currentStreak,
            });
            await createNotification({
                userId: friend.id,
                category: client_1.NotificationCategory.FRIEND_OVERALL_MILESTONE,
                title: `🏆 ${user.name} reached a ${currentStreak}-day overall streak!`,
                message: `Your friend ${user.name} has hit an inspiring ${currentStreak}-day overall streak. Send them a congratulations!`,
                friendId: user.id,
                actionUrl: `/profile/${user.username}`,
                eventKey: `MILESTONE:FRIEND_OVERALL:${user.id}:${friend.id}:${currentStreak}`,
                emailSubject: friendEmail.subject,
                emailText: friendEmail.text,
            });
        }
        else {
            // Task milestone: check if friend has a matching task or is authorized
            const friendTasks = await prisma_1.default.task.findMany({
                where: {
                    userId: friend.id,
                    recurrence: 'DAILY',
                    status: 'ACTIVE',
                },
            });
            const match = (0, fuzzyMatchService_1.findBestMatchingTask)(taskTitle || '', friendTasks);
            // Only notify friends who share this matching habit/activity
            if (match.match && match.confidence >= 0.6) {
                const friendEmail = (0, emailService_1.buildTaskMilestoneEmail)({
                    friendName: user.name,
                    taskTitle: taskTitle || 'task',
                    milestone: currentStreak,
                });
                await createNotification({
                    userId: friend.id,
                    category: client_1.NotificationCategory.FRIEND_TASK_MILESTONE,
                    title: `🎯 ${user.name} reached ${currentStreak} days on ${taskTitle}!`,
                    message: `Your friend ${user.name} achieved a ${currentStreak}-day streak on their matching ${taskTitle} task!`,
                    friendId: user.id,
                    taskId: match.match.id,
                    actionUrl: `/friends/tasks`,
                    eventKey: `MILESTONE:FRIEND_TASK:${user.id}:${friend.id}:${scopeId}:${currentStreak}`,
                    emailSubject: friendEmail.subject,
                    emailText: friendEmail.text,
                });
            }
        }
    }
}
/**
 * Triggered upon task completion: Notifies accepted friends if they haven't completed
 * their overall activity or matching task today yet.
 */
async function checkAndTriggerFriendActivityAlerts(params) {
    const { completedUserId, completedTaskId, completedTaskTitle, studyNote } = params;
    const completedUser = await prisma_1.default.user.findUnique({
        where: { id: completedUserId },
    });
    if (!completedUser)
        return;
    // Find all accepted friends
    const friendships = await prisma_1.default.friendship.findMany({
        where: {
            OR: [{ user1Id: completedUserId }, { user2Id: completedUserId }],
        },
        include: {
            user1: true,
            user2: true,
        },
    });
    const friends = friendships.map((f) => (f.user1Id === completedUserId ? f.user2 : f.user1));
    for (const friend of friends) {
        const friendToday = (0, timezoneService_1.getTodayInTimezone)(friend.timezone || 'Asia/Kolkata');
        // 1. Overall Activity Alert
        // Check if recipient (friend) has completed ANY task today
        const friendOverallCompletions = await prisma_1.default.taskCompletion.count({
            where: {
                userId: friend.id,
                completionDate: friendToday,
            },
        });
        if (friendOverallCompletions === 0) {
            // Recipient has not completed any task today!
            const emailContent = (0, emailService_1.buildFriendOverallActivityEmail)({
                recipientName: friend.name,
                friendName: completedUser.name,
            });
            // Deduplicate: At most once per completedUser, recipient, and friend's local date
            const overallEventKey = `FRIEND_OVERALL:${completedUserId}:${friend.id}:${friendToday}`;
            await createNotification({
                userId: friend.id,
                category: client_1.NotificationCategory.FRIEND_OVERALL_ACTIVITY,
                title: `${completedUser.name} completed today's activity`,
                message: `Your friend ${completedUser.name} has completed today's activity. You haven't completed any task today yet. Complete a task to keep your overall streak going!`,
                friendId: completedUser.id,
                actionUrl: `/dashboard`,
                eventKey: overallEventKey,
                emailSubject: emailContent.subject,
                emailText: emailContent.text,
            });
        }
        // 2. Task-Specific Activity Alert
        // Find matching tasks in friend's active daily habits
        const friendTasks = await prisma_1.default.task.findMany({
            where: {
                userId: friend.id,
                recurrence: 'DAILY',
                status: 'ACTIVE',
            },
            include: {
                completions: {
                    where: { completionDate: friendToday },
                },
            },
        });
        const match = (0, fuzzyMatchService_1.findBestMatchingTask)(completedTaskTitle, friendTasks);
        if (match.match && match.confidence >= 0.6) {
            const matchedTask = match.match;
            // Has the friend completed their matching task today?
            const friendCompletedMatchingTask = matchedTask.completions.length > 0;
            if (!friendCompletedMatchingTask) {
                // Friend hasn't completed their matching task today!
                const emailContent = (0, emailService_1.buildFriendTaskActivityEmail)({
                    recipientName: friend.name,
                    friendName: completedUser.name,
                    taskTitle: matchedTask.title,
                    studyNote: studyNote || undefined,
                });
                const taskEventKey = `FRIEND_TASK:${completedUserId}:${friend.id}:${matchedTask.id}:${friendToday}`;
                await createNotification({
                    userId: friend.id,
                    category: client_1.NotificationCategory.FRIEND_TASK_ACTIVITY,
                    title: `${completedUser.name} completed ${completedTaskTitle}`,
                    message: `Your friend ${completedUser.name} completed their ${completedTaskTitle} task today, but you haven't completed your matching task (${matchedTask.title}) yet.`,
                    friendId: completedUser.id,
                    taskId: matchedTask.id,
                    actionUrl: `/tasks`,
                    eventKey: taskEventKey,
                    emailSubject: emailContent.subject,
                    emailText: emailContent.text,
                });
            }
        }
    }
}
