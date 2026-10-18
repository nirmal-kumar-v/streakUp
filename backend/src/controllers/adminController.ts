import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AdminAuthenticatedRequest } from '../middleware/adminAuthMiddleware';
import { getTodayInTimezone } from '../services/timezoneService';
import { NotificationCategory } from '@prisma/client';
import { sendEmail } from '../services/emailService';
import { recalculateUserStreaks, recalculateTaskStreaks } from '../services/streakService';

const JWT_SECRET = process.env.JWT_SECRET || 'streakup_super_secret_jwt_key_2026_change_in_production';

/**
 * Bootstrap or synchronize the default admin account with requested credentials
 * Username: admin
 * Password: Admin@123
 * Sensitive Password / PIN: Nirmal@31/08/2006
 */
async function ensureDefaultAdmin() {
  const defaultUsername = (process.env.ADMIN_INITIAL_USERNAME || 'admin').trim().toLowerCase();
  const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
  const defaultSensitivePin = process.env.ADMIN_SENSITIVE_PIN || 'Nirmal@31/08/2006';

  const existingAdmin = await prisma.adminAccount.findUnique({
    where: { username: defaultUsername },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);
  const pinHash = await bcrypt.hash(defaultSensitivePin, salt);

  if (!existingAdmin) {
    await prisma.adminAccount.create({
      data: {
        username: defaultUsername,
        passwordHash,
        sensitivePinHash: pinHash,
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`[Admin] Initial Super Admin account created: @${defaultUsername}`);
  } else {
    await prisma.adminAccount.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash,
        sensitivePinHash: pinHash,
        role: 'SUPER_ADMIN',
      },
    });
  }
}

/**
 * Automatically purges administrative audit logs older than 15 days
 */
export async function cleanupOldAuditLogs() {
  try {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const result = await prisma.adminAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: fifteenDaysAgo,
        },
      },
    });
    if (result.count > 0) {
      console.log(`[AdminAuditLog] Cleaned up ${result.count} audit logs older than 15 days.`);
    }
    return result.count;
  } catch (err) {
    console.error('[AdminAuditLog] Failed to clean up old audit logs:', err);
    return 0;
  }
}

export interface AdminNotificationOptions {
  userId: string;
  adminUsername: string;
  actionTitle: string;
  reason?: string;
  changesSummary?: string;
  sendInApp?: boolean;
  sendEmail?: boolean;
  includeReason?: boolean;
  includeChanges?: boolean;
}

/**
 * Dispatches optional In-App and Email notifications to user about administrative adjustments
 */
export async function dispatchAdminNotification(opts: AdminNotificationOptions) {
  const {
    userId,
    actionTitle,
    reason,
    changesSummary,
    sendInApp,
    sendEmail: shouldSendEmail,
    includeReason = true,
    includeChanges = true,
  } = opts;

  if (!sendInApp && !shouldSendEmail) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, email: true },
    });
    if (!user) return;

    const messageLines: string[] = [];
    if (includeChanges && changesSummary) {
      messageLines.push(changesSummary);
    }
    if (includeReason && reason) {
      messageLines.push(`Reason: ${reason}`);
    }
    if (messageLines.length === 0) {
      messageLines.push(`An administrative adjustment was applied to your account.`);
    }

    const fullMessage = messageLines.join('\n\n');
    const noticeTitle = `Account Notice: ${actionTitle}`;

    // 1. In-App Notification
    if (sendInApp) {
      await prisma.notification.create({
        data: {
          userId,
          type: NotificationCategory.SYSTEM,
          title: noticeTitle,
          message: fullMessage,
        },
      });
    }

    // 2. Email Notification
    if (shouldSendEmail && user.email) {
      const emailText = `Hello ${user.name || user.username},\n\nAn administrative update has been made to your StreakUp account:\n\n${fullMessage}\n\nIf you have any questions, please contact support.\n\nBest regards,\nStreakUp Administration Team`;

      await sendEmail({
        userId,
        recipientEmail: user.email,
        category: NotificationCategory.SYSTEM,
        subject: `[StreakUp Admin] ${noticeTitle}`,
        text: emailText,
        idempotencyKey: `admin-notice-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      });
    }
  } catch (err) {
    console.error('[Admin] Failed to dispatch admin notification:', err);
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
    // Automatically purge logs older than 15 days
    await cleanupOldAuditLogs();

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

export async function deleteAdminAuditLog(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { logId } = req.params;
    await prisma.adminAuditLog.delete({
      where: { id: logId },
    });
    return res.json({ success: true, message: 'Audit log entry deleted successfully.' });
  } catch (err: any) {
    console.error('deleteAdminAuditLog error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete audit log entry.' });
  }
}

export async function clearAdminAuditLogs(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { targetUserId } = req.query;
    const where: any = {};
    if (targetUserId) where.targetUserId = String(targetUserId);

    const deleted = await prisma.adminAuditLog.deleteMany({ where });
    return res.json({
      success: true,
      message: `Cleared ${deleted.count} audit log entries.`,
      count: deleted.count,
    });
  } catch (err: any) {
    console.error('clearAdminAuditLogs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear audit logs.' });
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

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            group: {
              select: { id: true, name: true, joinCode: true, ownerId: true },
            },
            _count: { select: { completions: true } },
          },
        },
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                joinCode: true,
                ownerId: true,
                hiddenFrom: true,
                visibleOnlyTo: true,
                _count: { select: { members: true } },
              },
            },
          },
        },
        pointLedgers: {
          take: 30,
          orderBy: { createdAt: 'desc' },
        },
        freezeLogs: {
          take: 100,
          orderBy: { usedAt: 'desc' },
        },
        taskCompletions: {
          where: { completionDate: { gte: oneYearAgo } },
          select: {
            id: true,
            taskId: true,
            completionDate: true,
            studyNote: true,
            completedAt: true,
            reactions: {
              select: { id: true, emoji: true, userId: true },
            },
          },
          orderBy: { completionDate: 'desc' },
        },
        friendshipsAsUser1: {
          include: {
            user2: { select: { id: true, name: true, username: true } },
          },
        },
        friendshipsAsUser2: {
          include: {
            user1: { select: { id: true, name: true, username: true } },
          },
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
    const {
      newUsername,
      resetCooldownOnly = false,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

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

    const changesSummary = resetCooldownOnly
      ? `Username change cooldown restriction was reset. You can now update your username immediately.`
      : `Your username was updated to @${updatedUser.username}.`;

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'USERNAME_COOLDOWN_OVERRIDE',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: updatedUser,
    });

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: 'Username Settings Updated',
      reason,
      changesSummary,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
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
    const {
      type,
      taskId,
      currentStreak,
      longestStreak,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

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

      const changesSummary = `Task "${task.title}" streak updated: Current streak changed from ${beforeState.currentStreak} to ${currentStreak} days (longest: ${newLongest} days).`;

      await recordAuditLog({
        adminUsername: req.admin!.username,
        action: 'TASK_STREAK_CORRECTION',
        targetUserId: userId,
        targetUser: `@${user.username}`,
        reason,
        beforeState,
        afterState: updatedTask,
      });

      await dispatchAdminNotification({
        userId,
        adminUsername: req.admin!.username,
        actionTitle: 'Task Streak Corrected',
        reason,
        changesSummary,
        sendInApp,
        sendEmail: shouldSendEmail,
        includeReason,
        includeChanges,
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

      const changesSummary = `Overall streak updated: Current streak changed from ${beforeState.currentStreak} to ${currentStreak} days (longest: ${newLongest} days).`;

      await recordAuditLog({
        adminUsername: req.admin!.username,
        action: 'OVERALL_STREAK_CORRECTION',
        targetUserId: userId,
        targetUser: `@${user.username}`,
        reason,
        beforeState,
        afterState: updatedUser,
      });

      await dispatchAdminNotification({
        userId,
        adminUsername: req.admin!.username,
        actionTitle: 'Overall Streak Corrected',
        reason,
        changesSummary,
        sendInApp,
        sendEmail: shouldSendEmail,
        includeReason,
        includeChanges,
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
 * Grants a streak / task completion on a specific historical or current day for a user
 * Maintains full workflow: creates TaskCompletion, recalculates task & user streaks,
 * awards points, records audit log, and dispatches notifications if selected.
 */
export async function grantDayStreak(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const {
      date,
      taskId,
      studyNote,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'A valid date in YYYY-MM-DD format is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tasks: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Determine target task (provided taskId or user's first active task)
    let targetTaskId = taskId;
    if (!targetTaskId) {
      if (user.tasks.length > 0) {
        targetTaskId = user.tasks[0].id;
      } else {
        const newTask = await prisma.task.create({
          data: {
            userId,
            title: 'Daily Productivity',
            recurrence: 'DAILY',
            scheduledDays: [0, 1, 2, 3, 4, 5, 6],
            status: 'ACTIVE',
          },
        });
        targetTaskId = newTask.id;
      }
    }

    const beforeState = {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      points: user.points,
    };

    // Create or update TaskCompletion for this date
    const completion = await prisma.taskCompletion.upsert({
      where: {
        taskId_completionDate: {
          taskId: targetTaskId,
          completionDate: date,
        },
      },
      create: {
        userId,
        taskId: targetTaskId,
        completionDate: date,
        completedAt: new Date(`${date}T12:00:00Z`),
        studyNote: studyNote || `Retroactively granted by admin on ${date}`,
      },
      update: {
        studyNote: studyNote || undefined,
      },
    });

    // Recalculate task and user streaks
    await recalculateTaskStreaks(prisma, targetTaskId, userId, user.timezone);
    const updatedStreaks = await recalculateUserStreaks(prisma, userId, user.timezone);

    // Award +10 points for completion
    const pointsDelta = 10;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: pointsDelta } },
      select: {
        id: true,
        username: true,
        currentStreak: true,
        longestStreak: true,
        points: true,
        overallFreezeBalance: true,
      },
    });

    const changesSummary = `Granted streak completion for ${date}. Current streak is now ${updatedUser.currentStreak} days (longest: ${updatedUser.longestStreak} days), points +10.`;

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'GRANT_DAY_STREAK',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: {
        completionId: completion.id,
        date,
        taskId: targetTaskId,
        currentStreak: updatedUser.currentStreak,
        longestStreak: updatedUser.longestStreak,
        points: updatedUser.points,
      },
    });

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: `Streak Granted for ${date}`,
      reason,
      changesSummary,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
    });

    return res.json({
      success: true,
      message: `Streak completion successfully applied for ${date}. Workflow and streaks updated everywhere.`,
      user: updatedUser,
      completion,
    });
  } catch (err: any) {
    console.error('grantDayStreak error:', err);
    return res.status(500).json({ success: false, error: 'Failed to grant streak on selected day.' });
  }
}

/**
 * Adjust freezes (balance out of 7, or historical freeze date protection)
 */
export async function adjustFreezes(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const {
      overallFreezeBalance,
      overallFreezeRechargeDays,
      historicalFreezeDate,
      taskId,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

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
    if (typeof overallFreezeBalance === 'number') {
      // Clamped out of 7 shields
      updateData.overallFreezeBalance = Math.max(0, Math.min(7, Math.round(overallFreezeBalance)));
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

      // Recalculate streaks so freeze protection is immediately active in workflow
      await recalculateUserStreaks(prisma, userId, user.timezone);
      if (taskId) {
        await recalculateTaskStreaks(prisma, taskId, userId, user.timezone);
      }
    }

    const changesList: string[] = [];
    if (typeof overallFreezeBalance === 'number') {
      changesList.push(`Freeze shield balance set to ${updatedUser.overallFreezeBalance}/7 (was ${beforeState.overallFreezeBalance}/7).`);
    }
    if (historicalLog) {
      changesList.push(`Streak freeze protection applied for ${historicalFreezeDate}.`);
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

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: 'Freeze Settings Adjusted',
      reason,
      changesSummary: changesList.join(' '),
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
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
    const {
      pointsDelta,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

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

    const changesSummary = `Points adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}. New point total: ${afterPoints} pts (was ${beforePoints} pts).`;

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'POINTS_ADJUSTMENT',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState: { points: beforePoints },
      afterState: { points: afterPoints, pointsDelta },
    });

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: 'Points Adjusted',
      reason,
      changesSummary,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
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
    const {
      maxStarredNotifications,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

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

    const changesSummary = `Starred notifications limit updated from ${beforeState.maxStarredNotifications} to ${maxStarredNotifications}.`;

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'OVERRIDE_LIMIT_15',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState,
      afterState: { maxStarredNotifications },
    });

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: 'Starred Notification Limit Overridden',
      reason,
      changesSummary,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
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

/**
 * Override 14-day email change cooldown or update registered email directly
 */
export async function overrideEmailCooldown(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const {
      newEmail,
      resetCooldownOnly = false,
      reason,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason = true,
      includeChanges = true,
    } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const beforeState = {
      email: user.email,
      emailLastChangedAt: user.emailLastChangedAt,
    };

    let updatedUser;
    if (resetCooldownOnly || !newEmail) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { emailLastChangedAt: null },
        select: { id: true, email: true, emailLastChangedAt: true },
      });
    } else {
      const cleanEmail = String(newEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Invalid email address format.' });
      }
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ success: false, error: `${cleanEmail} is already registered to another account.` });
      }

      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: cleanEmail,
          emailLastChangedAt: new Date(),
        },
        select: { id: true, email: true, emailLastChangedAt: true },
      });
    }

    const changesSummary = resetCooldownOnly
      ? `Email 14-day restriction cleared. You can now update your registered email address immediately.`
      : `Your registered email address was updated to ${updatedUser.email}.`;

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'EMAIL_COOLDOWN_OVERRIDE',
      targetUserId: userId,
      targetUser: `@${user.username} (${user.email})`,
      reason,
      beforeState,
      afterState: updatedUser,
    });

    await dispatchAdminNotification({
      userId,
      adminUsername: req.admin!.username,
      actionTitle: 'Email Settings Updated',
      reason,
      changesSummary,
      sendInApp,
      sendEmail: shouldSendEmail,
      includeReason,
      includeChanges,
    });

    return res.json({
      success: true,
      message: resetCooldownOnly
        ? `Email 14-day restriction cleared for @${user.username}. They can now update their email in settings.`
        : `Email updated to ${updatedUser.email} for @${user.username} by Admin override.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('overrideEmailCooldown error:', err);
    return res.status(500).json({ success: false, error: 'Failed to override email cooldown.' });
  }
}

/**
 * Toggle or update email verification status
 */
export async function toggleUserEmailVerification(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { isEmailVerified, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const newStatus = typeof isEmailVerified === 'boolean' ? isEmailVerified : !user.isEmailVerified;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: newStatus },
      select: { id: true, username: true, isEmailVerified: true },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'TOGGLE_EMAIL_VERIFICATION',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState: { isEmailVerified: user.isEmailVerified },
      afterState: { isEmailVerified: newStatus },
    });

    return res.json({
      success: true,
      message: `Email verification for @${user.username} set to ${newStatus ? 'VERIFIED' : 'UNVERIFIED'}.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('toggleUserEmailVerification error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update email verification status.' });
  }
}

/**
 * Update user timezone with streak boundary recalculation notice
 */
export async function updateUserTimezone(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { timezone, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid IANA timezone string is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { timezone: timezone.trim() },
      select: { id: true, username: true, timezone: true },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'UPDATE_USER_TIMEZONE',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState: { timezone: user.timezone },
      afterState: { timezone: updatedUser.timezone },
    });

    return res.json({
      success: true,
      message: `Timezone for @${user.username} updated to ${updatedUser.timezone}.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('updateUserTimezone error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update timezone.' });
  }
}

/**
 * Reset 12-hour friend nudge cooldown
 */
export async function resetNudgeCooldown(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const deleted = await prisma.notification.deleteMany({
      where: {
        userId,
        category: 'FRIEND_NUDGE',
      },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'RESET_NUDGE_COOLDOWN',
      targetUserId: userId,
      targetUser: `@${user.username}`,
      reason,
      beforeState: { deletedCount: deleted.count },
      afterState: { cleared: true },
    });

    return res.json({
      success: true,
      message: `Cleared ${deleted.count} nudge notifications. 12-hour nudge cooldown has been reset for @${user.username}.`,
    });
  } catch (err: any) {
    console.error('resetNudgeCooldown error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset nudge cooldown.' });
  }
}

/**
 * Update task privacy/visibility (hiddenFrom, visibleOnlyTo)
 */
export async function updateTaskVisibility(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const { hiddenFrom = [], visibleOnlyTo = [], reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: { select: { username: true } } },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        hiddenFrom: Array.isArray(hiddenFrom) ? hiddenFrom : [],
        visibleOnlyTo: Array.isArray(visibleOnlyTo) ? visibleOnlyTo : [],
      },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'UPDATE_TASK_VISIBILITY',
      targetUserId: task.userId,
      targetUser: `@${task.user.username}`,
      reason,
      beforeState: { hiddenFrom: task.hiddenFrom, visibleOnlyTo: task.visibleOnlyTo },
      afterState: { hiddenFrom: updatedTask.hiddenFrom, visibleOnlyTo: updatedTask.visibleOnlyTo },
    });

    return res.json({
      success: true,
      message: `Visibility rules for task "${task.title}" updated.`,
      task: updatedTask,
    });
  } catch (err: any) {
    console.error('updateTaskVisibility error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update task visibility.' });
  }
}

/**
 * Manage group membership role & group ownership transfer
 */
export async function adminManageGroupMember(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { groupId } = req.params;
    const { targetUserId, role, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid group role. Must be OWNER, ADMIN, or MEMBER.' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const member = group.members.find((m) => m.userId === targetUserId);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
    }

    await prisma.$transaction(async (tx) => {
      // If transferring ownership
      if (role === 'OWNER') {
        // Demote old owner to ADMIN in group members
        await tx.groupMember.updateMany({
          where: { groupId, userId: group.ownerId },
          data: { role: 'ADMIN' },
        });
        // Set new owner on group
        await tx.group.update({
          where: { id: groupId },
          data: { ownerId: targetUserId },
        });
        // Promote target user to OWNER in group members
        await tx.groupMember.update({
          where: { groupId_userId: { groupId, userId: targetUserId } },
          data: { role: 'OWNER' },
        });
      } else {
        await tx.groupMember.update({
          where: { groupId_userId: { groupId, userId: targetUserId } },
          data: { role: role as any },
        });
      }
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: role === 'OWNER' ? 'TRANSFER_GROUP_OWNERSHIP' : 'UPDATE_GROUP_MEMBER_ROLE',
      targetUserId,
      reason,
      beforeState: { groupId, groupName: group.name, oldRole: member.role, previousOwnerId: group.ownerId },
      afterState: { groupId, newRole: role, newOwnerId: role === 'OWNER' ? targetUserId : group.ownerId },
    });

    return res.json({
      success: true,
      message: role === 'OWNER'
        ? `Transferred ownership of group "${group.name}" to member.`
        : `Updated role in group "${group.name}" to ${role}.`,
    });
  } catch (err: any) {
    console.error('adminManageGroupMember error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update group member role.' });
  }
}

/**
 * Recover archived group task back to active dashboard
 */
export async function adminRecoverGroupTask(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: { select: { username: true } }, group: { select: { name: true } } },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'ACTIVE' },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'RECOVER_GROUP_TASK',
      targetUserId: task.userId,
      targetUser: `@${task.user.username}`,
      reason,
      beforeState: { taskId, status: task.status },
      afterState: { taskId, status: 'ACTIVE' },
    });

    return res.json({
      success: true,
      message: `Task "${task.title}" has been restored to ACTIVE status on the dashboard.`,
      task: updatedTask,
    });
  } catch (err: any) {
    console.error('adminRecoverGroupTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to recover task.' });
  }
}

/**
 * Moderate study note or remove reactions without deleting streak completion
 */
export async function adminModerateStudyNote(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { completionId } = req.params;
    const { studyNote, clearReactions = false, reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'An administrative reason is mandatory for audit trail.' });
    }

    const completion = await prisma.taskCompletion.findUnique({
      where: { id: completionId },
      include: {
        user: { select: { username: true } },
        task: { select: { title: true } },
        reactions: true,
      },
    });
    if (!completion) {
      return res.status(404).json({ success: false, error: 'Task completion record not found.' });
    }

    const beforeState = {
      studyNote: completion.studyNote,
      reactionsCount: completion.reactions.length,
    };

    if (clearReactions) {
      await prisma.studyNoteReaction.deleteMany({ where: { completionId } });
    }

    const updatedCompletion = await prisma.taskCompletion.update({
      where: { id: completionId },
      data: {
        studyNote: studyNote !== undefined ? (studyNote ? String(studyNote).trim() : null) : completion.studyNote,
      },
      include: { reactions: true },
    });

    await recordAuditLog({
      adminUsername: req.admin!.username,
      action: 'MODERATE_STUDY_NOTE',
      targetUserId: completion.userId,
      targetUser: `@${completion.user.username}`,
      reason,
      beforeState,
      afterState: {
        studyNote: updatedCompletion.studyNote,
        reactionsCount: updatedCompletion.reactions.length,
      },
    });

    return res.json({
      success: true,
      message: 'Study note moderated successfully. Underlying completion record preserved.',
      completion: updatedCompletion,
    });
  } catch (err: any) {
    console.error('adminModerateStudyNote error:', err);
    return res.status(500).json({ success: false, error: 'Failed to moderate study note.' });
  }
}

