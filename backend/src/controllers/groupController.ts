import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const createGroupSchema = z.object({
  name: z.string().trim().min(3, 'Group name must be at least 3 characters').max(50),
  description: z.string().trim().max(300).optional().nullable()
});

/**
 * Generate a random 6-character alphanumeric join code (e.g. "STRK79")
 */
async function generateUniqueJoinCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars (I, 1, O, 0)
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.group.findUnique({
      where: { joinCode: code }
    });
    if (!existing) {
      return code;
    }
  }
  // Fallback timestamp-based code
  return `GRP${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/**
 * Create a new group
 */
export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const parseResult = createGroupSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid group details'
      });
    }

    const { name, description } = parseResult.data;
    const joinCode = await generateUniqueJoinCode();

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          description: description || null,
          joinCode,
          ownerId: userId
        }
      });

      // Creator is automatically OWNER member
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId,
          role: 'OWNER'
        }
      });

      return newGroup;
    });

    return res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        joinCode: group.joinCode,
        ownerId: group.ownerId,
        memberCount: 1,
        userRole: 'OWNER'
      }
    });
  } catch (err: any) {
    console.error('createGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create group.' });
  }
}

/**
 * Join a group using unique join code
 */
export async function joinGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const rawCode = req.body.joinCode;

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ success: false, error: 'Please enter a valid join code.' });
    }

    const joinCode = rawCode.trim().toUpperCase();

    const group = await prisma.group.findUnique({
      where: { joinCode },
      include: {
        _count: { select: { members: true } }
      }
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'No group found with this join code.' });
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ success: false, error: 'You are already a member of this group.' });
    }

    // Join group
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'MEMBER'
      }
    });

    return res.json({
      success: true,
      message: `Successfully joined ${group.name}!`,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        joinCode: group.joinCode,
        memberCount: group._count.members + 1,
        userRole: 'MEMBER'
      }
    });
  } catch (err: any) {
    console.error('joinGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to join group.' });
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
            _count: { select: { members: true } }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      joinCode: m.group.joinCode,
      owner: m.group.owner,
      role: m.role,
      isOwner: m.role === 'OWNER',
      memberCount: m.group._count.members,
      joinedAt: m.joinedAt
    }));

    return res.json({
      success: true,
      groups
    });
  } catch (err: any) {
    console.error('getUserGroups error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve groups.' });
  }
}

/**
 * Get group details and member list
 */
export async function getGroupDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: id,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Forbidden. You must be a member to view this group.' });
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
                currentStreak: true,
                longestStreak: true,
                points: true
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const members = group.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      username: m.user.username,
      profileImage: m.user.profileImage,
      role: m.role,
      currentStreak: m.user.currentStreak,
      longestStreak: m.user.longestStreak,
      points: m.user.points,
      joinedAt: m.joinedAt
    }));

    return res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        joinCode: group.joinCode,
        owner: group.owner,
        userRole: membership.role,
        memberCount: members.length,
        createdAt: group.createdAt,
        members
      }
    });
  } catch (err: any) {
    console.error('getGroupDetails error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group details.' });
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
        groupId_userId: {
          groupId: id,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(404).json({ success: false, error: 'You are not a member of this group.' });
    }

    const totalMembers = await prisma.groupMember.count({
      where: { groupId: id }
    });

    if (membership.role === 'OWNER') {
      if (totalMembers <= 1) {
        // Sole member and owner: safely delete the group
        await prisma.group.delete({
          where: { id }
        });
        return res.json({ success: true, message: 'You left and the group was deleted.' });
      } else {
        // Multiple members: transfer ownership to the next earliest joined member
        const nextOwner = await prisma.groupMember.findFirst({
          where: { groupId: id, userId: { not: userId } },
          orderBy: { joinedAt: 'asc' }
        });

        await prisma.$transaction(async (tx) => {
          if (nextOwner) {
            await tx.group.update({
              where: { id },
              data: { ownerId: nextOwner.userId }
            });
            await tx.groupMember.update({
              where: { id: nextOwner.id },
              data: { role: 'OWNER' }
            });
          }
          await tx.groupMember.delete({
            where: { id: membership.id }
          });
        });

        return res.json({ success: true, message: 'You left the group. Ownership transferred.' });
      }
    } else {
      // Regular member: remove membership
      await prisma.groupMember.delete({
        where: { id: membership.id }
      });
      return res.json({ success: true, message: 'You left the group.' });
    }
  } catch (err: any) {
    console.error('leaveGroup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to leave group.' });
  }
}

/**
 * Group leaderboards: Streak & Points
 */
export async function getGroupLeaderboards(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const type = req.query.type === 'points' ? 'points' : 'streak';

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: id,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Forbidden. You must be a member to view this group leaderboard.' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, name: true }
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
            currentStreak: true,
            longestStreak: true,
            points: true
          }
        }
      }
    });

    // Deterministic sorting
    const rankedList = members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      username: m.user.username,
      profileImage: m.user.profileImage,
      role: m.role,
      currentStreak: m.user.currentStreak,
      longestStreak: m.user.longestStreak,
      points: m.user.points,
      isCurrentUser: m.user.id === userId
    }));

    if (type === 'points') {
      rankedList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        return a.name.localeCompare(b.name);
      });
    } else {
      rankedList.sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
      });
    }

    const leaderboardWithRank = rankedList.map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));

    return res.json({
      success: true,
      groupId: group.id,
      groupName: group.name,
      type,
      leaderboard: leaderboardWithRank
    });
  } catch (err: any) {
    console.error('getGroupLeaderboards error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve group leaderboard.' });
  }
}
