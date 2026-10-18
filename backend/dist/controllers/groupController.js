"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroup = createGroup;
exports.searchGroups = searchGroups;
exports.requestToJoinGroup = requestToJoinGroup;
exports.cancelJoinRequest = cancelJoinRequest;
exports.getGroupJoinRequests = getGroupJoinRequests;
exports.respondToJoinRequest = respondToJoinRequest;
exports.getUserGroups = getUserGroups;
exports.getGroupDetails = getGroupDetails;
exports.getGroupLeaderboards = getGroupLeaderboards;
exports.getGroupNotes = getGroupNotes;
exports.promoteMemberToAdmin = promoteMemberToAdmin;
exports.removeMemberFromGroup = removeMemberFromGroup;
exports.leaveGroup = leaveGroup;
const zod_1 = require("zod");
const luxon_1 = require("luxon");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const createGroupSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(3, 'Group name must be at least 3 characters').max(50),
    description: zod_1.z.string().trim().max(300).optional().nullable(),
    scheduledDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1, 'Please select at least one day').optional().default([0, 1, 2, 3, 4, 5, 6]),
});
/**
 * Generates a unique, professional group code like "GATE-X7K2" or "GRP-9J2P"
 */
async function generateUniqueGroupCode(groupName) {
    const cleanName = groupName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    const prefix = cleanName.length >= 3 ? cleanName : 'GRP';
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let attempt = 0; attempt < 15; attempt++) {
        let suffix = '';
        for (let i = 0; i < 4; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const code = `${prefix}-${suffix}`;
        const existing = await prisma_1.default.group.findUnique({
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
async function getFriendshipStatus(currentUserId, targetUserId) {
    if (currentUserId === targetUserId)
        return 'SELF';
    const [u1, u2] = currentUserId < targetUserId ? [currentUserId, targetUserId] : [targetUserId, currentUserId];
    const friendship = await prisma_1.default.friendship.findUnique({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (friendship)
        return 'FRIENDS';
    const sent = await prisma_1.default.friendRequest.findFirst({
        where: { senderId: currentUserId, receiverId: targetUserId, status: 'PENDING' },
    });
    if (sent)
        return 'REQUEST_SENT';
    const received = await prisma_1.default.friendRequest.findFirst({
        where: { senderId: targetUserId, receiverId: currentUserId, status: 'PENDING' },
    });
    if (received)
        return 'REQUEST_RECEIVED';
    return 'NONE';
}
/**
 * Calculates current week range (Monday to Sunday) in user's timezone
 */
function getLocalWeekRange(timezone = timezoneService_1.DEFAULT_TIMEZONE, referenceDate) {
    const zone = (0, timezoneService_1.isValidTimezone)(timezone) ? timezone : timezoneService_1.DEFAULT_TIMEZONE;
    const now = referenceDate ? luxon_1.DateTime.fromJSDate(referenceDate).setZone(zone) : luxon_1.DateTime.now().setZone(zone);
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
async function createGroup(req, res) {
    try {
        const userId = req.user.userId;
        const parseResult = createGroupSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0]?.message || 'Invalid group details',
            });
        }
        const { name, description, scheduledDays } = parseResult.data;
        const joinCode = await generateUniqueGroupCode(name);
        const group = await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (err) {
        console.error('createGroup error:', err);
        return res.status(500).json({ success: false, error: 'Failed to create group.' });
    }
}
/**
 * Search groups by name or unique code.
 * Strict privacy rule: Does NOT reveal member lists, profiles, or personal streaks.
 */
async function searchGroups(req, res) {
    try {
        const currentUserId = req.user.userId;
        const rawQuery = (req.query.q || '').trim();
        let whereClause = {};
        if (rawQuery) {
            whereClause = {
                OR: [
                    { name: { contains: rawQuery, mode: 'insensitive' } },
                    { joinCode: { equals: rawQuery.toUpperCase() } },
                ],
            };
        }
        const groups = await prisma_1.default.group.findMany({
            where: whereClause,
            take: 25,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                joinCode: true,
                scheduledDays: true,
                createdAt: true,
                _count: {
                    select: { members: true },
                },
            },
        });
        // Check membership and join request status for current user for each group
        const groupsWithStatus = await Promise.all(groups.map(async (g) => {
            const membership = await prisma_1.default.groupMember.findUnique({
                where: { groupId_userId: { groupId: g.id, userId: currentUserId } },
                select: { role: true },
            });
            let requestStatus = null;
            if (!membership) {
                const req = await prisma_1.default.groupJoinRequest.findUnique({
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
        }));
        return res.json({
            success: true,
            groups: groupsWithStatus,
        });
    }
    catch (err) {
        console.error('searchGroups error:', err);
        return res.status(500).json({ success: false, error: 'Failed to search groups.' });
    }
}
/**
 * Submit a Request to Join a group
 */
async function requestToJoinGroup(req, res) {
    try {
        const userId = req.user.userId;
        const groupIdOrCode = req.params.id || req.body.groupId || req.body.joinCode;
        if (!groupIdOrCode || typeof groupIdOrCode !== 'string') {
            return res.status(400).json({ success: false, error: 'Group identifier or code is required.' });
        }
        const group = await prisma_1.default.group.findFirst({
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
        const existingMember = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: group.id, userId } },
        });
        if (existingMember) {
            return res.status(400).json({ success: false, error: 'You are already an accepted member of this group.' });
        }
        // Check existing join request
        const existingReq = await prisma_1.default.groupJoinRequest.findUnique({
            where: { groupId_userId: { groupId: group.id, userId } },
        });
        if (existingReq && existingReq.status === 'PENDING') {
            return res.status(400).json({ success: false, error: 'You already have a pending join request for this group.' });
        }
        // Upsert join request to PENDING
        const joinRequest = await prisma_1.default.groupJoinRequest.upsert({
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
    }
    catch (err) {
        console.error('requestToJoinGroup error:', err);
        return res.status(500).json({ success: false, error: 'Failed to submit join request.' });
    }
}
/**
 * Cancel a user's own pending join request
 */
async function cancelJoinRequest(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const request = await prisma_1.default.groupJoinRequest.findFirst({
            where: {
                groupId: id,
                userId,
                status: 'PENDING',
            },
        });
        if (!request) {
            return res.status(404).json({ success: false, error: 'No pending join request found for this group.' });
        }
        await prisma_1.default.groupJoinRequest.update({
            where: { id: request.id },
            data: { status: 'CANCELLED' },
        });
        return res.json({
            success: true,
            message: 'Join request cancelled.',
        });
    }
    catch (err) {
        console.error('cancelJoinRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to cancel join request.' });
    }
}
/**
 * List pending join requests for a group (Owner and Admin only)
 */
async function getGroupJoinRequests(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        // Must be Owner or Admin
        const membership = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId } },
        });
        if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, error: 'Forbidden. Only group Owners and Admins can view join requests.' });
        }
        const requests = await prisma_1.default.groupJoinRequest.findMany({
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
    }
    catch (err) {
        console.error('getGroupJoinRequests error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve join requests.' });
    }
}
/**
 * Respond to a join request (ACCEPT or REJECT) (Owner and Admin only)
 * When ACCEPTED: automatically assigns shared group task to the member!
 */
async function respondToJoinRequest(req, res) {
    try {
        const adminUserId = req.user.userId;
        const { id, requestId } = req.params;
        const { action } = req.body; // 'ACCEPT' | 'REJECT'
        if (action !== 'ACCEPT' && action !== 'REJECT') {
            return res.status(400).json({ success: false, error: 'Action must be ACCEPT or REJECT.' });
        }
        // Check admin / owner permissions
        const adminMembership = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: adminUserId } },
        });
        if (!adminMembership || (adminMembership.role !== 'OWNER' && adminMembership.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, error: 'Forbidden. Only group Owners and Admins can accept or reject requests.' });
        }
        const joinRequest = await prisma_1.default.groupJoinRequest.findUnique({
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
            await prisma_1.default.groupJoinRequest.update({
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
        await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (err) {
        console.error('respondToJoinRequest error:', err);
        return res.status(500).json({ success: false, error: 'Failed to process join request.' });
    }
}
/**
 * List all groups user belongs to
 */
async function getUserGroups(req, res) {
    try {
        const userId = req.user.userId;
        const memberships = await prisma_1.default.groupMember.findMany({
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
        const groups = await Promise.all(memberships.map(async (m) => {
            let pendingRequestsCount = 0;
            if (m.role === 'OWNER' || m.role === 'ADMIN') {
                pendingRequestsCount = await prisma_1.default.groupJoinRequest.count({
                    where: { groupId: m.group.id, status: 'PENDING' },
                });
            }
            // Fetch user's individual streak on this shared group task
            const memberTask = await prisma_1.default.task.findFirst({
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
        }));
        return res.json({
            success: true,
            groups,
        });
    }
    catch (err) {
        console.error('getUserGroups error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve groups.' });
    }
}
/**
 * Get group details, shared task status for current user, and member list
 */
async function getGroupDetails(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        // Check accepted membership
        const membership = await prisma_1.default.groupMember.findUnique({
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
        const group = await prisma_1.default.group.findUnique({
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
        // Fetch user's timezone for today's date
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const timezone = currentUser?.timezone || 'Asia/Kolkata';
        const todayDateStr = (0, timezoneService_1.getLocalDateString)(timezone);
        // Fetch user's assigned group task
        const userTask = await prisma_1.default.task.findFirst({
            where: { userId, groupId: id },
            include: {
                completions: {
                    where: { completionDate: todayDateStr },
                    select: { id: true, completionDate: true, completedAt: true, studyNote: true },
                },
            },
        });
        const completedToday = (userTask?.completions?.length || 0) > 0;
        const todayStudyNote = completedToday ? userTask.completions[0].studyNote : null;
        // Count pending join requests if Owner/Admin
        let pendingRequestsCount = 0;
        if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
            pendingRequestsCount = await prisma_1.default.groupJoinRequest.count({
                where: { groupId: id, status: 'PENDING' },
            });
        }
        // Build members list with individual task streaks and friendship status
        const members = await Promise.all(group.members.map(async (m) => {
            const mTask = await prisma_1.default.task.findFirst({
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
        }));
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
                pendingRequestsCount,
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
                        completedToday,
                        todayStudyNote,
                    }
                    : null,
                members,
            },
        });
    }
    catch (err) {
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
async function getGroupLeaderboards(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const type = req.query.type === 'weekly' ? 'weekly' : 'streak';
        // Verify membership
        const membership = await prisma_1.default.groupMember.findUnique({
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
        const group = await prisma_1.default.group.findUnique({
            where: { id },
            select: { id: true, name: true, scheduledDays: true },
        });
        if (!group) {
            return res.status(404).json({ success: false, error: 'Group not found.' });
        }
        const members = await prisma_1.default.groupMember.findMany({
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
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const timezone = user?.timezone || timezoneService_1.DEFAULT_TIMEZONE;
        const { startDate, endDate } = getLocalWeekRange(timezone);
        const rankedList = await Promise.all(members.map(async (m) => {
            // Individual group task
            const memberTask = await prisma_1.default.task.findFirst({
                where: { userId: m.user.id, groupId: id },
                select: { id: true, currentStreak: true, longestStreak: true },
            });
            // Weekly completions count (within current week)
            let weeklyCompletions = 0;
            if (memberTask) {
                weeklyCompletions = await prisma_1.default.taskCompletion.count({
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
        }));
        if (type === 'weekly') {
            rankedList.sort((a, b) => {
                if (b.weeklyCompletions !== a.weeklyCompletions)
                    return b.weeklyCompletions - a.weeklyCompletions;
                if (b.currentStreak !== a.currentStreak)
                    return b.currentStreak - a.currentStreak;
                if (b.longestStreak !== a.longestStreak)
                    return b.longestStreak - a.longestStreak;
                return a.name.localeCompare(b.name);
            });
        }
        else {
            rankedList.sort((a, b) => {
                if (b.currentStreak !== a.currentStreak)
                    return b.currentStreak - a.currentStreak;
                if (b.longestStreak !== a.longestStreak)
                    return b.longestStreak - a.longestStreak;
                if (b.weeklyCompletions !== a.weeklyCompletions)
                    return b.weeklyCompletions - a.weeklyCompletions;
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
    }
    catch (err) {
        console.error('getGroupLeaderboards error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve group leaderboard.' });
    }
}
/**
 * Get Study Notes on Group Task completions (Accepted members only)
 */
async function getGroupNotes(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        // Verify membership
        const membership = await prisma_1.default.groupMember.findUnique({
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
        // Fetch completions of any task with groupId = id where studyNote is present
        const completions = await prisma_1.default.taskCompletion.findMany({
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
                reactions: true,
            },
            orderBy: [
                { completionDate: 'desc' },
                { completedAt: 'desc' },
            ],
            take: 50,
        });
        const formattedNotes = completions.map((c) => {
            // Aggregate reactions
            const counts = { FIRE: 0, STRONG: 0, CLAP: 0, CELEBRATE: 0 };
            const userReactions = [];
            c.reactions.forEach((r) => {
                if (counts[r.emoji] !== undefined)
                    counts[r.emoji]++;
                if (r.userId === userId)
                    userReactions.push(r.emoji);
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
    }
    catch (err) {
        console.error('getGroupNotes error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve group notes.' });
    }
}
/**
 * Promote an accepted member to Admin (Owner or Admin only)
 */
async function promoteMemberToAdmin(req, res) {
    try {
        const currentUserId = req.user.userId;
        const { id, targetUserId } = req.params;
        const callerMembership = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: currentUserId } },
        });
        if (!callerMembership || (callerMembership.role !== 'OWNER' && callerMembership.role !== 'ADMIN')) {
            return res.status(403).json({ success: false, error: 'Forbidden. Only Owners and Admins can promote members.' });
        }
        const targetMembership = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: targetUserId } },
        });
        if (!targetMembership) {
            return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
        }
        if (targetMembership.role === 'OWNER') {
            return res.status(400).json({ success: false, error: 'User is already the Owner.' });
        }
        await prisma_1.default.groupMember.update({
            where: { id: targetMembership.id },
            data: { role: 'ADMIN' },
        });
        return res.json({
            success: true,
            message: 'Member promoted to Admin successfully.',
        });
    }
    catch (err) {
        console.error('promoteMemberToAdmin error:', err);
        return res.status(500).json({ success: false, error: 'Failed to promote member.' });
    }
}
/**
 * Remove a member from the group (ONLY OWNER has removal permission!)
 */
async function removeMemberFromGroup(req, res) {
    try {
        const currentUserId = req.user.userId;
        const { id, targetUserId } = req.params;
        const callerMembership = await prisma_1.default.groupMember.findUnique({
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
        const targetMembership = await prisma_1.default.groupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: targetUserId } },
        });
        if (!targetMembership) {
            return res.status(404).json({ success: false, error: 'Target user is not a member of this group.' });
        }
        await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (err) {
        console.error('removeMemberFromGroup error:', err);
        return res.status(500).json({ success: false, error: 'Failed to remove member.' });
    }
}
/**
 * Leave a group
 */
async function leaveGroup(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const membership = await prisma_1.default.groupMember.findUnique({
            where: {
                groupId_userId: { groupId: id, userId },
            },
        });
        if (!membership) {
            return res.status(404).json({ success: false, error: 'You are not a member of this group.' });
        }
        const totalMembers = await prisma_1.default.groupMember.count({
            where: { groupId: id },
        });
        if (membership.role === 'OWNER') {
            if (totalMembers <= 1) {
                // Sole member and owner: safely delete the group and clean up
                await prisma_1.default.$transaction(async (tx) => {
                    await tx.task.updateMany({
                        where: { groupId: id },
                        data: { status: 'ARCHIVED', groupId: null },
                    });
                    await tx.group.delete({ where: { id } });
                });
                return res.json({ success: true, message: 'You left and the group was deleted.' });
            }
            else {
                // Multiple members: transfer ownership to the earliest Admin, or earliest Member
                const nextAdmin = await prisma_1.default.groupMember.findFirst({
                    where: { groupId: id, userId: { not: userId }, role: 'ADMIN' },
                    orderBy: { joinedAt: 'asc' },
                });
                const nextOwner = nextAdmin || await prisma_1.default.groupMember.findFirst({
                    where: { groupId: id, userId: { not: userId } },
                    orderBy: { joinedAt: 'asc' },
                });
                await prisma_1.default.$transaction(async (tx) => {
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
        }
        else {
            // Regular member or admin leaving
            await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (err) {
        console.error('leaveGroup error:', err);
        return res.status(500).json({ success: false, error: 'Failed to leave group.' });
    }
}
