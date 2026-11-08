import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../src/config/prisma';
import { getTaskFriendsLeaderboard } from '../src/controllers/friendTaskController';
import { checkAndTriggerFriendActivityAlerts } from '../src/services/notificationService';

describe('Group Isolation & No Similar Task Cross-Contamination', () => {
  const userAId = 'test-user-group-iso-a';
  const userBId = 'test-user-group-iso-b';
  const groupId = 'test-group-iso-1';
  const groupTaskId = 'test-task-group-iso-1';
  const personalTaskId = 'test-task-personal-iso-2';

  beforeEach(async () => {
    // Clean up
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.taskCompletion.deleteMany({ where: { taskId: { in: [groupTaskId, personalTaskId] } } });
    await prisma.task.deleteMany({ where: { id: { in: [groupTaskId, personalTaskId] } } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id: userAId, user2Id: userBId },
          { user1Id: userBId, user2Id: userAId },
        ],
      },
    });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });

    // Create users A and B (friends)
    await prisma.user.create({
      data: {
        id: userAId,
        email: 'usera@example.com',
        username: 'user_a',
        normalizedUsername: 'user_a',
        name: 'User A',
        passwordHash: 'dummy',
        timezone: 'Asia/Kolkata',
      },
    });

    await prisma.user.create({
      data: {
        id: userBId,
        email: 'userb@example.com',
        username: 'user_b',
        normalizedUsername: 'user_b',
        name: 'User B',
        passwordHash: 'dummy',
        timezone: 'Asia/Kolkata',
      },
    });

    // Make them accepted friends
    const [u1, u2] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    await prisma.friendship.create({
      data: { user1Id: u1, user2Id: u2 },
    });

    // Create a group owned by User A, with User A as the only accepted member
    await prisma.group.create({
      data: {
        id: groupId,
        name: 'LeetCode Daily Circle',
        ownerId: userAId,
        joinCode: 'LCODE99',
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId,
        userId: userAId,
        role: 'OWNER',
      },
    });

    // Group task for User A
    await prisma.task.create({
      data: {
        id: groupTaskId,
        userId: userAId,
        groupId,
        title: 'LeetCode Daily Challenge',
        recurrence: 'DAILY',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        status: 'ACTIVE',
      },
    });

    // Personal task for User B with identical/similar name
    await prisma.task.create({
      data: {
        id: personalTaskId,
        userId: userBId,
        groupId: null, // User B is NOT in the group!
        title: 'LeetCode Daily Challenge',
        recurrence: 'DAILY',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.taskCompletion.deleteMany({ where: { taskId: { in: [groupTaskId, personalTaskId] } } });
    await prisma.task.deleteMany({ where: { id: { in: [groupTaskId, personalTaskId] } } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id: userAId, user2Id: userBId },
          { user1Id: userBId, user2Id: userAId },
        ],
      },
    });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it('group task leaderboard does NOT include external friend who created a similar task', async () => {
    let responseData: any = null;
    const req: any = {
      user: { userId: userAId },
      params: { id: groupTaskId },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
        return res;
      },
      status: () => res,
    };

    await getTaskFriendsLeaderboard(req, res);

    expect(responseData).toBeDefined();
    expect(responseData.success).toBe(true);
    // Leaderboard must ONLY contain User A (the accepted group member). User B must NOT appear!
    const participantUsernames = responseData.leaderboard.map((e: any) => e.username);
    expect(participantUsernames).toContain('user_a');
    expect(participantUsernames).not.toContain('user_b');
    // Suggested matches must be empty (no fuzzy matching / similar task suggestions)
    expect(responseData.suggestedMatches).toEqual([]);
  });

  it('personal task does NOT cross-match with group task or friends', async () => {
    let responseData: any = null;
    const req: any = {
      user: { userId: userBId },
      params: { id: personalTaskId },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
        return res;
      },
      status: () => res,
    };

    await getTaskFriendsLeaderboard(req, res);

    expect(responseData).toBeDefined();
    expect(responseData.success).toBe(true);
    // Only User B is in their own personal task leaderboard
    const participantUsernames = responseData.leaderboard.map((e: any) => e.username);
    expect(participantUsernames).toEqual(['user_b']);
    expect(responseData.suggestedMatches).toEqual([]);
  });

  it('completing a personal task does NOT dispatch a matching-task alert to group task owner', async () => {
    await checkAndTriggerFriendActivityAlerts({
      completedUserId: userBId,
      completedTaskId: personalTaskId,
      completedTaskTitle: 'LeetCode Daily Challenge',
    });

    // Check if User A received any notification
    const userANotifs = await prisma.notification.findMany({
      where: { userId: userAId },
    });

    // User A should NOT receive any FRIEND_TASK_ACTIVITY alert for User B's personal task!
    const taskActivityNotif = userANotifs.find((n) => n.category === 'FRIEND_TASK_ACTIVITY');
    expect(taskActivityNotif).toBeUndefined();
  });
});
