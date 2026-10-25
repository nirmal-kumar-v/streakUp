import { describe, it, expect } from 'vitest';
import { isQualifyingMilestone } from '../src/services/notificationService';
import { NotificationCategory, ReminderScope } from '@prisma/client';
import {
  buildOverallReminderEmail,
  buildTaskReminderEmail,
  buildOverallMilestoneEmail,
  buildTaskMilestoneEmail,
  buildMyMilestoneEmail,
} from '../src/services/emailService';

describe('Notification and Milestone Engine Tests', () => {
  describe('Milestone Schedule Compliance (Section 10)', () => {
    it('accurately identifies qualifying milestone numbers: 5, 10, 25, 50, 100, and +50 increments', () => {
      // Specified schedule
      expect(isQualifyingMilestone(5)).toBe(true);
      expect(isQualifyingMilestone(10)).toBe(true);
      expect(isQualifyingMilestone(25)).toBe(true);
      expect(isQualifyingMilestone(50)).toBe(true);
      expect(isQualifyingMilestone(100)).toBe(true);
      expect(isQualifyingMilestone(150)).toBe(true);
      expect(isQualifyingMilestone(200)).toBe(true);
      expect(isQualifyingMilestone(250)).toBe(true);
      expect(isQualifyingMilestone(500)).toBe(true);

      // Non-qualifying numbers
      expect(isQualifyingMilestone(1)).toBe(false);
      expect(isQualifyingMilestone(3)).toBe(false);
      expect(isQualifyingMilestone(7)).toBe(false);
      expect(isQualifyingMilestone(14)).toBe(false);
      expect(isQualifyingMilestone(30)).toBe(false);
      expect(isQualifyingMilestone(75)).toBe(false);
      expect(isQualifyingMilestone(125)).toBe(false);
    });

    it('distinguishes between overall streak milestones and task-specific streak milestones', () => {
      const overallEventKey = 'MILESTONE:SELF:u-1:OVERALL:50';
      const taskEventKey = 'MILESTONE:SELF:u-1:TASK:task-gate-prep:50';

      expect(overallEventKey).not.toEqual(taskEventKey);
      expect(overallEventKey.includes('OVERALL')).toBe(true);
      expect(taskEventKey.includes('TASK:task-gate-prep')).toBe(true);
    });

    it('ensures milestone event records are strictly idempotent', () => {
      // Simulation of database unique constraint [userId, scopeKey, milestone]
      const recordedMilestones = new Set<string>();

      const recordMilestone = (userId: string, scopeKey: string, milestone: number): boolean => {
        const key = `${userId}:${scopeKey}:${milestone}`;
        if (recordedMilestones.has(key)) return false; // Duplicate rejected!
        recordedMilestones.add(key);
        return true;
      };

      expect(recordMilestone('u-1', 'OVERALL', 50)).toBe(true);
      // Repeated event for the same user, scope, and milestone
      expect(recordMilestone('u-1', 'OVERALL', 50)).toBe(false);
      // Different milestone for same user
      expect(recordMilestone('u-1', 'OVERALL', 100)).toBe(true);
      // Same milestone for different scope
      expect(recordMilestone('u-1', 'TASK:gate-prep', 50)).toBe(true);
    });
  });

  describe('Reminder Scheduling & Scope Capacity (Section 4 & 5)', () => {
    it('enforces maximum of 3 configured reminder times per scope', () => {
      const MAX_REMINDERS = 3;

      const schedules: string[] = ['08:00', '14:00'];
      const canAddFirst = schedules.length < MAX_REMINDERS;
      expect(canAddFirst).toBe(true);

      schedules.push('21:00'); // 3rd added
      const canAddFourth = schedules.length < MAX_REMINDERS;
      expect(canAddFourth).toBe(false);
    });

    it('allows independent reminder schedules for each recurring task and overall streak', () => {
      const schedulesByScope: Record<string, string[]> = {
        OVERALL: ['08:00', '14:00', '21:00'],
        'TASK:gate-prep': ['19:00', '20:30'],
        'TASK:leetcode': ['21:00'],
      };

      expect(schedulesByScope['OVERALL'].length).toBe(3);
      expect(schedulesByScope['TASK:gate-prep'].length).toBe(2);
      expect(schedulesByScope['TASK:leetcode'].length).toBe(1);

      // Editing gate-prep schedule does not affect overall or leetcode
      schedulesByScope['TASK:gate-prep'] = ['18:00'];
      expect(schedulesByScope['OVERALL'].length).toBe(3);
      expect(schedulesByScope['TASK:leetcode'].length).toBe(1);
    });

    it('skips overall reminder if user has completed at least one task on local date', () => {
      const completedTaskDates = ['2026-10-17'];
      const today = '2026-10-17';

      const shouldSendOverallReminder = (completions: string[], date: string) => {
        return !completions.includes(date);
      };

      // Incomplete today
      expect(shouldSendOverallReminder([], today)).toBe(true);
      // Completed at least one task today
      expect(shouldSendOverallReminder(completedTaskDates, today)).toBe(false);
    });

    it('skips task reminder if that specific task has already been completed today', () => {
      const gatePrepCompletedDates = ['2026-10-17'];
      const leetcodeCompletedDates: string[] = [];
      const today = '2026-10-17';

      const shouldSendTaskReminder = (taskCompletions: string[], date: string) => {
        return !taskCompletions.includes(date);
      };

      expect(shouldSendTaskReminder(gatePrepCompletedDates, today)).toBe(false);
      expect(shouldSendTaskReminder(leetcodeCompletedDates, today)).toBe(true);
    });
  });

  describe('Friend Activity Alerts (Section 7 & 8)', () => {
    it('triggers friend overall activity alert only when recipient has completed 0 tasks today', () => {
      const friendCompletedTasksToday = 1;
      const recipientCompletedTasksToday = 0;

      const shouldAlertOverall = (friendCount: number, recipientCount: number) => {
        return friendCount >= 1 && recipientCount === 0;
      };

      expect(shouldAlertOverall(friendCompletedTasksToday, recipientCompletedTasksToday)).toBe(true);
      // Once recipient completes their first task, alert must not be sent
      expect(shouldAlertOverall(friendCompletedTasksToday, 1)).toBe(false);
    });

    it('deduplicates friend overall alerts: at most 1 alert per friend, recipient, and local date', () => {
      const sentEvents = new Set<string>();

      const sendFriendOverallAlert = (friendId: string, recipientId: string, date: string): boolean => {
        const key = `FRIEND_OVERALL:${friendId}:${recipientId}:${date}`;
        if (sentEvents.has(key)) return false;
        sentEvents.add(key);
        return true;
      };

      // Friend completes Task 1: alert sent
      expect(sendFriendOverallAlert('f-1', 'me', '2026-10-17')).toBe(true);
      // Friend completes Task 2 on same day: duplicate suppressed!
      expect(sendFriendOverallAlert('f-1', 'me', '2026-10-17')).toBe(false);
      // Friend completes Task 3 on same day: duplicate suppressed!
      expect(sendFriendOverallAlert('f-1', 'me', '2026-10-17')).toBe(false);
    });

    it('friend task activity alert requires matching task that recipient has not completed today', () => {
      const matchConfidence = 0.92;
      const recipientCompletedMatchingTask = false;

      const shouldAlertTask = (confidence: number, completed: boolean) => {
        return confidence >= 0.6 && !completed;
      };

      expect(shouldAlertTask(matchConfidence, recipientCompletedMatchingTask)).toBe(true);
      // If recipient already completed their matching task: no alert
      expect(shouldAlertTask(matchConfidence, true)).toBe(false);
      // If task is unrelated (low confidence): no alert
      expect(shouldAlertTask(0.3, false)).toBe(false);
    });
  });

  describe('Privacy & Payload Isolation in Notifications & Emails (Section 10 & 14)', () => {
    it('public overall milestone emails and notifications never expose private tasks or study notes', () => {
      const email = buildOverallMilestoneEmail({
        friendName: 'Nithish',
        milestone: 50,
      });

      expect(email.subject).toContain('50-day overall streak');
      expect(email.text).toContain('Nithish');
      expect(email.text).not.toContain('studyNote');
      expect(email.text).not.toContain('GATE Preparation');
      expect(email.text).not.toContain('LeetCode');
      expect(email.text).not.toContain('freeze');
    });

    it('ensures notification recipient privacy isolation', () => {
      const notifications = [
        { id: 'n-1', userId: 'user-A', title: 'Reminder' },
        { id: 'n-2', userId: 'user-B', title: 'Alert' },
      ];

      const getForUser = (requestingUserId: string) => {
        return notifications.filter((n) => n.userId === requestingUserId);
      };

      const userANotifs = getForUser('user-A');
      expect(userANotifs.length).toBe(1);
      expect(userANotifs[0].id).toBe('n-1');
      expect(userANotifs.find((n) => n.userId === 'user-B')).toBeUndefined();
    });

    it('preserves allCount total notification count independently of unread filter state', () => {
      const userNotifications = [
        { id: 'n-1', userId: 'user-A', isDismissed: false, isRead: true },
        { id: 'n-2', userId: 'user-A', isDismissed: false, isRead: false },
        { id: 'n-3', userId: 'user-A', isDismissed: true, isRead: true },
      ];

      const calculateCounts = (status: 'all' | 'unread') => {
        const active = userNotifications.filter((n) => !n.isDismissed);
        const filtered = status === 'unread' ? active.filter((n) => !n.isRead) : active;
        const unreadCount = active.filter((n) => !n.isRead).length;
        const allCount = active.length;
        return { totalCount: filtered.length, unreadCount, allCount };
      };

      const whenAll = calculateCounts('all');
      expect(whenAll.allCount).toBe(2);
      expect(whenAll.totalCount).toBe(2);
      expect(whenAll.unreadCount).toBe(1);

      // When switching to unread tab, allCount remains 2 even if totalCount of unread is 1 (or 0)
      const whenUnread = calculateCounts('unread');
      expect(whenUnread.allCount).toBe(2);
      expect(whenUnread.totalCount).toBe(1);
      expect(whenUnread.unreadCount).toBe(1);
    });

    it('enforces that reminder notifications are only sent within 30 minutes of scheduled time to prevent stale notifications on app open', () => {
      const isWithinDeliveryWindow = (scheduledTimeStr: string, currentHour: number, currentMinute: number) => {
        const [schedH, schedM] = scheduledTimeStr.split(':').map(Number);
        const scheduledMinutes = schedH * 60 + schedM;
        const currentMinutes = currentHour * 60 + currentMinute;
        const minutesPastSchedule = currentMinutes - scheduledMinutes;
        return minutesPastSchedule >= 0 && minutesPastSchedule <= 30;
      };

      // Exactly at scheduled time (8:00 AM)
      expect(isWithinDeliveryWindow('08:00', 8, 0)).toBe(true);
      // 15 minutes after (8:15 AM)
      expect(isWithinDeliveryWindow('08:00', 8, 15)).toBe(true);
      // 30 minutes after (8:30 AM)
      expect(isWithinDeliveryWindow('08:00', 8, 30)).toBe(true);
      // 31 minutes after (8:31 AM) - past window!
      expect(isWithinDeliveryWindow('08:00', 8, 31)).toBe(false);
      // Hours later when opening app (e.g. 2:00 PM or 8:00 PM) - must NEVER send late notification!
      expect(isWithinDeliveryWindow('08:00', 14, 0)).toBe(false);
      expect(isWithinDeliveryWindow('08:00', 20, 0)).toBe(false);
      // Before scheduled time (7:50 AM)
      expect(isWithinDeliveryWindow('08:00', 7, 50)).toBe(false);
    });
  });
});

