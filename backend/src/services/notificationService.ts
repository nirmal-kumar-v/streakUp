import prisma from '../config/prisma';
import {
  NotificationCategory,
  FreezeScope,
  User,
  Task,
} from '@prisma/client';
import { getTodayInTimezone } from './timezoneService';
import { findBestMatchingTask } from './fuzzyMatchService';
import {
  sendEmail,
  buildOverallMilestoneEmail,
  buildTaskMilestoneEmail,
  buildMyMilestoneEmail,
  buildFriendOverallActivityEmail,
  buildFriendTaskActivityEmail,
} from './emailService';

// Milestone schedule required by Section 10:
// 5, 10, 25, 50, 100, and every additional 50 days after 100 (150, 200, 250, 300...)
export function isQualifyingMilestone(streak: number): boolean {
  if (streak === 5 || streak === 10 || streak === 25 || streak === 50 || streak === 100) {
    return true;
  }
  if (streak > 100 && streak % 50 === 0) {
    return true;
  }
  return false;
}

export interface CreateNotificationParams {
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  friendId?: string | null;
  taskId?: string | null;
  actionUrl?: string | null;
  eventKey?: string | null;
  emailSubject?: string;
  emailHtml?: string;
  emailText?: string;
}

/**
 * Ensures a user has a NotificationPreference record in DB, returning default settings if new.
 */
export async function getOrCreateNotificationPreferences(userId: string) {
  let pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    pref = await prisma.notificationPreference.create({
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
export async function createNotification(params: CreateNotificationParams) {
  const {
    userId,
    category,
    title,
    message,
    friendId,
    taskId,
    actionUrl,
    eventKey,
    emailSubject,
    emailHtml,
    emailText,
  } = params;

  // 1. Idempotency Check on eventKey
  if (eventKey) {
    const existing = await prisma.notification.findFirst({
      where: { userId, eventKey },
    });
    if (existing) {
      return existing; // Duplicate prevented!
    }
  }

  // 2. Fetch User & Preferences
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const pref = await getOrCreateNotificationPreferences(userId);

  // 3. Create In-App Notification (if in-app channel enabled)
  let notification = null;
  if (pref.inAppNotificationsEnabled) {
    notification = await prisma.notification.create({
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
    if (!pref.emailNotificationsEnabled) return false;
    switch (category) {
      case NotificationCategory.OVERALL_REMINDER:
        return pref.overallStreakRemindersEmail;
      case NotificationCategory.TASK_REMINDER:
        return pref.taskRemindersEmail;
      case NotificationCategory.FRIEND_OVERALL_ACTIVITY:
        return pref.friendOverallActivityAlerts;
      case NotificationCategory.FRIEND_TASK_ACTIVITY:
        return pref.friendTaskActivityAlerts;
      case NotificationCategory.FRIEND_OVERALL_MILESTONE:
        return pref.friendOverallMilestones;
      case NotificationCategory.FRIEND_TASK_MILESTONE:
        return pref.friendTaskMilestones;
      case NotificationCategory.MY_MILESTONE:
        return pref.myMilestonesEmail;
      case NotificationCategory.SYSTEM:
        return true;
      default:
        return false;
    }
  };

  if (isEmailCategoryEnabled() && emailSubject && emailText) {
    // Determine destination email (custom verified email or user registered email)
    const destinationEmail =
      pref.customNotificationEmail && pref.isCustomEmailVerified
        ? pref.customNotificationEmail
        : user.email;

    const emailIdempotencyKey = eventKey ? `EMAIL:${eventKey}` : `EMAIL:${userId}:${Date.now()}`;

    // Dispatch plain-text email asynchronously without blocking the response
    sendEmail({
      userId,
      recipientEmail: destinationEmail,
      category,
      subject: emailSubject,
      text: emailText,
      idempotencyKey: emailIdempotencyKey,
    }).catch((err) => {
      console.error('[NotificationService] Email dispatch error:', err);
    });
  }

  return notification;
}

/**
 * Checks for streak milestones and creates idempotent records & notifications
 * for the user and their accepted friends.
 */
export async function checkAndTriggerMilestones(params: {
  userId: string;
  scope: FreezeScope;
  scopeId: string; // 'OVERALL' or task ID
  currentStreak: number;
  taskTitle?: string;
}) {
  const { userId, scope, scopeId, currentStreak, taskTitle } = params;

  if (!isQualifyingMilestone(currentStreak)) {
    return;
  }

  const scopeKey = scope === FreezeScope.OVERALL ? 'OVERALL' : `TASK:${scopeId}`;

  // 1. Idempotency: Has this milestone already been recorded?
  const existingMilestone = await prisma.milestoneEvent.findUnique({
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
  await prisma.milestoneEvent.create({
    data: {
      userId,
      scope,
      scopeKey,
      milestone: currentStreak,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // 3. User's Own Milestone Notification
  const scopeDesc = scope === FreezeScope.OVERALL ? 'overall' : taskTitle || 'task';
  const myEmail = buildMyMilestoneEmail({
    name: user.name,
    scopeDescription: scopeDesc,
    milestone: currentStreak,
  });

  await createNotification({
    userId,
    category: NotificationCategory.MY_MILESTONE,
    title: `🎉 ${currentStreak}-Day Streak Milestone!`,
    message: `Congratulations! You reached an incredible ${currentStreak}-day ${scopeDesc} streak on StreakUp. Keep up the dedication!`,
    taskId: scope === FreezeScope.TASK ? scopeId : null,
    actionUrl: scope === FreezeScope.TASK ? `/tasks` : `/dashboard`,
    eventKey: `MILESTONE:SELF:${userId}:${scopeKey}:${currentStreak}`,
    emailSubject: myEmail.subject,
    emailText: myEmail.text,
  });

  // 4. Find all Accepted Friends to notify them
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const friends: User[] = friendships.map((f) => (f.user1Id === userId ? f.user2 : f.user1));

  for (const friend of friends) {
    if (scope === FreezeScope.OVERALL) {
      // Overall milestone alert for friend
      const friendEmail = buildOverallMilestoneEmail({
        friendName: user.name,
        milestone: currentStreak,
      });

      await createNotification({
        userId: friend.id,
        category: NotificationCategory.FRIEND_OVERALL_MILESTONE,
        title: `🏆 ${user.name} reached a ${currentStreak}-day overall streak!`,
        message: `Your friend ${user.name} has hit an inspiring ${currentStreak}-day overall streak. Send them a congratulations!`,
        friendId: user.id,
        actionUrl: `/profile/${user.username}`,
        eventKey: `MILESTONE:FRIEND_OVERALL:${user.id}:${friend.id}:${currentStreak}`,
        emailSubject: friendEmail.subject,
        emailText: friendEmail.text,
      });
    } else {
      // Task milestone: check if friend has a matching task or is authorized
      const friendTasks = await prisma.task.findMany({
        where: {
          userId: friend.id,
          recurrence: 'DAILY',
          status: 'ACTIVE',
        },
      });

      const match = findBestMatchingTask(taskTitle || '', friendTasks);

      // Only notify friends who share this matching habit/activity
      if (match.match && match.confidence >= 0.6) {
        const friendEmail = buildTaskMilestoneEmail({
          friendName: user.name,
          taskTitle: taskTitle || 'task',
          milestone: currentStreak,
        });

        await createNotification({
          userId: friend.id,
          category: NotificationCategory.FRIEND_TASK_MILESTONE,
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
export async function checkAndTriggerFriendActivityAlerts(params: {
  completedUserId: string;
  completedTaskId: string;
  completedTaskTitle: string;
  studyNote?: string | null;
}) {
  const { completedUserId, completedTaskId, completedTaskTitle, studyNote } = params;

  const completedUser = await prisma.user.findUnique({
    where: { id: completedUserId },
  });
  if (!completedUser) return;

  // Find all accepted friends
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ user1Id: completedUserId }, { user2Id: completedUserId }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const friends: User[] = friendships.map((f) => (f.user1Id === completedUserId ? f.user2 : f.user1));

  for (const friend of friends) {
    const friendToday = getTodayInTimezone(friend.timezone || 'Asia/Kolkata');

    // 1. Overall Activity Alert
    // Check if recipient (friend) has completed ANY task today
    const friendOverallCompletions = await prisma.taskCompletion.count({
      where: {
        userId: friend.id,
        completionDate: friendToday,
      },
    });

    if (friendOverallCompletions === 0) {
      // Recipient has not completed any task today!
      const emailContent = buildFriendOverallActivityEmail({
        recipientName: friend.name,
        friendName: completedUser.name,
      });

      // Deduplicate: At most once per completedUser, recipient, and friend's local date
      const overallEventKey = `FRIEND_OVERALL:${completedUserId}:${friend.id}:${friendToday}`;

      await createNotification({
        userId: friend.id,
        category: NotificationCategory.FRIEND_OVERALL_ACTIVITY,
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
    const friendTasks = await prisma.task.findMany({
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

    const match = findBestMatchingTask(completedTaskTitle, friendTasks);

    if (match.match && match.confidence >= 0.6) {
      const matchedTask = match.match;

      // Has the friend completed their matching task today?
      const friendCompletedMatchingTask = matchedTask.completions.length > 0;

      if (!friendCompletedMatchingTask) {
        // Friend hasn't completed their matching task today!
        const emailContent = buildFriendTaskActivityEmail({
          recipientName: friend.name,
          friendName: completedUser.name,
          taskTitle: matchedTask.title,
          studyNote: studyNote || undefined,
        });

        const taskEventKey = `FRIEND_TASK:${completedUserId}:${friend.id}:${matchedTask.id}:${friendToday}`;

        await createNotification({
          userId: friend.id,
          category: NotificationCategory.FRIEND_TASK_ACTIVITY,
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
