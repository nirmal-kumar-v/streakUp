import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/prisma';
import {
  getAllGamesForMember,
  getSingleGameForMember,
  completeMemberGame,
  getGameLeaderboard,
  isLinkedInName,
  normalizeGameId,
  LINKEDIN_GAMES,
} from '../services/linkedInGameService';
import { DEFAULT_TIMEZONE } from '../services/timezoneService';

/**
 * Validates whether the user is a valid member/owner of the group
 * and checks if the group is identified as LinkedIn.
 */
async function validateGroupMembership(groupId: string, userId: string) {
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
      return res.status(validation.status).json({ success: false, error: validation.error });
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
      return res.status(validation.status).json({ success: false, error: validation.error });
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
      return res.status(validation.status).json({ success: false, error: validation.error });
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
 * GET /api/groups/:id/linkedin-games/:gameId/leaderboard
 * Separate leaderboard for each individual game
 */
export async function getLinkedInGameLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId, gameId } = req.params;
    const userId = req.user!.userId;

    const validation = await validateGroupMembership(groupId, userId);
    if ('error' in validation) {
      return res.status(validation.status).json({ success: false, error: validation.error });
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
