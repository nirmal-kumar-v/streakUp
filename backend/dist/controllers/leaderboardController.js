"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        const { loadAllDeletedAccounts } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
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
        // Calculate tasks completed today for each user in page with a single batched query
        const userIds = users.map((u) => u.id);
        const todayCompletions = userIds.length > 0 ? await prisma_1.default.taskCompletion.findMany({
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
            const todayDateStr = (0, timezoneService_1.getLocalDateString)(u.timezone || 'Asia/Kolkata');
            const tasksCompletedToday = todayCompletions.filter((c) => c.userId === u.id && c.completionDate === todayDateStr).length;
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
        const { loadAllDeletedAccounts: loadDelFriends } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const deletedUserIdsSet = new Set(loadDelFriends()
            .filter((a) => a.status === 'DELETED')
            .map((a) => a.userId));
        const activeCohortIds = allCohortIds.filter((id) => !deletedUserIdsSet.has(id));
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
        const friendTodayCompletions = displayedCohortIds.length > 0 ? await prisma_1.default.taskCompletion.findMany({
            where: {
                userId: { in: displayedCohortIds },
            },
            select: {
                userId: true,
                completionDate: true,
            },
        }) : [];
        const friendsLeaderboard = users.map((u, idx) => {
            const todayDateStr = (0, timezoneService_1.getLocalDateString)(u.timezone || 'Asia/Kolkata');
            const tasksCompletedToday = friendTodayCompletions.filter((c) => c.userId === u.id && c.completionDate === todayDateStr).length;
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
        });
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
