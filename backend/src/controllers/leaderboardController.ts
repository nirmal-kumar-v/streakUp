import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../services/timezoneService';
import { ensureUserStreakCurrent } from '../services/streakService';
import { isDatabaseConnectionError, DB_CONNECTION_NOTICE } from '../utils/dbError';
import { getUserLeaderboardLimit } from '../services/adminConfigService';

/**
 * Global Leaderboard (Public access, optional authentication)
 * Supports type: 'streak' (default) or 'points' (Requirement 11)
 */
export async function getGlobalLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    const userLimit = currentUserId ? getUserLeaderboardLimit(currentUserId) : 10;
    const type = req.query.type === 'points' ? 'points' : 'streak';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || userLimit));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const skip = (page - 1) * limit;

    const where: any = {};
    const { loadAllDeletedAccounts } = await import('../services/deletedAccountService');
    const deletedUserIds = loadAllDeletedAccounts()
      .filter((a) => a.status === 'DELETED')
      .map((a) => a.userId);

    if (deletedUserIds.length > 0) {
      where.id = { notIn: deletedUserIds };
    }
    if (search) {
      where.normalizedUsername = { contains: search };
    }

    // Total count of qualifying users
    const totalUsers = await prisma.user.count({ where });

    // Deterministic sorting based on type
    const orderBy: any = type === 'points'
      ? [
          { points: 'desc' },
          { currentStreak: 'desc' },
          { longestStreak: 'desc' },
          { username: 'asc' }
        ]
      : [
          { currentStreak: 'desc' },
          { longestStreak: 'desc' },
          { points: 'desc' },
          { username: 'asc' }
        ];

    // Fetch ranked users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        points: true,
        timezone: true,
        createdAt: true,
        _count: {
          select: {
            taskCompletions: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    });

    // Calculate tasks completed today for each user in page with a single batched query
    const userIds = users.map((u) => u.id);
    const todayCompletions = userIds.length > 0 ? await prisma.taskCompletion.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        completionDate: true,
      },
    }) : [];

    const rankedUsers = users.map((u, idx) => {
      const rank = skip + idx + 1;
      const todayDateStr = getLocalDateString(u.timezone || 'Asia/Kolkata');
      const tasksCompletedToday = todayCompletions.filter(
        (c) => c.userId === u.id && c.completionDate === todayDateStr
      ).length;

      return {
        rank,
        id: u.id,
        name: u.name,
        username: u.username,
        profileImage: u.profileImage,
        currentStreak: u.currentStreak,
        longestStreak: u.longestStreak,
        points: u.points,
        totalCompletedTasks: u._count.taskCompletions,
        tasksCompletedToday,
        isCurrentUser: currentUserId ? u.id === currentUserId : false,
        memberSince: u.createdAt
      };
    });

    // If user is authenticated, compute their exact global rank if not in the current page
    let currentUserRankInfo = null;
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          id: true,
          name: true,
          username: true,
          profileImage: true,
          currentStreak: true,
          longestStreak: true,
          points: true,
          timezone: true,
          _count: { select: { taskCompletions: true } }
        }
      });

      if (currentUser) {
        let higherRankCount = 0;
        if (type === 'points') {
          higherRankCount = await prisma.user.count({
            where: {
              OR: [
                { points: { gt: currentUser.points } },
                {
                  AND: [
                    { points: currentUser.points },
                    { currentStreak: { gt: currentUser.currentStreak } }
                  ]
                },
                {
                  AND: [
                    { points: currentUser.points },
                    { currentStreak: currentUser.currentStreak },
                    { longestStreak: { gt: currentUser.longestStreak } }
                  ]
                },
                {
                  AND: [
                    { points: currentUser.points },
                    { currentStreak: currentUser.currentStreak },
                    { longestStreak: currentUser.longestStreak },
                    { username: { lt: currentUser.username } }
                  ]
                }
              ]
            }
          });
        } else {
          higherRankCount = await prisma.user.count({
            where: {
              OR: [
                { currentStreak: { gt: currentUser.currentStreak } },
                {
                  AND: [
                    { currentStreak: currentUser.currentStreak },
                    { longestStreak: { gt: currentUser.longestStreak } }
                  ]
                },
                {
                  AND: [
                    { currentStreak: currentUser.currentStreak },
                    { longestStreak: currentUser.longestStreak },
                    { points: { gt: currentUser.points } }
                  ]
                },
                {
                  AND: [
                    { currentStreak: currentUser.currentStreak },
                    { longestStreak: currentUser.longestStreak },
                    { points: currentUser.points },
                    { username: { lt: currentUser.username } }
                  ]
                }
              ]
            }
          });
        }

        const todayDateStr = getLocalDateString(currentUser.timezone || 'Asia/Kolkata');
        const tasksCompletedToday = await prisma.taskCompletion.count({
          where: {
            userId: currentUser.id,
            completionDate: todayDateStr
          }
        });

        currentUserRankInfo = {
          rank: higherRankCount + 1,
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          profileImage: currentUser.profileImage,
          currentStreak: currentUser.currentStreak,
          longestStreak: currentUser.longestStreak,
          points: currentUser.points,
          totalCompletedTasks: currentUser._count.taskCompletions,
          tasksCompletedToday,
          isCurrentUser: true
        };
      }
    }

    return res.json({
      success: true,
      type,
      leaderboard: rankedUsers,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      },
      currentUserRankInfo,
      userLeaderboardLimit: userLimit
    });
  } catch (err: any) {
    if (isDatabaseConnectionError(err)) {
      console.warn('⚠️ Leaderboard DB query failed: PostgreSQL not connected yet.');
      return res.json({
        success: true,
        leaderboard: [],
        pagination: {
          page: 1,
          limit: 20,
          totalUsers: 0,
          totalPages: 0
        },
        currentUserRankInfo: null,
        isDbConnected: false,
        message: DB_CONNECTION_NOTICE
      });
    }
    console.error('getGlobalLeaderboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve global leaderboard.' });
  }
}

/**
 * Friends Leaderboard (Authenticated access required)
 * Supports type: 'streak' (default) or 'points'
 */
export async function getFriendsLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const type = req.query.type === 'points' ? 'points' : 'streak';

    // Get all accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      select: {
        user1Id: true,
        user2Id: true
      }
    });

    const friendUserIds = friendships.map(f => (f.user1Id === userId ? f.user2Id : f.user1Id));
    // Include current user in friends leaderboard!
    const allCohortIds = Array.from(new Set([...friendUserIds, userId]));

    const { loadAllDeletedAccounts: loadDelFriends } = await import('../services/deletedAccountService');
    const deletedUserIdsSet = new Set(
      loadDelFriends()
        .filter((a) => a.status === 'DELETED')
        .map((a) => a.userId)
    );
    const activeCohortIds = allCohortIds.filter((id) => !deletedUserIdsSet.has(id));

    const orderBy: any = type === 'points'
      ? [
          { points: 'desc' },
          { currentStreak: 'desc' },
          { longestStreak: 'desc' },
          { username: 'asc' }
        ]
      : [
          { currentStreak: 'desc' },
          { longestStreak: 'desc' },
          { points: 'desc' },
          { username: 'asc' }
        ];

    const users = await prisma.user.findMany({
      where: {
        id: { in: activeCohortIds }
      },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        points: true,
        timezone: true,
        _count: {
          select: {
            taskCompletions: true
          }
        }
      },
      orderBy
    });

    // Calculate tasks completed today for each friend with a single batched query
    const displayedCohortIds = users.map((u) => u.id);
    const friendTodayCompletions = displayedCohortIds.length > 0 ? await prisma.taskCompletion.findMany({
      where: {
        userId: { in: displayedCohortIds },
      },
      select: {
        userId: true,
        completionDate: true,
      },
    }) : [];

    const friendsLeaderboard = await Promise.all(
      users.map(async (u) => {
        const todayDateStr = getLocalDateString(u.timezone || 'Asia/Kolkata');
        const tasksCompletedToday = friendTodayCompletions.filter(
          (c) => c.userId === u.id && c.completionDate === todayDateStr
        ).length;

        let currentStreak = u.currentStreak;
        let longestStreak = u.longestStreak;
        if (currentStreak > 0 && tasksCompletedToday === 0) {
          const fresh = await ensureUserStreakCurrent(prisma, u);
          currentStreak = fresh.currentStreak;
          longestStreak = fresh.longestStreak;
        }

        return {
          rank: 0,
          id: u.id,
          name: u.name,
          username: u.username,
          profileImage: u.profileImage,
          currentStreak,
          longestStreak,
          points: u.points,
          totalCompletedTasks: u._count.taskCompletions,
          tasksCompletedToday,
          isCurrentUser: u.id === userId
        };
      })
    );

    // Re-sort accurately in case any stale streak was refreshed to 0
    if (type === 'points') {
      friendsLeaderboard.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        return a.username.localeCompare(b.username);
      });
    } else {
      friendsLeaderboard.sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        if (b.points !== a.points) return b.points - a.points;
        return a.username.localeCompare(b.username);
      });
    }

    friendsLeaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    const currentUserEntry = friendsLeaderboard.find(e => e.isCurrentUser) || null;

    return res.json({
      success: true,
      type,
      leaderboard: friendsLeaderboard,
      totalParticipants: friendsLeaderboard.length,
      currentUserEntry
    });
  } catch (err: any) {
    if (isDatabaseConnectionError(err)) {
      return res.status(503).json({ success: false, error: DB_CONNECTION_NOTICE });
    }
    console.error('getFriendsLeaderboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve friends leaderboard.' });
  }
}
