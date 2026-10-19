"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinkedInGames = getLinkedInGames;
exports.getSingleLinkedInGame = getSingleLinkedInGame;
exports.completeLinkedInGame = completeLinkedInGame;
exports.uncompleteLinkedInGame = uncompleteLinkedInGame;
exports.getLinkedInGameLeaderboard = getLinkedInGameLeaderboard;
exports.setLinkedInGameCommitment = setLinkedInGameCommitment;
const prisma_1 = __importDefault(require("../config/prisma"));
const linkedInGameService_1 = require("../services/linkedInGameService");
const timezoneService_1 = require("../services/timezoneService");
const notificationService_1 = require("../services/notificationService");
const emailService_1 = require("../services/emailService");
const client_1 = require("@prisma/client");
/**
 * Validates whether the user is a valid member/owner of the group
 * and checks if the group is identified as LinkedIn.
 */
async function validateGroupMembership(groupId, userId) {
    const group = await prisma_1.default.group.findUnique({
        where: { id: groupId },
        include: {
            members: {
                where: { userId },
            },
        },
    });
    if (!group) {
        return { error: 'Group not found', status: 404 };
    }
    const isMember = group.ownerId === userId || group.members.length > 0;
    if (!isMember) {
        return { error: 'You must be a member of this group to view game streaks and leaderboards.', status: 403 };
    }
    const isLinkedIn = (0, linkedInGameService_1.isLinkedInName)(group.name);
    if (!isLinkedIn) {
        return { error: 'This group is not a designated LinkedIn group.', status: 400 };
    }
    return { group, isMember: true };
}
/**
 * GET /api/groups/:id/linkedin-games
 * Retrieve all 8 games with independent streaks for the requesting member
 */
async function getLinkedInGames(req, res) {
    try {
        const { id: groupId } = req.params;
        const userId = req.user.userId;
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const games = await (0, linkedInGameService_1.getAllGamesForMember)(groupId, userId, tz);
        return res.json({
            success: true,
            groupId,
            groupName: validation.group.name,
            games,
            totalGamesCount: linkedInGameService_1.LINKEDIN_GAMES.length,
        });
    }
    catch (err) {
        console.error('[getLinkedInGames] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch LinkedIn games.' });
    }
}
/**
 * GET /api/groups/:id/linkedin-games/:gameId
 * Retrieve specific game status and its dedicated leaderboard
 */
async function getSingleLinkedInGame(req, res) {
    try {
        const { id: groupId, gameId } = req.params;
        const userId = req.user.userId;
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game name: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const [gameData, leaderboard] = await Promise.all([
            (0, linkedInGameService_1.getSingleGameForMember)(groupId, userId, normalizedGameId, tz),
            (0, linkedInGameService_1.getGameLeaderboard)(groupId, normalizedGameId),
        ]);
        if (!gameData) {
            return res.status(404).json({ success: false, error: 'Game not found.' });
        }
        return res.json({
            success: true,
            groupId,
            groupName: validation.group.name,
            game: gameData,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[getSingleLinkedInGame] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch game details.' });
    }
}
/**
 * POST /api/groups/:id/linkedin-games/:gameId/complete
 * Complete a specific game independently without affecting any other game or task
 */
async function completeLinkedInGame(req, res) {
    try {
        const { id: groupId, gameId } = req.params;
        const userId = req.user.userId;
        const { studyNote, completionDate } = req.body || {};
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const updatedGame = await (0, linkedInGameService_1.completeMemberGame)(groupId, userId, normalizedGameId, tz, completionDate, studyNote);
        const leaderboard = await (0, linkedInGameService_1.getGameLeaderboard)(groupId, normalizedGameId);
        // Dispatch game completion notification & email directly to the completing user
        prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { name: true },
        }).then((userRecord) => {
            const emailContent = (0, emailService_1.buildTaskCompletionEmail)({
                userName: userRecord?.name || 'Habit Builder',
                taskTitle: `${validation.group.name}: ${updatedGame.name}`,
                currentStreak: updatedGame.currentStreak,
                studyNote,
            });
            (0, notificationService_1.createNotification)({
                userId,
                category: client_1.NotificationCategory.TASK_REMINDER,
                title: `Game Completed: ${updatedGame.name}`,
                message: `You completed "${updatedGame.name}" in ${validation.group.name}! Current streak: ${updatedGame.currentStreak} day${updatedGame.currentStreak === 1 ? '' : 's'}.`,
                actionUrl: `/groups/${groupId}`,
                eventKey: `LI_GAME_COMPLETION:${userId}:${groupId}:${normalizedGameId}:${completionDate || (0, timezoneService_1.getTodayInTimezone)(tz)}`,
                emailSubject: emailContent.subject,
                emailText: emailContent.text,
            }).catch((err) => console.error('[completeLinkedInGame] Notification error:', err));
        }).catch((err) => console.error('[completeLinkedInGame] Fetch user error:', err));
        return res.json({
            success: true,
            message: `${updatedGame.name} completed successfully!`,
            game: updatedGame,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[completeLinkedInGame] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to record game completion.' });
    }
}
/**
 * POST /api/groups/:id/linkedin-games/:gameId/uncomplete
 * Uncomplete a specific LinkedIn game for today
 */
async function uncompleteLinkedInGame(req, res) {
    try {
        const { id: groupId, gameId } = req.params;
        const userId = req.user.userId;
        const { completionDate } = req.body || {};
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const updatedGame = await (0, linkedInGameService_1.uncompleteMemberGame)(groupId, userId, normalizedGameId, tz, completionDate);
        const leaderboard = await (0, linkedInGameService_1.getGameLeaderboard)(groupId, normalizedGameId);
        return res.json({
            success: true,
            message: `${updatedGame.name} completion undone.`,
            game: updatedGame,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[uncompleteLinkedInGame] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to undo game completion.' });
    }
}
/**
 * GET /api/groups/:id/linkedin-games/:gameId/leaderboard
 * Separate leaderboard for each individual game
 */
async function getLinkedInGameLeaderboard(req, res) {
    try {
        const { id: groupId, gameId } = req.params;
        const userId = req.user.userId;
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const leaderboard = await (0, linkedInGameService_1.getGameLeaderboard)(groupId, normalizedGameId);
        return res.json({
            success: true,
            groupId,
            gameId: normalizedGameId,
            leaderboard,
        });
    }
    catch (err) {
        console.error('[getLinkedInGameLeaderboard] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch game leaderboard.' });
    }
}
/**
 * PUT /api/groups/:id/linkedin-games/:gameId/commitment
 * Member individually commits to or uncommits from an individual LinkedIn game
 */
async function setLinkedInGameCommitment(req, res) {
    try {
        const { id: groupId, gameId } = req.params;
        const userId = req.user.userId;
        const { isCommitted } = req.body || {};
        if (typeof isCommitted !== 'boolean') {
            return res.status(400).json({ success: false, error: 'A boolean isCommitted value is required.' });
        }
        const validation = await validateGroupMembership(groupId, userId);
        if ('error' in validation) {
            return res.status(validation.status || 400).json({ success: false, error: validation.error });
        }
        const normalizedGameId = (0, linkedInGameService_1.normalizeGameId)(gameId);
        if (!normalizedGameId) {
            return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const tz = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const updatedGame = await (0, linkedInGameService_1.setGameCommitment)(groupId, userId, normalizedGameId, isCommitted, tz);
        return res.json({
            success: true,
            message: `${updatedGame.name} commitment updated to ${isCommitted ? 'committed' : 'uncommitted'}.`,
            game: updatedGame,
        });
    }
    catch (err) {
        console.error('[setLinkedInGameCommitment] Error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update game commitment.' });
    }
}
