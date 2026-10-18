import { Response } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { DEFAULT_TIMEZONE, isValidTimezone, getLocalDateString } from '../services/timezoneService';
import { isTaskVisibleToUser } from '../utils/taskPrivacy';

const createGroupSchema = z.object({
  name: z.string().trim().min(3, 'Group name must be at least 3 characters').max(50),
  description: z.string().trim().max(300).optional().nullable(),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional().default([0, 1, 2, 3, 4, 5, 6]),
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(3, 'Group name must be at least 3 characters').max(50).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  scheduledDays: z.array(z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional(),
  hiddenFrom: z.array(z.string()).optional(),
  visibleOnlyTo: z.array(z.string()).optional(),
});

const inviteToGroupSchema = z.object({
  inviteeUserId: z.string().optional(),
  inviteeUsername: z.string().optional(),
});

/**
 * Generates a unique, professional group code like "GATE-X7K2" or "GRP-9J2P"
 */
async function generateUniqueGroupCode(groupName: string): Promise<string> {
  const cleanName = groupName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
  const prefix = cleanName.length >= 3 ? cleanName : 'GRP';
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  for (let attempt = 0; attempt < 15; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `${prefix}-${suffix}`;
    const existing = await prisma.group.findUnique({
      where: { joinCode: code },
    });
    if (!existing) {
      return code;
    }
  }
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/**
 * Helper to determine friendship status between current user and target user
 */
async function getFriendshipStatus(currentUserId: string, targetUserId: string): Promise<'SELF' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE'> {
  if (currentUserId === targetUserId) return 'SELF';
  const [u1, u2] = currentUserId < targetUserId ? [currentUserId, targetUserId] : [targetUserId, currentUserId];

  const friendship = await prisma.friendship.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
  });
  if (friendship) return 'FRIENDS';

  const sent = await prisma.friendRequest.findFirst({
    where: { senderId: currentUserId, receiverId: targetUserId, status: 'PENDING' },
  });
  if (sent) return 'REQUEST_SENT';

  const received = await prisma.friendRequest.findFirst({
    where: { senderId: targetUserId, receiverId: currentUserId, status: 'PENDING' },
  });
  if (received) return 'REQUEST_RECEIVED';

  return 'NONE';
}

/**
 * Calculates current week range (Monday to Sunday) in user's timezone
 */
function getLocalWeekRange(timezone: string = DEFAULT_TIMEZONE, referenceDate?: Date) {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const now = referenceDate ? DateTime.fromJSDate(referenceDate).setZone(zone) : DateTime.now().setZone(zone);
  const startOfWeek = now.startOf('week');
  const endOfWeek = now.endOf('week');
  return {
    startDate: startOfWeek.toFormat('yyyy-MM-dd'),
    endDate: endOfWeek.toFormat('yyyy-MM-dd'),
  };
}

/**
 * Create a new group (with shared task definition and automatic assignment for creator)
 */
export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const parseResult = createGroupSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid group details',
      });
    }

    const { name, description, scheduledDays } = parseResult.data;
    const joinCode = await generateUniqueGroupCode(name);

    const group = await prisma.$transaction(async (tx) => {
      // 1. Create Group
      const newGroup = await tx.group.create({
        data: {
          name,
          description: description || null,
          joinCode,
          scheduledDays,
          ownerId: userId,
        },
      });

      // 2. Creator is automatically OWNER
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId,
          role: 'OWNER',
        },
      });

      // 3. Automatically assign the shared group task to the creator
      await tx.task.create({
        data: {
          userId,
          groupId: newGroup.id,
          isGroupTask: true,
          title: name,
          description: description || `Shared group habit for ${name}`,
          scheduledDays,
          category: 'Group Task',
          recurrence: 'DAILY',
          status: 'ACTIVE',
        },
      });

      return newGroup;
    });

    return res.status(201).json({
      success: true,
      message: 'Group and shared task created successfully.',
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        joinCode: group.joinCode,
        scheduledDays: group.scheduledDays,
        ownerId: group.ownerId,
        memberCount: 1,
        userRole: 'OWNER',
      },
    });
  } catch (err: any) {
    console.error('createGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create group.' });
  }
}

/**
 * Search groups by name or unique code.
 * Strict privacy rule: Does NOT reveal member lists, profiles, or personal streaks.
 */
export async function searchGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const rawQuery = (req.query.q as string || '').trim();

    let whereClause: any = {};
    if (rawQuery) {
      whereClause = {
        OR: [
          { name: { contains: rawQuery, mode: 'insensitive' } },
          { joinCode: { equals: rawQuery.toUpperCase() } },
        ],
      };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { username: true },
    });
    const cUsername = (currentUser?.username || '').toLowerCase().replace(/^@/, '');
    const cId = currentUserId.toLowerCase();

    const groups = await prisma.group.findMany({
      where: whereClause,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        joinCode: true,
        scheduledDays: true,
        ownerId: true,
        hiddenFrom: true,
        visibleOnlyTo: true,
        createdAt: true,
        _count: {
          select: { members: true },
        },
      },
    });

    const visibleGroups = groups.filter((g) => {
      if (g.ownerId === currentUserId) return true;
      const hidden = (g.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
      if (hidden.includes('all') || hidden.includes(cId) || (cUsername && hidden.includes(cUsername))) {
        return false;
      }
      const visible = (g.visibleOnlyTo || []).map((v) => v.trim().toLowerCase().replace(/^@/, ''));
      if (visible.length > 0) {
        if (!visible.includes(cId) && (!cUsername || !visible.includes(cUsername))) {
          return false;
        }
      }
      return true;
    });

    // Check membership and join request status for current user for each visible group
    const groupsWithStatus = await Promise.all(
      visibleGroups.map(async (g) => {
        const membership = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: g.id, userId: currentUserId } },
          select: { role: true },
        });

        let requestStatus: string | null = null;
        if (!membership) {
          const req = await prisma.groupJoinRequest.findUnique({
            where: { groupId_userId: { groupId: g.id, userId: currentUserId } },
            select: { status: true },
          });
          requestStatus = req?.status || null;
        }

        return {
          id: g.id,
          name: g.name,
          description: g.description,
          joinCode: g.joinCode,
          scheduledDays: g.scheduledDays,
          memberCount: g._count.members,
          isMember: !!membership,
          userRole: membership?.role || null,
          myRequestStatus: requestStatus,
        };
      })
    );

    return res.json({
      success: true,
      groups: groupsWithStatus,
    });
  } catch (err: any) {
    console.error('searchGroups error:', err);
    return res.status(500).json({ success: false, error: 'Failed to search groups.' });
  }
}

/**
 * Submit a Request to Join a group
 */
export async function requestToJoinGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const groupIdOrCode = req.params.id || req.body.groupId || req.body.joinCode;

    if (!groupIdOrCode || typeof groupIdOrCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Group identifier or code is required.' });
    }

    const group = await prisma.group.findFirst({
      where: {
        OR: [
          { id: groupIdOrCode },
          { joinCode: groupIdOrCode.trim().toUpperCase() },
        ],
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    // Check if already an accepted member
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'You are already an accepted member of this group.' });
    }

    // Check existing join request
    const existingReq = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });

    if (existingReq && existingReq.status === 'PENDING') {
      return res.status(400).json({ success: false, error: 'You already have a pending join request for this group.' });
    }

    // Upsert join request to PENDING
    const joinRequest = await prisma.groupJoinRequest.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: {
        groupId: group.id,
        userId,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: `Join request submitted for ${group.name}. Waiting for approval from an Owner or Admin.`,
      request: {
        id: joinRequest.id,
        groupId: group.id,
        groupName: group.name,
        status: joinRequest.status,
      },
    });
  } catch (err: any) {
    console.error('requestToJoinGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit join request.' });
  }
}

/**
 * Cancel a user's own pending join request
 */
export async function cancelJoinRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const request = await prisma.groupJoinRequest.findFirst({
      where: {
        groupId: id,
        userId,
        status: 'PENDING',
      },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'No pending join request found for this group.' });
    }

    await prisma.groupJoinRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' },
    });

    return res.json({
      success: true,
      message: 'Join request cancelled.',
    });
  } catch (err: any) {
    console.error('cancelJoinRequest error:', err);
    return res.status(500).json({ success: false, error: 'Failed to cancel join request.' });
  }
}

/**
 * List pending join requests for a group (Owner and Admin only)
 */
export async function getGroupJoinRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Must be Owner or Admin
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ success: false, error: 'Forbidden. Only group Owners and Admins can view join requests.' });
    }

    const requests = await prisma.groupJoinRequest.findMany({
      where: { groupId: id, status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        userId: r.userId,
        user: r.user,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('getGroupJoinRequests error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve join requests.' });
  }
}

/**
 * Respond to a join request (ACCEPT or REJECT) (Owner and Admin only)
 * When ACCEPTED: automatically assigns shared group task to the member!
 */
export async function respondToJoinRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const adminUserId = req.user!.userId;
    const { id, requestId } = req.params;
    const { action } = req.body; // 'ACCEPT' | 'REJECT'

    if (action !== 'ACCEPT' && action !== 'REJECT') {
      return res.status(400).json({ success: false, error: 'Action must be ACCEPT or REJECT.' });
    }

    // Check admin / owner permissions
    const adminMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: adminUserId } },
    });

    const targetGroup = await prisma.group.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    const isAuthorized =
      targetGroup?.ownerId === adminUserId ||
      adminMembership?.role === 'OWNER' ||
      adminMembership?.role === 'ADMIN';

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Forbidden. Only group Owners and Admins can accept or reject requests.' });
    }

    const joinRequest = await prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
      include: { group: true },
    });

    if (!joinRequest || joinRequest.groupId !== id) {
      return res.status(404).json({ success: false, error: 'Join request not found.' });
    }

    if (joinRequest.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `This request has already been ${joinRequest.status.toLowerCase()}.` });
    }

    if (action === 'REJECT') {
      await prisma.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });

      return res.json({
        success: true,
        message: 'Join request rejected.',
      });
    }

    // Action is ACCEPT: Add member & automatically assign the shared group task
    const applicantUserId = joinRequest.userId;
    const group = joinRequest.group;

    await prisma.$transaction(async (tx) => {
      // 1. Update request status to ACCEPTED
      await tx.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      // 2. Add as GroupMember (role: MEMBER)
      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: applicantUserId } },
        create: {
          groupId: group.id,
          userId: applicantUserId,
          role: 'MEMBER',
        },
        update: {
          role: 'MEMBER',
        },
      });

      // 3. Automatically assign shared group task if not already assigned
      const existingTask = await tx.task.findFirst({
        where: {
          userId: applicantUserId,
          groupId: group.id,
        },
      });

      if (!existingTask) {
        await tx.task.create({
          data: {
            userId: applicantUserId,
            groupId: group.id,
            isGroupTask: true,
            title: group.name,
            description: group.description || `Shared group habit for ${group.name}`,
            scheduledDays: group.scheduledDays,
            category: 'Group Task',
            recurrence: 'DAILY',
            status: 'ACTIVE',
            currentStreak: 0,
            longestStreak: 0,
            freezeBalance: 0,
            freezeRechargeDays: 0,
          },
        });
      }
    });

    return res.json({
      success: true,
      message: `Applicant accepted! The shared group task has been automatically assigned to their checklist.`,
    });
  } catch (err: any) {
    console.error('respondToJoinRequest error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process join request.' });
  }
}

/**
 * List all groups user belongs to
 */
export async function getUserGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            owner: { select: { id: true, name: true, username: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = await Promise.all(
      memberships.map(async (m) => {
        let pendingRequestsCount = 0;
        if (m.role === 'OWNER' || m.role === 'ADMIN') {
          pendingRequestsCount = await prisma.groupJoinRequest.count({
            where: { groupId: m.group.id, status: 'PENDING' },
          });
        }

        // Fetch user's individual streak on this shared group task
        const memberTask = await prisma.task.findFirst({
          where: { userId, groupId: m.group.id, status: 'ACTIVE' },
          select: { currentStreak: true, longestStreak: true },
        });

        return {
          id: m.group.id,
          name: m.group.name,
          description: m.group.description,
          joinCode: m.group.joinCode,
          scheduledDays: m.group.scheduledDays,
          owner: m.group.owner,
          role: m.role,
          isOwner: m.role === 'OWNER',
          isAdmin: m.role === 'OWNER' || m.role === 'ADMIN',
          memberCount: m.group._count.members,
          pendingRequestsCount,
          currentStreak: memberTask?.currentStreak || 0,
          joinedAt: m.joinedAt,
        };
      })
    );

    return res.json({
      success: true,
      groups,
    });
  } catch (err: any) {
    console.error('getUserGroups error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve groups.' });
  }
}

/**
 * Get group details, shared task status for current user, and member list
 */
export async function getGroupDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Check accepted membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You must be an accepted member to view this group.',
      });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, username: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    // Fetch user's timezone & username
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, timezone: true },
    });
    const timezone = currentUser?.timezone || 'Asia/Kolkata';
    const todayDateStr = getLocalDateString(timezone);
    const cUsername = (currentUser?.username || '').toLowerCase().replace(/^@/, '');
    const cId = userId.toLowerCase();

    // Check if group owner hid this user from finding/viewing the group
    const groupHidden = (group.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
    if (group.ownerId !== userId && (groupHidden.includes('all') || groupHidden.includes(cId) || (cUsername && groupHidden.includes(cUsername)))) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const groupVisible = (group.visibleOnlyTo || []).map((v) => v.trim().toLowerCase().replace(/^@/, ''));
    if (group.ownerId !== userId && groupVisible.length > 0) {
      if (!groupVisible.includes(cId) && (!cUsername || !groupVisible.includes(cUsername))) {
        return res.status(404).json({ success: false, error: 'Group not found.' });
      }
    }

    // Fetch user's assigned group task
    const userTask = await prisma.task.findFirst({
      where: { userId, groupId: id },
      include: {
        completions: {
          where: { completionDate: todayDateStr },
          select: { id: true, completionDate: true, completedAt: true, studyNote: true },
        },
      },
    });

    const completedToday = (userTask?.completions?.length || 0) > 0;
    const todayStudyNote = completedToday ? userTask!.completions[0].studyNote : null;

    // Count pending join requests if Owner/Admin
    let pendingRequestsCount = 0;
    if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
      pendingRequestsCount = await prisma.groupJoinRequest.count({
        where: { groupId: id, status: 'PENDING' },
      });
    }

    // Filter out members who hid current user (the count will match visible members)
    const visibleGroupMembers = group.members.filter((m) => {
      if (m.userId === userId) return true; // always show self
      const mHidden = (m.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
      if (mHidden.includes('all') || mHidden.includes(cId) || (cUsername && mHidden.includes(cUsername))) {
        return false;
      }
      return true;
    });

    // Build members list with individual task streaks and friendship status
    const members = await Promise.all(
      visibleGroupMembers.map(async (m) => {
        const mTask = await prisma.task.findFirst({
          where: { userId: m.user.id, groupId: id },
          select: { currentStreak: true, longestStreak: true },
        });

        const friendshipStatus = await getFriendshipStatus(userId, m.user.id);

        return {
          id: m.user.id,
          name: m.user.name,
          username: m.user.username,
          profileImage: m.user.profileImage,
          role: m.role,
          currentStreak: mTask?.currentStreak || 0,
          longestStreak: mTask?.longestStreak || 0,
          friendshipStatus,
          joinedAt: m.joinedAt,
        };
      })
    );

    return res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        joinCode: group.joinCode,
        scheduledDays: group.scheduledDays,
        owner: group.owner,
        userRole: membership.role,
        isOwner: membership.role === 'OWNER',
        isAdmin: membership.role === 'OWNER' || membership.role === 'ADMIN',
        memberCount: members.length,
        groupHiddenFrom: membership.role === 'OWNER' ? (group.hiddenFrom || []) : [],
        groupVisibleOnlyTo: membership.role === 'OWNER' ? (group.visibleOnlyTo || []) : [],
        memberHiddenFrom: membership.hiddenFrom || [],
        pendingRequestsCount,
        hasActiveDashboardTask: !!userTask && userTask.status === 'ACTIVE',
        createdAt: group.createdAt,
        userTask: userTask
          ? {
              id: userTask.id,
              title: userTask.title,
              description: userTask.description,
              scheduledDays: userTask.scheduledDays,
              currentStreak: userTask.currentStreak,
              longestStreak: userTask.longestStreak,
              freezeBalance: userTask.freezeBalance,
              freezeRechargeDays: userTask.freezeRechargeDays,
              status: userTask.status,
              hiddenFrom: userTask.hiddenFrom || [],
              visibleOnlyTo: userTask.visibleOnlyTo || [],
              completedToday,
              todayStudyNote,
            }
          : null,
        members,
      },
    });
  } catch (err: any) {
    console.error('getGroupDetails error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group details.' });
  }
}

/**
 * Group Leaderboards:
 * 1. 'streak': Ranks members by their current individual group-task streak.
 * 2. 'weekly': Ranks members by qualifying group-task completions during the current week.
 * Both support in-leaderboard friend requests.
 */
export async function getGroupLeaderboards(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const type = req.query.type === 'weekly' ? 'weekly' : 'streak';

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You must be an accepted member to view this group leaderboard.',
      });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, name: true, scheduledDays: true },
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true,
            timezone: true,
          },
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, timezone: true },
    });
    const timezone = user?.timezone || DEFAULT_TIMEZONE;
    const { startDate, endDate } = getLocalWeekRange(timezone);
    const cUsername = (user?.username || '').toLowerCase().replace(/^@/, '');
    const cId = userId.toLowerCase();

    // Filter out members who hid current user
    const visibleMembers = members.filter((m) => {
      if (m.userId === userId) return true;
      const mHidden = (m.hiddenFrom || []).map((h) => h.trim().toLowerCase().replace(/^@/, ''));
      if (mHidden.includes('all') || mHidden.includes(cId) || (cUsername && mHidden.includes(cUsername))) {
        return false;
      }
      return true;
    });

    const rankedList = await Promise.all(
      visibleMembers.map(async (m) => {
        // Individual group task
        const memberTask = await prisma.task.findFirst({
          where: { userId: m.user.id, groupId: id },
          select: { id: true, currentStreak: true, longestStreak: true },
        });

        // Weekly completions count (within current week)
        let weeklyCompletions = 0;
        if (memberTask) {
          weeklyCompletions = await prisma.taskCompletion.count({
            where: {
              taskId: memberTask.id,
              completionDate: {
                gte: startDate,
                lte: endDate,
              },
            },
          });
        }

        const friendshipStatus = await getFriendshipStatus(userId, m.user.id);

        return {
          userId: m.user.id,
          name: m.user.name,
          username: m.user.username,
          profileImage: m.user.profileImage,
          role: m.role,
          currentStreak: memberTask?.currentStreak || 0,
          longestStreak: memberTask?.longestStreak || 0,
          weeklyCompletions,
          isCurrentUser: m.user.id === userId,
          friendshipStatus,
        };
      })
    );

    if (type === 'weekly') {
      rankedList.sort((a, b) => {
        if (b.weeklyCompletions !== a.weeklyCompletions) return b.weeklyCompletions - a.weeklyCompletions;
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        return a.name.localeCompare(b.name);
      });
    } else {
      rankedList.sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        if (b.weeklyCompletions !== a.weeklyCompletions) return b.weeklyCompletions - a.weeklyCompletions;
        return a.name.localeCompare(b.name);
      });
    }

    const leaderboardWithRank = rankedList.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return res.json({
      success: true,
      groupId: group.id,
      groupName: group.name,
      type,
      weekRange: { startDate, endDate },
      leaderboard: leaderboardWithRank,
    });
  } catch (err: any) {
    console.error('getGroupLeaderboards error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group leaderboard.' });
  }
}

/**
 * Get Study Notes on Group Task completions (Accepted members only)
 */
export async function getGroupNotes(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You must be an accepted member to view group study notes.',
      });
    }

    // Fetch viewer profile
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const viewer = { id: userId, username: currentUser?.username };

    // Fetch completions of any task with groupId = id where studyNote is present
    const completions = await prisma.taskCompletion.findMany({
      where: {
        task: { groupId: id },
        studyNote: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true,
          },
        },
        task: {
          select: {
            id: true,
            userId: true,
            hiddenFrom: true,
            visibleOnlyTo: true,
            groupId: true,
            group: {
              select: {
                hiddenFrom: true,
              },
            },
          },
        },
        reactions: true,
      },
      orderBy: [
        { completionDate: 'desc' },
        { completedAt: 'desc' },
      ],
      take: 50,
    });

    const visibleCompletions = completions.filter((c) => {
      if (!c.task) return true;
      return isTaskVisibleToUser(c.task, viewer);
    });

    const formattedNotes = visibleCompletions.map((c) => {
      // Aggregate reactions
      const counts: Record<string, number> = { FIRE: 0, STRONG: 0, CLAP: 0, CELEBRATE: 0, LIKE: 0 };
      const userReactions: string[] = [];

      c.reactions.forEach((r) => {
        if (counts[r.emoji] !== undefined) counts[r.emoji]++;
        if (r.userId === userId) userReactions.push(r.emoji);
      });

      return {
        id: c.id,
        completionDate: c.completionDate,
        completedAt: c.completedAt,
        studyNote: c.studyNote,
        user: c.user,
        isOwnNote: c.user.id === userId,
        reactionCounts: counts,
        userReactions,
      };
    });

    return res.json({
      success: true,
      notes: formattedNotes,
    });
  } catch (err: any) {
    console.error('getGroupNotes error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group notes.' });
  }
}

/**
 * Promote an accepted member to Admin (Owner or Admin only)
 */
export async function promoteMemberToAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { id, targetUserId } = req.params;

    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: currentUserId } },
    });

    if (!callerMembership || (callerMembership.role !== 'OWNER' && callerMembership.role !== 'ADMIN')) {
      return res.status(403).json({ success: false, error: 'Forbidden. Only Owners and Admins can promote members.' });
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: targetUserId } },
    });

    if (!targetMembership) {
      return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
    }

    if (targetMembership.role === 'OWNER') {
      return res.status(400).json({ success: false, error: 'User is already the Owner.' });
    }

    await prisma.groupMember.update({
      where: { id: targetMembership.id },
      data: { role: 'ADMIN' },
    });

    return res.json({
      success: true,
      message: 'Member promoted to Admin successfully.',
    });
  } catch (err: any) {
    console.error('promoteMemberToAdmin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to promote member.' });
  }
}

/**
 * Remove a member from the group (ONLY OWNER has removal permission!)
 */
export async function removeMemberFromGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { id, targetUserId } = req.params;

    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: currentUserId } },
    });

    // Enforce: ONLY the Owner can remove members or admins!
    if (!callerMembership || callerMembership.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. Only the Group Owner has permission to remove members or Admins.',
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, error: 'Owner cannot remove themselves using this endpoint. Use leave group instead.' });
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: targetUserId } },
    });

    if (!targetMembership) {
      return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Remove membership
      await tx.groupMember.delete({
        where: { id: targetMembership.id },
      });

      // 2. Archive or detach member's task for this group so it no longer appears active
      await tx.task.updateMany({
        where: { userId: targetUserId, groupId: id },
        data: { status: 'ARCHIVED' },
      });
    });

    return res.json({
      success: true,
      message: 'Member removed from group successfully.',
    });
  } catch (err: any) {
    console.error('removeMemberFromGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to remove member.' });
  }
}

/**
 * Leave a group
 */
export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (!membership) {
      return res.status(404).json({ success: false, error: 'You are not a member of this group.' });
    }

    const totalMembers = await prisma.groupMember.count({
      where: { groupId: id },
    });

    if (membership.role === 'OWNER') {
      if (totalMembers <= 1) {
        // Sole member and owner: safely delete the group and clean up
        await prisma.$transaction(async (tx) => {
          await tx.task.updateMany({
            where: { groupId: id },
            data: { status: 'ARCHIVED', groupId: null },
          });
          await tx.group.delete({ where: { id } });
        });
        return res.json({ success: true, message: 'You left and the group was deleted.' });
      } else {
        // Multiple members: transfer ownership to the earliest Admin, or earliest Member
        const nextAdmin = await prisma.groupMember.findFirst({
          where: { groupId: id, userId: { not: userId }, role: 'ADMIN' },
          orderBy: { joinedAt: 'asc' },
        });

        const nextOwner = nextAdmin || await prisma.groupMember.findFirst({
          where: { groupId: id, userId: { not: userId } },
          orderBy: { joinedAt: 'asc' },
        });

        await prisma.$transaction(async (tx) => {
          if (nextOwner) {
            await tx.group.update({
              where: { id },
              data: { ownerId: nextOwner.userId },
            });
            await tx.groupMember.update({
              where: { id: nextOwner.id },
              data: { role: 'OWNER' },
            });
          }
          await tx.groupMember.delete({
            where: { id: membership.id },
          });
          // Archive user's group task
          await tx.task.updateMany({
            where: { userId, groupId: id },
            data: { status: 'ARCHIVED' },
          });
        });

        return res.json({ success: true, message: 'You left the group. Ownership transferred.' });
      }
    } else {
      // Regular member or admin leaving
      await prisma.$transaction(async (tx) => {
        await tx.groupMember.delete({
          where: { id: membership.id },
        });
        await tx.task.updateMany({
          where: { userId, groupId: id },
          data: { status: 'ARCHIVED' },
        });
      });

      return res.json({ success: true, message: 'You left the group.' });
    }
  } catch (err: any) {
    console.error('leaveGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to leave group.' });
  }
}

/**
 * Update group details (Owner only)
 * Updates name, description, and scheduledDays, and synchronizes all active tasks associated with this group.
 */
export async function updateGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. Only the Group Owner can edit group details.',
      });
    }

    const parseResult = updateGroupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid group update data',
      });
    }

    const { name, description, scheduledDays, hiddenFrom, visibleOnlyTo } = parseResult.data;

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (description !== undefined) dataToUpdate.description = description;
      if (scheduledDays !== undefined) dataToUpdate.scheduledDays = scheduledDays;
      if (hiddenFrom !== undefined) dataToUpdate.hiddenFrom = hiddenFrom;
      if (visibleOnlyTo !== undefined) dataToUpdate.visibleOnlyTo = visibleOnlyTo;

      const group = await tx.group.update({
        where: { id },
        data: dataToUpdate,
      });

      // Synchronize all tasks associated with this group
      const taskUpdateData: any = {};
      if (name !== undefined) taskUpdateData.title = name;
      if (description !== undefined) taskUpdateData.description = description;
      if (scheduledDays !== undefined) taskUpdateData.scheduledDays = scheduledDays;

      if (Object.keys(taskUpdateData).length > 0) {
        await tx.task.updateMany({
          where: { groupId: id },
          data: taskUpdateData,
        });
      }

      return group;
    });

    return res.json({
      success: true,
      message: 'Group updated successfully.',
      group: updatedGroup,
    });
  } catch (err: any) {
    console.error('updateGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update group.' });
  }
}

/**
 * Update member-level privacy for a specific group
 * A member can hide their presence in this group from specific users.
 */
export async function updateMemberGroupPrivacy(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params; // groupId
    const { hiddenFrom } = req.body;

    if (!Array.isArray(hiddenFrom)) {
      return res.status(400).json({ success: false, error: 'hiddenFrom must be an array of usernames/IDs.' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Forbidden. You are not a member of this group.' });
    }

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: id, userId } },
      data: {
        hiddenFrom,
      },
    });

    return res.json({
      success: true,
      message: 'Member privacy updated.',
      hiddenFrom: updated.hiddenFrom,
    });
  } catch (err: any) {
    console.error('updateMemberGroupPrivacy error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update member privacy.' });
  }
}

/**
 * Get all pending join requests across all groups where caller is OWNER or ADMIN
 */
export async function getAllOwnerJoinRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    // Find all groups where caller is OWNER or ADMIN
    const managedMemberships = await prisma.groupMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { groupId: true },
    });

    const managedGroupIds = managedMemberships.map((m) => m.groupId);

    if (managedGroupIds.length === 0) {
      return res.json({ success: true, requests: [] });
    }

    const requests = await prisma.groupJoinRequest.findMany({
      where: {
        groupId: { in: managedGroupIds },
        status: 'PENDING',
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            joinCode: true,
            scheduledDays: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        groupName: r.group.name,
        joinCode: r.group.joinCode,
        scheduledDays: r.group.scheduledDays,
        userId: r.userId,
        user: r.user,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('getAllOwnerJoinRequests error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve owner join requests.' });
  }
}

/**
 * Invite any user or friend to a group
 * Any accepted member of the group can invite others.
 */
export async function inviteToGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const inviterId = req.user!.userId;
    const { id } = req.params; // groupId

    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true },
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: inviterId } },
    });

    if (!membership && group.ownerId !== inviterId) {
      return res.status(403).json({ success: false, error: 'Forbidden. You must be a member of this group to invite others.' });
    }

    const parseResult = inviteToGroupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Target user ID or username is required.' });
    }

    const { inviteeUserId, inviteeUsername } = parseResult.data;
    if (!inviteeUserId && !inviteeUsername) {
      return res.status(400).json({ success: false, error: 'Please specify a user ID or username to invite.' });
    }

    let targetUser = null;
    if (inviteeUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: inviteeUserId },
        select: { id: true, name: true, username: true },
      });
    } else if (inviteeUsername) {
      const cleanUsername = inviteeUsername.trim().toLowerCase().replace(/^@/, '');
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { normalizedUsername: cleanUsername },
            { username: { equals: cleanUsername, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, username: true },
      });
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (targetUser.id === inviterId) {
      return res.status(400).json({ success: false, error: 'You cannot invite yourself to a group.' });
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: targetUser.id } },
    });
    if (existingMember) {
      return res.status(400).json({ success: false, error: `${targetUser.name || targetUser.username} is already a member of this group.` });
    }


    // Check existing invitation
    const existingInvite = await prisma.groupInvitation.findUnique({
      where: { groupId_inviteeId: { groupId: id, inviteeId: targetUser.id } },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      return res.status(400).json({ success: false, error: 'An invitation is already pending for this user.' });
    }

    // Create or update invitation to PENDING
    const invitation = await prisma.groupInvitation.upsert({
      where: { groupId_inviteeId: { groupId: id, inviteeId: targetUser.id } },
      create: {
        groupId: id,
        inviterId,
        inviteeId: targetUser.id,
        status: 'PENDING',
      },
      update: {
        inviterId,
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    // Send notification to invitee
    const inviterUser = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { name: true, username: true },
    });

    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        category: 'SYSTEM',
        title: 'Group Invitation',
        message: `${inviterUser?.name || inviterUser?.username || 'A friend'} invited you to join "${group.name}".`,
        actionUrl: '/groups',
      },
    });

    return res.status(201).json({
      success: true,
      message: `Invitation sent to ${targetUser.name || targetUser.username}!`,
      invitation,
    });
  } catch (err: any) {
    console.error('inviteToGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send group invitation.' });
  }
}

/**
 * Get all pending invitations received by current user
 */
export async function getUserGroupInvitations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    const invitations = await prisma.groupInvitation.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            joinCode: true,
            scheduledDays: true,
            _count: { select: { members: true } },
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            username: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      invitations: invitations.map((inv) => ({
        id: inv.id,
        groupId: inv.groupId,
        groupName: inv.group.name,
        groupDescription: inv.group.description,
        joinCode: inv.group.joinCode,
        scheduledDays: inv.group.scheduledDays,
        memberCount: inv.group._count.members,
        inviter: inv.inviter,
        createdAt: inv.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('getUserGroupInvitations error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group invitations.' });
  }
}

/**
 * Respond to an invitation (ACCEPT or REJECT)
 */
export async function respondToGroupInvitation(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { invitationId } = req.params;
    const { action } = req.body; // 'ACCEPT' | 'REJECT'

    if (action !== 'ACCEPT' && action !== 'REJECT') {
      return res.status(400).json({ success: false, error: 'Action must be ACCEPT or REJECT.' });
    }

    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });

    if (!invitation || invitation.inviteeId !== userId) {
      return res.status(404).json({ success: false, error: 'Invitation not found.' });
    }

    const group = invitation.group;
    if (!group) {
      return res.status(404).json({ success: false, error: 'Associated group not found.' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `This invitation has already been ${invitation.status.toLowerCase()}.` });
    }

    if (action === 'REJECT') {
      await prisma.groupInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' },
      });

      return res.json({
        success: true,
        message: 'Group invitation declined.',
      });
    }

    // Check if inviter is the owner or an admin
    const inviterMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: invitation.inviterId } },
    });
    const isInviterOwnerOrAdmin =
      group.ownerId === invitation.inviterId ||
      inviterMembership?.role === 'OWNER' ||
      inviterMembership?.role === 'ADMIN';

    if (!isInviterOwnerOrAdmin) {
      // The invitation was from a regular member:
      // "my friend can invite his friend 'even he is not a friend to the owner'.. but the owner and admin should approve"
      await prisma.$transaction(async (tx) => {
        await tx.groupInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        });

        await tx.groupJoinRequest.upsert({
          where: { groupId_userId: { groupId: group.id, userId } },
          create: {
            groupId: group.id,
            userId,
            status: 'PENDING',
          },
          update: {
            status: 'PENDING',
            updatedAt: new Date(),
          },
        });

        const acceptingUser = await tx.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true },
        });
        const inviterUser = await tx.user.findUnique({
          where: { id: invitation.inviterId },
          select: { name: true, username: true },
        });

        await tx.notification.create({
          data: {
            userId: group.ownerId,
            category: 'SYSTEM',
            title: 'Group Join Approval Needed',
            message: `${acceptingUser?.name || acceptingUser?.username || 'A friend'} accepted an invitation from @${inviterUser?.username || 'a member'} to join "${group.name}". Waiting for your approval.`,
            actionUrl: `/groups/${group.id}`,
          },
        });
      });

      return res.json({
        success: true,
        requiresApproval: true,
        message: 'Invitation accepted! Your membership is pending approval by the group owner/admin.',
      });
    }

    // Direct join if invited by owner or admin
    await prisma.$transaction(async (tx) => {
      // 1. Mark invitation accepted
      await tx.groupInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      });

      // 2. Add as GroupMember
      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: {
          groupId: group.id,
          userId,
          role: 'MEMBER',
        },
        update: {
          role: 'MEMBER',
        },
      });

      // 3. Create or activate shared group task
      const existingTask = await tx.task.findFirst({
        where: {
          userId,
          groupId: group.id,
        },
      });

      if (!existingTask) {
        await tx.task.create({
          data: {
            userId,
            groupId: group.id,
            isGroupTask: true,
            title: group.name,
            description: group.description || `Shared group habit for ${group.name}`,
            scheduledDays: group.scheduledDays,
            category: 'Group Task',
            recurrence: 'DAILY',
            status: 'ACTIVE',
            currentStreak: 0,
            longestStreak: 0,
            freezeBalance: 0,
            freezeRechargeDays: 0,
          },
        });
      } else if (existingTask.status === 'ARCHIVED') {
        await tx.task.update({
          where: { id: existingTask.id },
          data: {
            status: 'ACTIVE',
            title: group.name,
            description: group.description || existingTask.description,
            scheduledDays: group.scheduledDays,
          },
        });
      }
    });

    return res.json({
      success: true,
      message: `You joined "${group.name}"! The shared group task is now active on your dashboard.`,
      groupId: group.id,
    });
  } catch (err: any) {
    console.error('respondToGroupInvitation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process group invitation.' });
  }
}

/**
 * Add / Re-activate group as a dashboard task
 */
export async function makeGroupTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
      include: { group: true },
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Forbidden. You must be an accepted member of this group.' });
    }

    const group = membership.group;

    // Check existing task for this group & user
    const existingTask = await prisma.task.findFirst({
      where: { userId, groupId: id },
    });

    let task;
    if (existingTask) {
      task = await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          status: 'ACTIVE',
          title: group.name,
          description: group.description || existingTask.description,
          scheduledDays: group.scheduledDays,
        },
      });
    } else {
      task = await prisma.task.create({
        data: {
          userId,
          groupId: group.id,
          isGroupTask: true,
          title: group.name,
          description: group.description || `Shared group habit for ${group.name}`,
          scheduledDays: group.scheduledDays,
          category: 'Group Task',
          recurrence: 'DAILY',
          status: 'ACTIVE',
          currentStreak: 0,
          longestStreak: 0,
          freezeBalance: 0,
          freezeRechargeDays: 0,
        },
      });
    }

    return res.json({
      success: true,
      message: `"${group.name}" has been added to your dashboard tasks.`,
      task,
    });
  } catch (err: any) {
    console.error('makeGroupTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to make group task.' });
  }
}

/**
 * Remove group task from dashboard without leaving the group
 */
export async function removeGroupTask(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const existingTask = await prisma.task.findFirst({
      where: { userId, groupId: id, status: 'ACTIVE' },
    });

    if (!existingTask) {
      return res.status(404).json({ success: false, error: 'No active task found for this group.' });
    }

    await prisma.task.update({
      where: { id: existingTask.id },
      data: { status: 'ARCHIVED' },
    });

    return res.json({
      success: true,
      message: 'Group task removed from your dashboard. Your membership and group streak remain preserved.',
    });
  } catch (err: any) {
    console.error('removeGroupTask error:', err);
    return res.status(500).json({ success: false, error: 'Failed to remove group task.' });
  }
}
