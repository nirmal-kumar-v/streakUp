"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalLeaderboard = getGlobalLeaderboard;
exports.getFriendsLeaderboard = getFriendsLeaderboard;
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const dbError_1 = require("../utils/dbError");
const adminConfigService_1 = require("../services/adminConfigService");
/**
 * Global Leaderboard (Public access, optional authentication)
 * Supports type: 'streak' (default) or 'points' (Requirement 11)
 */
async function getGlobalLeaderboard(req, res) {
    try {
        const currentUserId = req.user?.userId;
        const userLimit = currentUserId ? (0, adminConfigService_1.getUserLeaderboardLimit)(currentUserId) : 10;
        const type = req.query.type === 'points' ? 'points' : 'streak';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || userLimit));
        const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.normalizedUsername = { contains: search };
        }
        // Total count of qualifying users
        const totalUsers = await prisma_1.default.user.count({ where });
        // Deterministic sorting based on type
        const orderBy = type === 'points'
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
        const users = await prisma_1.default.user.findMany({
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
        // Calculate tasks completed today for each user in page
        const rankedUsers = await Promise.all(users.map(async (u, idx) => {
            const rank = skip + idx + 1;
            const todayDateStr = (0, timezoneService_1.getLocalDateString)(u.timezone || 'Asia/Kolkata');
            const tasksCompletedToday = await prisma_1.default.taskCompletion.count({
                where: {
                    userId: u.id,
                    completionDate: todayDateStr
                }
            });
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
        }));
        // If user is authenticated, compute their exact global rank if not in the current page
        let currentUserRankInfo = null;
        if (currentUserId) {
            const currentUser = await prisma_1.default.user.findUnique({
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
                    higherRankCount = await prisma_1.default.user.count({
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
                }
                else {
                    higherRankCount = await prisma_1.default.user.count({
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
                const todayDateStr = (0, timezoneService_1.getLocalDateString)(currentUser.timezone || 'Asia/Kolkata');
                const tasksCompletedToday = await prisma_1.default.taskCompletion.count({
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
    }
    catch (err) {
        if ((0, dbError_1.isDatabaseConnectionError)(err)) {
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
                message: dbError_1.DB_CONNECTION_NOTICE
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
async function getFriendsLeaderboard(req, res) {
    try {
        const userId = req.user.userId;
        const type = req.query.type === 'points' ? 'points' : 'streak';
        // Get all accepted friends
        const friendships = await prisma_1.default.friendship.findMany({
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
        const orderBy = type === 'points'
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
        const users = await prisma_1.default.user.findMany({
            where: {
                id: { in: allCohortIds }
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
        const friendsLeaderboard = await Promise.all(users.map(async (u, idx) => {
            const todayDateStr = (0, timezoneService_1.getLocalDateString)(u.timezone || 'Asia/Kolkata');
            const tasksCompletedToday = await prisma_1.default.taskCompletion.count({
                where: {
                    userId: u.id,
                    completionDate: todayDateStr
                }
            });
            return {
                rank: idx + 1,
                id: u.id,
                name: u.name,
                username: u.username,
                profileImage: u.profileImage,
                currentStreak: u.currentStreak,
                longestStreak: u.longestStreak,
                points: u.points,
                totalCompletedTasks: u._count.taskCompletions,
                tasksCompletedToday,
                isCurrentUser: u.id === userId
            };
        }));
        const currentUserEntry = friendsLeaderboard.find(e => e.isCurrentUser) || null;
        return res.json({
            success: true,
            type,
            leaderboard: friendsLeaderboard,
            totalParticipants: friendsLeaderboard.length,
            currentUserEntry
        });
    }
    catch (err) {
        if ((0, dbError_1.isDatabaseConnectionError)(err)) {
            return res.status(503).json({ success: false, error: dbError_1.DB_CONNECTION_NOTICE });
        }
        console.error('getFriendsLeaderboard error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve friends leaderboard.' });
    }
}
