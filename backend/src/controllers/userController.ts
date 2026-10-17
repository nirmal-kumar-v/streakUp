import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { isValidTimezone, SUPPORTED_TIMEZONES, DEFAULT_TIMEZONE } from '../services/timezoneService';
import { recalculateUserStreaks } from '../services/streakService';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  profileImage: z.string().max(500).optional().nullable(),
  timezone: z.string().optional(),
});

/**
 * Get public profile by username
 */
export async function getPublicProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.userId;

    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required.' });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { normalizedUsername },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        _count: {
          select: {
            taskCompletions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: `User @${username} not found.` });
    }

    // Determine relationship status relative to current user
    let relationshipStatus = 'NONE';
    let requestId: string | null = null;

    if (currentUserId) {
      if (currentUserId === user.id) {
        relationshipStatus = 'SELF';
      } else {
        const [u1, u2] = currentUserId < user.id ? [currentUserId, user.id] : [user.id, currentUserId];
        const friendship = await prisma.friendship.findUnique({
          where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
        });

        if (friendship) {
          relationshipStatus = 'FRIENDS';
        } else {
          const sent = await prisma.friendRequest.findFirst({
            where: { senderId: currentUserId, receiverId: user.id, status: 'PENDING' }
          });
          if (sent) {
            relationshipStatus = 'REQUEST_SENT';
            requestId = sent.id;
          } else {
            const received = await prisma.friendRequest.findFirst({
              where: { senderId: user.id, receiverId: currentUserId, status: 'PENDING' }
            });
            if (received) {
              relationshipStatus = 'REQUEST_RECEIVED';
              requestId = received.id;
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalCompletedTasks: user._count.taskCompletions,
        memberSince: user.createdAt,
        relationshipStatus,
        requestId
      }
    });
  } catch (err: any) {
    console.error('getPublicProfile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve public profile.' });
  }
}

/**
 * Update user settings (display name, avatar, timezone)
 */
export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const parseResult = updateProfileSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid profile settings data'
      });
    }

    const { name, profileImage, timezone } = parseResult.data;
    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
    }
    if (timezone !== undefined) {
      if (!isValidTimezone(timezone)) {
        return res.status(400).json({
          success: false,
          error: `Invalid timezone identifier: ${timezone}`
        });
      }
      updateData.timezone = timezone;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        timezone: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
      }
    });

    // If timezone changed, recalculate streak with new timezone boundaries
    if (timezone) {
      await recalculateUserStreaks(prisma, userId, timezone);
    }

    return res.json({
      success: true,
      message: 'Profile settings updated successfully.',
      user: updatedUser
    });
  } catch (err: any) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile settings.' });
  }
}

/**
 * Get supported timezones
 */
export async function getTimezones(_req: any, res: Response) {
  return res.json({
    success: true,
    timezones: SUPPORTED_TIMEZONES,
    defaultTimezone: DEFAULT_TIMEZONE
  });
}
