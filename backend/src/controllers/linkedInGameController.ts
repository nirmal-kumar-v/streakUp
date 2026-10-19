import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/prisma';
import {
  getAllGamesForMember,
  getSingleGameForMember,
  completeMemberGame,
  uncompleteMemberGame,
  getGameLeaderboard,
  isLinkedInName,
  normalizeGameId,
  LINKEDIN_GAMES,
  setGameCommitment,
} from '../services/linkedInGameService';
import { DEFAULT_TIMEZONE, getTodayInTimezone } from '../services/timezoneService';
import { createNotification } from '../services/notificationService';
import { NotificationCategory } from '@prisma/client';

interface ValidationSuccess {
  group: any;
  isMember: true;
}

interface ValidationFailure {
  error: string;
  status: number;
}

type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates whether the user is a valid member/owner of the group
 * and checks if the group is identified as LinkedIn.
 */
async function validateGroupMembership(
  groupId: string,
  userId: string
): Promise<ValidationResult> {
  const group = await prisma.group.findUnique({
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

  const isLinkedIn = isLinkedInName(group.name);
  if (!isLinkedIn) {
    return { error: 'This group is not a designated LinkedIn group.', status: 400 };
  }

  return { group, isMember: true };
}

/**
 * GET /api/groups/:id/linkedin-games
 * Retrieve all 8 games with independent streaks for the requesting member
 */
export async function getLinkedInGames(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || DEFAULT_TIMEZONE;

    const games = await getAllGamesForMember(groupId, userId, tz);

    return res.json({
      success: true,
      groupId,
      groupName: validation.group.name,
      games,
      totalGamesCount: LINKEDIN_GAMES.length,
    });
  } catch (err: any) {
    console.error('[getLinkedInGames] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch LinkedIn games.' });
  }
}

/**
 * GET /api/groups/:id/linkedin-games/:gameId
 * Retrieve specific game status and its dedicated leaderboard
 */
export async function getSingleLinkedInGame(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
      return res.status(400).json({ success: false, error: `Invalid LinkedIn game name: ${gameId}` });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || DEFAULT_TIMEZONE;

    const [gameData, leaderboard] = await Promise.all([
      getSingleGameForMember(groupId, userId, normalizedGameId, tz),
      getGameLeaderboard(groupId, normalizedGameId),
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
  } catch (err: any) {
    console.error('[getSingleLinkedInGame] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch game details.' });
  }
}

/**
 * POST /api/groups/:id/linkedin-games/:gameId/complete
 * Complete a specific game independently without affecting any other game or task
 */
export async function completeLinkedInGame(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;
    const { studyNote, completionDate } = req.body || {};

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
      return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || DEFAULT_TIMEZONE;

    const updatedGame = await completeMemberGame(
      groupId,
      userId,
      normalizedGameId,
      tz,
      completionDate,
      studyNote
    );

    const leaderboard = await getGameLeaderboard(groupId, normalizedGameId);

    // In-app notification for game completion history (NO email dispatch)
    createNotification({
      userId,
      category: NotificationCategory.TASK_REMINDER,
      title: `Game Completed: ${updatedGame.name}`,
      message: `You completed "${updatedGame.name}" in ${validation.group.name}! Current streak: ${updatedGame.currentStreak} day${updatedGame.currentStreak === 1 ? '' : 's'}.`,
      actionUrl: `/groups/${groupId}`,
      eventKey: `LI_GAME_COMPLETION:${userId}:${groupId}:${normalizedGameId}:${completionDate || getTodayInTimezone(tz)}`,
    }).catch((err) => console.error('[completeLinkedInGame] Notification error:', err));

    return res.json({
      success: true,
      message: `${updatedGame.name} completed successfully!`,
      game: updatedGame,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[completeLinkedInGame] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to record game completion.' });
  }
}

/**
 * POST /api/groups/:id/linkedin-games/:gameId/uncomplete
 * Uncomplete a specific LinkedIn game for today
 */
export async function uncompleteLinkedInGame(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;
    const { completionDate } = req.body || {};

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
      return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || DEFAULT_TIMEZONE;

    const updatedGame = await uncompleteMemberGame(
      groupId,
      userId,
      normalizedGameId,
      tz,
      completionDate
    );

    const leaderboard = await getGameLeaderboard(groupId, normalizedGameId);

    return res.json({
      success: true,
      message: `${updatedGame.name} completion undone.`,
      game: updatedGame,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[uncompleteLinkedInGame] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to undo game completion.' });
  }
}

/**
 * GET /api/groups/:id/linkedin-games/:gameId/leaderboard
 * Separate leaderboard for each individual game
 */
export async function getLinkedInGameLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
      return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
    }

    const leaderboard = await getGameLeaderboard(groupId, normalizedGameId);

    return res.json({
      success: true,
      groupId,
      gameId: normalizedGameId,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[getLinkedInGameLeaderboard] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch game leaderboard.' });
  }
}

/**
 * PUT /api/groups/:id/linkedin-games/:gameId/commitment
 * Member individually commits to or uncommits from an individual LinkedIn game
 */
export async function setLinkedInGameCommitment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;
    const { isCommitted } = req.body || {};

    if (typeof isCommitted !== 'boolean') {
      return res.status(400).json({ success: false, error: 'A boolean isCommitted value is required.' });
    }

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status || 400).json({ success: false, error: validation.error });
    }

    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) {
      return res.status(400).json({ success: false, error: `Invalid LinkedIn game: ${gameId}` });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || DEFAULT_TIMEZONE;

    const updatedGame = await setGameCommitment(groupId, userId, normalizedGameId, isCommitted, tz);

    return res.json({
      success: true,
      message: `${updatedGame.name} commitment updated to ${isCommitted ? 'committed' : 'uncommitted'}.`,
      game: updatedGame,
    });
  } catch (err: any) {
    console.error('[setLinkedInGameCommitment] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update game commitment.' });
  }
}

