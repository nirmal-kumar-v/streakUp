import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../services/timezoneService';
import { compareTaskTitles } from '../services/fuzzyMatchService';
import { isTaskVisibleToUser } from '../utils/taskPrivacy';

/**
 * Helper to get all accepted friend IDs for a user
 */
export async function getAcceptedFriendUserIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }]
    },
    select: { user1Id: true, user2Id: true }
  });

  return friendships.map(f => (f.user1Id === userId ? f.user2Id : f.user1Id));
}

/**
 * Check if two users are accepted friends
 */
export async function areFriends(user1Id: string, user2Id: string): Promise<boolean> {
  if (user1Id === user2Id) return true;
  const [u1, u2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
  const friendship = await prisma.friendship.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
  });
  return !!friendship;
}

/**
 * GET /api/friends/tasks
 * Returns accepted friends' visible tasks, streaks, freeze status, and study notes.
 * Strictly forbidden to strangers and logged-out visitors.
 */
export async function getFriendsTasks(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const friendIds = await getAcceptedFriendUserIds(userId);

    if (friendIds.length === 0) {
      return res.json({
        success: true,
        friendsTasks: []
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });
    const viewer = { id: userId, username: currentUser?.username };

    const friends = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        timezone: true,
        currentStreak: true,
        longestStreak: true,
        tasks: {
          where: { status: 'ACTIVE' },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            userId: true,
            title: true,
            description: true,
            category: true,
            priority: true,
            recurrence: true,
            dueTime: true,
            currentStreak: true,
            longestStreak: true,
            freezeBalance: true,
            freezeRechargeDays: true,
            hiddenFrom: true,
            visibleOnlyTo: true,
            groupId: true,
            group: {
              select: {
                hiddenFrom: true,
              },
            },
            completions: {
              orderBy: { completionDate: 'desc' },
              take: 5,
              select: {
                id: true,
                completionDate: true,
                completedAt: true,
                studyNote: true
              }
            }
          }
        }
      }
    });

    const friendsTasks = friends.map(friend => {
      const todayDateStr = getLocalDateString(friend.timezone || 'Asia/Kolkata');

      // Filter tasks by privacy rules (hiddenFrom & visibleOnlyTo)
      const visibleTasks = friend.tasks.filter(task => isTaskVisibleToUser(task, viewer));

      const tasksWithStatus = visibleTasks.map(task => {
        const completedToday = task.completions.some(c => c.completionDate === todayDateStr);
        const todayCompletion = task.completions.find(c => c.completionDate === todayDateStr);

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          recurrence: task.recurrence,
          dueTime: task.dueTime,
          currentStreak: task.currentStreak,
          longestStreak: task.longestStreak,
          freezeBalance: task.freezeBalance,
          freezeRechargeDays: task.freezeRechargeDays,
          completedToday,
          todayStudyNote: todayCompletion?.studyNote || null,
          recentCompletions: task.completions
        };
      });

      return {
        friend: {
          id: friend.id,
          name: friend.name,
          username: friend.username,
          profileImage: friend.profileImage,
          currentStreak: friend.currentStreak,
          longestStreak: friend.longestStreak
        },
        tasks: tasksWithStatus
      };
    });

    return res.json({
      success: true,
      friendsTasks
    });
  } catch (err: any) {
    console.error('getFriendsTasks error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve friends tasks.' });
  }
}

/**
 * GET /api/friends/study-activity
 * Returns study notes and accomplishments from accepted friends and self.
 * Strictly friends only. Replaces public feed.
 */
export async function getFriendsStudyActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const friendIds = await getAcceptedFriendUserIds(userId);
    // Include self and friends
    const allowedUserIds = [userId, ...friendIds];

    const totalCompletions = await prisma.taskCompletion.count({
      where: {
        userId: { in: allowedUserIds },
        studyNote: { not: null }
      }
    });

    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId: { in: allowedUserIds },
        studyNote: { not: null }
      },
      orderBy: { completedAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true
          }
        },
        task: {
          select: {
            id: true,
            userId: true,
            title: true,
            category: true,
            currentStreak: true,
            recurrence: true,
            hiddenFrom: true,
            visibleOnlyTo: true,
            groupId: true,
            group: {
              select: {
                hiddenFrom: true,
              },
            },
          }
        },
        reactions: {
          select: {
            id: true,
            userId: true,
            emoji: true
          }
        }
      }
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });
    const viewer = { id: userId, username: currentUser?.username };

    const visibleCompletions = completions.filter(c => {
      if (!c.task) return true;
      return isTaskVisibleToUser(c.task, viewer);
    });

    const activity = visibleCompletions.map(c => {
      const counts: Record<string, number> = { FIRE: 0, STRONG: 0, CLAP: 0, CELEBRATE: 0 };
      const userReactions: string[] = [];
      for (const r of c.reactions) {
        if (counts[r.emoji] !== undefined) counts[r.emoji]++;
        if (r.userId === userId && !userReactions.includes(r.emoji)) {
          userReactions.push(r.emoji);
        }
      }

      return {
        id: c.id,
        studyNote: c.studyNote,
        completionDate: c.completionDate,
        completedAt: c.completedAt,
        isCurrentUser: c.userId === userId,
        user: c.user,
        task: c.task,
        reactionCounts: counts,
        userReactions,
        totalReactions: c.reactions.length
      };
    });

    return res.json({
      success: true,
      activity,
      pagination: {
        page,
        limit,
        total: totalCompletions,
        totalPages: Math.ceil(totalCompletions / limit)
      }
    });
  } catch (err: any) {
    console.error('getFriendsStudyActivity error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve study activity.' });
  }
}

/**
 * GET /api/tasks/:id/friends-leaderboard
 * Returns task-specific leaderboard for a task and friends' equivalent tasks using fuzzy matching.
 */
export async function getTaskFriendsLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const baseTask = await prisma.task.findUnique({
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

    if (!baseTask) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    // Verify requester is owner or accepted friend of task owner
    const isOwner = baseTask.userId === userId;
    const isFriend = await areFriends(userId, baseTask.userId);

    if (!isOwner && !isFriend) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You must be an accepted friend to access this leaderboard.'
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });
    const viewer = { id: userId, username: currentUser?.username };

    if (!isOwner && !isTaskVisibleToUser(baseTask, viewer)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. This task is not visible to you.'
      });
    }

    // Cohort for comparison: task owner + their accepted friends
    const targetUserId = baseTask.userId;
    const friendIds = await getAcceptedFriendUserIds(targetUserId);
    const cohortUserIds = Array.from(new Set([targetUserId, ...friendIds]));

    // Fetch confirmed and rejected mappings for this task
    const equivalences = await prisma.taskEquivalence.findMany({
      where: {
        OR: [
          { userTaskId: id },
          { friendTaskId: id }
        ]
      }
    });

    const confirmedTaskIds = new Set<string>();
    const rejectedTaskIds = new Set<string>();

    for (const eq of equivalences) {
      const otherTaskId = eq.userTaskId === id ? eq.friendTaskId : eq.userTaskId;
      if (eq.status === 'CONFIRMED') confirmedTaskIds.add(otherTaskId);
      if (eq.status === 'REJECTED') rejectedTaskIds.add(otherTaskId);
    }

    // Fetch active recurring tasks of friends
    const rawFriendTasks = await prisma.task.findMany({
      where: {
        userId: { in: friendIds },
        status: 'ACTIVE',
        recurrence: 'DAILY'
      },
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

    const friendTasks = rawFriendTasks.filter(t => isTaskVisibleToUser(t, viewer));

    const matchingTasks: Array<{
      task: any;
      confidence: number;
      isConfirmed: boolean;
    }> = [];

    const suggestedMatches: Array<{
      taskId: string;
      title: string;
      user: any;
      confidence: number;
      reason: string;
    }> = [];

    for (const fTask of friendTasks) {
      if (rejectedTaskIds.has(fTask.id)) continue;

      if (confirmedTaskIds.has(fTask.id)) {
        matchingTasks.push({ task: fTask, confidence: 1.0, isConfirmed: true });
        continue;
      }

      const matchResult = compareTaskTitles(baseTask.title, fTask.title);

      if (matchResult.isHighConfidence) {
        matchingTasks.push({ task: fTask, confidence: matchResult.confidence, isConfirmed: false });
      } else if (matchResult.isModerateConfidence) {
        suggestedMatches.push({
          taskId: fTask.id,
          title: fTask.title,
          user: fTask.user,
          confidence: matchResult.confidence,
          reason: matchResult.reason
        });
      }
    }

    // Include the base task itself in the leaderboard cohort
    const allParticipants = [
      {
        task: baseTask,
        confidence: 1.0,
        isConfirmed: true
      },
      ...matchingTasks
    ];

    // Build leaderboard entries with today's status and study notes
    const entries = await Promise.all(
      allParticipants.map(async p => {
        const t = p.task;
        const timezone = t.user.timezone || 'Asia/Kolkata';
        const todayDateStr = getLocalDateString(timezone);

        const todayCompletion = await prisma.taskCompletion.findUnique({
          where: {
            taskId_completionDate: {
              taskId: t.id,
              completionDate: todayDateStr
            }
          },
          select: { studyNote: true, completedAt: true }
        });

        return {
          taskId: t.id,
          taskTitle: t.title,
          userId: t.user.id,
          name: t.user.name,
          username: t.user.username,
          profileImage: t.user.profileImage,
          currentStreak: t.currentStreak,
          longestStreak: t.longestStreak,
          completedToday: !!todayCompletion,
          todayStudyNote: todayCompletion?.studyNote || null,
          isCurrentUser: t.userId === userId
        };
      })
    );

    // Rank deterministically: currentStreak desc, then longestStreak desc, then username asc
    entries.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
      return a.username.localeCompare(b.username);
    });

    const rankedLeaderboard = entries.map((entry, idx) => ({
      rank: idx + 1,
      ...entry
    }));

    return res.json({
      success: true,
      taskTitle: baseTask.title,
      leaderboard: rankedLeaderboard,
      suggestedMatches: isOwner ? suggestedMatches : [] // only owner sees suggestions to confirm
    });
  } catch (err: any) {
    console.error('getTaskFriendsLeaderboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve task friends leaderboard.' });
  }
}

/**
 * POST /api/tasks/equivalences/confirm
 * Confirms equivalence between user's task and a friend's task.
 */
export async function confirmTaskEquivalence(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { userTaskId, friendTaskId } = req.body;

    if (!userTaskId || !friendTaskId) {
      return res.status(400).json({ success: false, error: 'userTaskId and friendTaskId are required.' });
    }

    const userTask = await prisma.task.findUnique({ where: { id: userTaskId } });
    if (!userTask || userTask.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized. You do not own userTask.' });
    }

    const friendTask = await prisma.task.findUnique({ where: { id: friendTaskId } });
    if (!friendTask) {
      return res.status(404).json({ success: false, error: 'Friend task not found.' });
    }

    const isFriend = await areFriends(userId, friendTask.userId);
    if (!isFriend) {
      return res.status(403).json({ success: false, error: 'Cannot map task of a non-friend.' });
    }

    const match = compareTaskTitles(userTask.title, friendTask.title);

    await prisma.taskEquivalence.upsert({
      where: {
        userId_userTaskId_friendTaskId: {
          userId,
          userTaskId,
          friendTaskId
        }
      },
      update: {
        status: 'CONFIRMED',
        confidence: match.confidence,
        confirmedByUserId: userId
      },
      create: {
        userId,
        friendId: friendTask.userId,
        userTaskId,
        friendTaskId,
        status: 'CONFIRMED',
        confidence: match.confidence,
        confirmedByUserId: userId
      }
    });

    return res.json({
      success: true,
      message: 'Task equivalence confirmed successfully.'
    });
  } catch (err: any) {
    console.error('confirmTaskEquivalence error:', err);
    return res.status(500).json({ success: false, error: 'Failed to confirm task equivalence.' });
  }
}

/**
 * POST /api/tasks/equivalences/reject
 * Rejects equivalence between user's task and a friend's task.
 */
export async function rejectTaskEquivalence(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { userTaskId, friendTaskId } = req.body;

    if (!userTaskId || !friendTaskId) {
      return res.status(400).json({ success: false, error: 'userTaskId and friendTaskId are required.' });
    }

    const userTask = await prisma.task.findUnique({ where: { id: userTaskId } });
    if (!userTask || userTask.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized. You do not own userTask.' });
    }

    const friendTask = await prisma.task.findUnique({ where: { id: friendTaskId } });
    if (!friendTask) {
      return res.status(404).json({ success: false, error: 'Friend task not found.' });
    }

    await prisma.taskEquivalence.upsert({
      where: {
        userId_userTaskId_friendTaskId: {
          userId,
          userTaskId,
          friendTaskId
        }
      },
      update: {
        status: 'REJECTED',
        confirmedByUserId: userId
      },
      create: {
        userId,
        friendId: friendTask.userId,
        userTaskId,
        friendTaskId,
        status: 'REJECTED',
        confidence: 0,
        confirmedByUserId: userId
      }
    });

    return res.json({
      success: true,
      message: 'Task equivalence rejected.'
    });
  } catch (err: any) {
    console.error('rejectTaskEquivalence error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reject task equivalence.' });
  }
}
