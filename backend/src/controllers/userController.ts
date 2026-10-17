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
 * Upload profile image (JPEG, PNG, WebP - max 5MB)
 * Supports persistent Base64 Data URI storage in PostgreSQL (zero-dependency cloud persistence)
 */
export async function uploadProfileImage(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please select an image file to upload.'
      });
    }

    // Validate Data URI format and MIME type: jpeg, png, webp
    const match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported image format. Allowed formats are JPEG, PNG, and WebP.'
      });
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];

    // Check size limit: max 5MB (Base64 string ~ 7MB)
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    if (sizeInBytes > MAX_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds the 5 MB limit. Your file is ${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB.`
      });
    }

    // Validate minimum content size (empty or corrupt images)
    if (sizeInBytes < 64) {
      return res.status(400).json({
        success: false,
        error: 'The uploaded file is empty or corrupted.'
      });
    }

    // Save persistent image data in PostgreSQL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: imageBase64 },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true,
        updatedAt: true
      }
    });

    return res.json({
      success: true,
      message: 'Profile image updated successfully.',
      profileImage: updatedUser.profileImage,
      user: updatedUser
    });
  } catch (err: any) {
    console.error('uploadProfileImage error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload profile image.' });
  }
}

/**
 * Remove profile image
 */
export async function removeProfileImage(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: null },
      select: {
        id: true,
        name: true,
        username: true,
        profileImage: true
      }
    });

    return res.json({
      success: true,
      message: 'Profile image removed.',
      profileImage: null,
      user: updatedUser
    });
  } catch (err: any) {
    console.error('removeProfileImage error:', err);
    return res.status(500).json({ success: false, error: 'Failed to remove profile image.' });
  }
}

/**
 * Change Password
 */
export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Both current password and new password are required.'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Verify current password
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err: any) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
}

/**
 * Change Username (case-insensitive uniqueness check, once every 14 days limit)
 */
export async function changeUsername(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { newUsername } = req.body;

    if (!newUsername || typeof newUsername !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'New username is required.'
      });
    }

    const trimmedUsername = newUsername.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 30 characters and contain only letters, numbers, and underscores.'
      });
    }

    const normalizedNew = trimmedUsername.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        normalizedUsername: true,
        lastUsernameChangeAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // If username is unchanged
    if (user.normalizedUsername === normalizedNew) {
      return res.status(400).json({
        success: false,
        error: 'New username is the same as your current username.'
      });
    }

    // Check 14-day rate limit
    if (user.lastUsernameChangeAt) {
      const now = new Date();
      const diffMs = now.getTime() - new Date(user.lastUsernameChangeAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < 14) {
        const remainingDays = Math.ceil(14 - diffDays);
        return res.status(400).json({
          success: false,
          error: `Username can only be changed once every 14 days. You can change your username in ${remainingDays} day${remainingDays > 1 ? 's' : ''}.`
        });
      }
    }

    // Check if new username is already taken
    const existing = await prisma.user.findUnique({
      where: { normalizedUsername: normalizedNew }
    });

    if (existing && existing.id !== userId) {
      return res.status(400).json({
        success: false,
        error: `@${trimmedUsername} is already taken. Please choose another username.`
      });
    }

    // Update username, normalizedUsername, and timestamp
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: trimmedUsername,
        normalizedUsername: normalizedNew,
        lastUsernameChangeAt: new Date()
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        profileImage: true,
        timezone: true,
        currentStreak: true,
        longestStreak: true,
        lastUsernameChangeAt: true
      }
    });

    return res.json({
      success: true,
      message: 'Username changed successfully.',
      user: updatedUser
    });
  } catch (err: any) {
    console.error('changeUsername error:', err);
    return res.status(500).json({ success: false, error: 'Failed to change username.' });
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

