import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AdminAuthenticatedRequest } from '../middleware/adminAuthMiddleware';
import { getTodayInTimezone } from '../services/timezoneService';

const JWT_SECRET = process.env.JWT_SECRET || 'streakup_super_secret_jwt_key_2026_change_in_production';

/**
 * Bootstrap the default admin account if no admin accounts exist
 */
async function ensureDefaultAdmin() {
  const count = await prisma.adminAccount.count();
  if (count === 0) {
    const defaultUsername = (process.env.ADMIN_INITIAL_USERNAME || 'admin').trim().toLowerCase();
    const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'StreakUpAdmin@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);
    const pinHash = await bcrypt.hash('1234', salt);

    await prisma.adminAccount.create({
      data: {
        username: defaultUsername,
        passwordHash,
        sensitivePinHash: pinHash,
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`[Admin] Initial Super Admin account created: @${defaultUsername}`);
  }
}

/**
 * Helper to record administrative audit logs
 */
async function recordAuditLog(params: {
  adminUsername: string;
  action: string;
  targetUserId?: string | null;
  targetUser?: string | null;
  reason: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUsername: params.adminUsername,
        action: params.action,
        targetUserId: params.targetUserId || null,
        targetUser: params.targetUser || null,
        reason: params.reason,
        beforeState: params.beforeState ? JSON.parse(JSON.stringify(params.beforeState)) : null,
        afterState: params.afterState ? JSON.parse(JSON.stringify(params.afterState)) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('[AdminAuditLog] Failed to record audit log:', err);
  }
}

// ==========================================
// AUTHENTICATION & SECURITY
// ==========================================

export async function adminLogin(req: AdminAuthenticatedRequest, res: Response) {
  try {
    await ensureDefaultAdmin();

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUsername },
    });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    const isMatch = await bcrypt.compare(String(password), admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
    }

    // Update last login
    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      message: 'Admin authentication successful.',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        hasSensitivePin: Boolean(admin.sensitivePinHash),
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (err: any) {
    console.error('adminLogin error:', err);
    return res.status(500).json({ success: false, error: 'Internal error during admin login.' });
  }
}

export async function getAdminProfile(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const adminId = req.admin!.adminId;
    const admin = await prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, role: true, sensitivePinHash: true, lastLoginAt: true, createdAt: true },
    });

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    return res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        hasSensitivePin: Boolean(admin.sensitivePinHash),
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve admin profile.' });
  }
}

export async function changeAdminCredentials(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const adminId = req.admin!.adminId;
    const { currentPassword, newPassword, newSensitivePin, reason = 'Admin self credentials update' } = req.body;

    const admin = await prisma.adminAccount.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    if (!currentPassword) {
      return res.status(400).json({ success: false, error: 'Current password is required to update credentials.' });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    const updateData: any = {};
    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(newPassword, salt);
    }

    if (newSensitivePin) {
      if (typeof newSensitivePin !== 'string' || newSensitivePin.length < 4) {
        return res.status(400).json({ success: false, error: 'Sensitive PIN must be at least 4 digits or characters.' });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.sensitivePinHash = await bcrypt.hash(newSensitivePin, salt);
    }

    await prisma.adminAccount.update({
      where: { id: adminId },
      data: updateData,
    });

    await recordAuditLog({
      adminUsername: admin.username,
      action: 'CHANGE_ADMIN_CREDENTIALS',
      reason,
      details: 'Updated admin password and/or sensitive action PIN.',
    } as any);

    return res.json({
      success: true,
      message: 'Admin credentials updated successfully.',
    });
  } catch (err: any) {
    console.error('changeAdminCredentials error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update credentials.' });
  }
}

// ==========================================
// AUDIT LOGS
// ==========================================

export async function getAdminAuditLogs(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { targetUserId, action, page = '1', limit = '30' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (targetUserId) where.targetUserId = String(targetUserId);
    if (action) where.action = String(action);

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err: any) {
    console.error('getAdminAuditLogs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit logs.' });
  }
}

// ==========================================
// USER SEARCH & MANAGEMENT
// ==========================================

export async function searchUsersForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const q = (req.query.q as string || '').trim();

    let whereClause: any = {};
    if (q) {
      const cleanQ = q.toLowerCase().replace(/^@/, '');
      whereClause = {
        OR: [
          { id: { equals: q } },
          { username: { contains: cleanQ, mode: 'insensitive' } },
          { normalizedUsername: { contains: cleanQ } },
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: cleanQ, mode: 'insensitive' } },
        ],
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      take: 25,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        timezone: true,
        currentStreak: true,
        longestStreak: true,
        points: true,
        overallFreezeBalance: true,
        overallFreezeRechargeDays: true,
        lastUsernameChangeAt: true,
        maxStarredNotifications: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            taskCompletions: true,
            groupMemberships: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      users,
    });
  } catch (err: any) {
    console.error('searchUsersForAdmin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to search users.' });
  }
}

export async function getUserDetailsForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            group: {
              select: { id: true, name: true, joinCode: true },
            },
            _count: { select: { completions: true } },
          },
        },
        groupMemberships: {
          include: {
            group: {
              select: { id: true, name: true, joinCode: true, ownerId: true },
            },
          },
        },
        pointLedgers: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        freezeLogs: {
          take: 10,
          orderBy: { usedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Strip passwordHash before returning
    const { passwordHash, ...safeUser } = user;

    return res.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('getUserDetailsForAdmin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve user details.' });
  }
}

// ==========================================
// PRIVILEGED OVERRIDES & CORRECTIONS
// ==========================================

/**
 * Override 14-day username change cooldown
 */
export async function overrideUsernameCooldown(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { newUsername, resetCooldownOnly = false, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const beforeState = {
      username: user.username,
      normalizedUsername: user.normalizedUsername,
      lastUsernameChangeAt: user.lastUsernameChangeAt,
    };

    let updatedUser;
    if (resetCooldownOnly || !newUsername) {
      // Just reset the cooldown so the user can change it immediately
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { lastUsernameChangeAt: null },
        select: { id: true, username: true, lastUsernameChangeAt: true },
      });
    } else {
      const cleanUsername = String(newUsername).trim();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          error: 'Username must be 3-30 characters containing only letters, numbers, and underscores.',
        });
      }
      const norm = cleanUsername.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { normalizedUsername: norm } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ success: false, error: `@${cleanUsername} is already taken by another account.` });
      }

      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          username: cleanUsername,
          normalizedUsername: norm,
          lastUsernameChangeAt: new Date(),
        },
        select: { id: true, username: true, lastUsernameChangeAt: true },
      });
    }

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'USERNAME_COOLDOWN_OVERRIDE',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: updatedUser,
    });

    return res.json({
      success: true,
      message: resetCooldownOnly
        ? `Username 14-day restriction has been cleared for @${user.username}. They can now change it immediately.`
        : `Username updated to @${updatedUser.username} by Admin override.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('overrideUsernameCooldown error:', err);
    return res.status(500).json({ success: false, error: 'Failed to override username cooldown.' });
  }
}

/**
 * Correct overall streak, personal task streak, or group task streak
 */
export async function correctStreaks(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { type, taskId, currentStreak, longestStreak, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (typeof currentStreak !== 'number' || currentStreak < 0) {
      return res.status(400).json({ success: false, error: 'Valid non-negative streak number is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (type === 'TASK') {
      if (!taskId) {
        return res.status(400).json({ success: false, error: 'Task ID is required for task streak correction.' });
      }
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Task not found for this user.' });
      }

      const beforeState = { currentStreak: task.currentStreak, longestStreak: task.longestStreak };
      const newLongest = longestStreak !== undefined ? Math.max(longestStreak, currentStreak) : Math.max(task.longestStreak, currentStreak);

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          currentStreak,
          longestStreak: newLongest,
        },
        select: { id: true, title: true, currentStreak: true, longestStreak: true },
      });

      await recordAuditLog({
        adminUsername: req.admin!.username,
        action: 'TASK_STREAK_CORRECTION',
        targetUserId: userId,
        targetUser: `@${user.username}`,
        reason,
        beforeState,
        afterState: updatedTask,
      });

      return res.json({
        success: true,
        message: `Streak for task "${task.title}" updated to ${currentStreak} days.`,
        task: updatedTask,
      });
    } else {
      // OVERALL STREAK
      const beforeState = { currentStreak: user.currentStreak, longestStreak: user.longestStreak };
      const newLongest = longestStreak !== undefined ? Math.max(longestStreak, currentStreak) : Math.max(user.longestStreak, currentStreak);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          currentStreak,
          longestStreak: newLongest,
        },
        select: { id: true, username: true, currentStreak: true, longestStreak: true },
      });

      await recordAuditLog({
        adminUsername: req.admin!.username,
        action: 'OVERALL_STREAK_CORRECTION',
        targetUserId: userId,
        targetUser: `@${user.username}`,
        reason,
        beforeState,
        afterState: updatedUser,
      });

      return res.json({
        success: true,
        message: `Overall streak for @${user.username} updated to ${currentStreak} days.`,
        user: updatedUser,
      });
    }
  } catch (err: any) {
    console.error('correctStreaks error:', err);
    return res.status(500).json({ success: false, error: 'Failed to correct streak.' });
  }
}

/**
 * Adjust freezes (balance, recharge days, or historical freeze date protection)
 */
export async function adjustFreezes(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { overallFreezeBalance, overallFreezeRechargeDays, historicalFreezeDate, taskId, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const beforeState = {
      overallFreezeBalance: user.overallFreezeBalance,
      overallFreezeRechargeDays: user.overallFreezeRechargeDays,
    };

    const updateData: any = {};
    if (typeof overallFreezeBalance === 'number' && overallFreezeBalance >= 0) {
      updateData.overallFreezeBalance = overallFreezeBalance;
    }
    if (typeof overallFreezeRechargeDays === 'number' && overallFreezeRechargeDays >= 0) {
      updateData.overallFreezeRechargeDays = overallFreezeRechargeDays;
    }

    let updatedUser = user;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // If historical freeze date protection requested (e.g. "2026-10-17")
    let historicalLog = null;
    if (historicalFreezeDate && typeof historicalFreezeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(historicalFreezeDate)) {
      historicalLog = await prisma.freezeLog.upsert({
        where: {
          userId_scopeKey_protectedDate: {
            userId,
            scopeKey: taskId ? `TASK:${taskId}` : 'OVERALL',
            protectedDate: historicalFreezeDate,
          },
        },
        create: {
          userId,
          scope: taskId ? 'TASK' : 'OVERALL',
          scopeKey: taskId ? `TASK:${taskId}` : 'OVERALL',
          taskId: taskId || null,
          protectedDate: historicalFreezeDate,
        },
        update: {},
      });
    }

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'FREEZE_ADJUSTMENT',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: {
        overallFreezeBalance: updatedUser.overallFreezeBalance,
        overallFreezeRechargeDays: updatedUser.overallFreezeRechargeDays,
        historicalLog,
      },
    });

    return res.json({
      success: true,
      message: 'Freeze settings updated successfully.',
      user: {
        id: updatedUser.id,
        overallFreezeBalance: updatedUser.overallFreezeBalance,
        overallFreezeRechargeDays: updatedUser.overallFreezeRechargeDays,
      },
      historicalFreezeApplied: Boolean(historicalLog),
    });
  } catch (err: any) {
    console.error('adjustFreezes error:', err);
    return res.status(500).json({ success: false, error: 'Failed to adjust freezes.' });
  }
}

/**
 * Adjust points with auditable ledger entry
 */
export async function adjustPoints(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { pointsDelta, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (typeof pointsDelta !== 'number' || pointsDelta === 0) {
      return res.status(400).json({ success: false, error: 'pointsDelta must be a non-zero integer.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const beforePoints = user.points || 0;
    const afterPoints = Math.max(0, beforePoints + pointsDelta);
    const today = getTodayInTimezone(user.timezone || 'Asia/Kolkata');

    // Create ledger entry + update user atomically
    await prisma.$transaction(async (tx) => {
      await tx.pointLedger.create({
        data: {
          userId,
          points: pointsDelta,
          reason: `ADMIN_CORRECTION: ${reason.slice(0, 80)}`,
          date: today,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { points: afterPoints },
      });
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'POINTS_ADJUSTMENT',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState: { points: beforePoints },
      afterState: { points: afterPoints, pointsDelta },
    });

    return res.json({
      success: true,
      message: `Points for @${user.username} adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}. New balance: ${afterPoints} pts.`,
      points: afterPoints,
    });
  } catch (err: any) {
    console.error('adjustPoints error:', err);
    return res.status(500).json({ success: false, error: 'Failed to adjust points.' });
  }
}

/**
 * Override the per-user limit of 15 (starred notifications limit)
 */
export async function overrideLimit15(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { maxStarredNotifications, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (typeof maxStarredNotifications !== 'number' || maxStarredNotifications < 1) {
      return res.status(400).json({ success: false, error: 'maxStarredNotifications must be at least 1.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const beforeState = { maxStarredNotifications: user.maxStarredNotifications || 15 };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { maxStarredNotifications },
      select: { id: true, username: true, maxStarredNotifications: true },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'OVERRIDE_LIMIT_15',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: { maxStarredNotifications },
    });

    return res.json({
      success: true,
      message: `Starred notifications limit for @${user.username} updated from ${beforeState.maxStarredNotifications} to ${maxStarredNotifications}.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('overrideLimit15 error:', err);
    return res.status(500).json({ success: false, error: 'Failed to override limit of 15.' });
  }
}

/**
 * Permanently delete a user account (Super Admin sensitive action)
 */
export async function deleteUserAccountByAdmin(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // Execute cascade deletion
    await prisma.$transaction(async (tx) => {
      // 1. Delete friendships
      await tx.friendship.deleteMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      });

      // 2. Delete friend requests
      await tx.friendRequest.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      });

      // 3. Delete group invitations & requests
      await tx.groupInvitation.deleteMany({
        where: { OR: [{ inviterId: userId }, { inviteeId: userId }] },
      });
      await tx.groupJoinRequest.deleteMany({ where: { userId } });
      await tx.groupMember.deleteMany({ where: { userId } });

      // 4. Delete user record (cascades tasks, completions, notifications, etc.)
      await tx.user.delete({ where: { id: userId } });
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'DELETE_USER_ACCOUNT',
      targetUserId: userId,
      targetUser: `@${user.username} (${user.email})`,
      reason,
      beforeState: user,
      afterState: { deleted: true },
    });

    return res.json({
      success: true,
      message: `User account @${user.username} (${user.email}) has been permanently deleted.`,
    });
  } catch (err: any) {
    console.error('deleteUserAccountByAdmin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete user account.' });
  }
}
