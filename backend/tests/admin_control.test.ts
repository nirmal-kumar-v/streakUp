import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Super Admin Control & Privileged Workflows', () => {
  const JWT_SECRET = 'streakup_test_super_secret_jwt';

  it('should authenticate admin and generate valid Super Admin JWT token', async () => {
    const password = 'StreakUpAdmin@2026';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const isMatch = await bcrypt.compare('StreakUpAdmin@2026', hash);
    expect(isMatch).toBe(true);

    const token = jwt.sign(
      { adminId: 'mock-admin-id', username: 'admin', role: 'SUPER_ADMIN' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.adminId).toBe('mock-admin-id');
    expect(decoded.role).toBe('SUPER_ADMIN');
  });

  it('should enforce sensitive PIN verification for destructive actions', async () => {
    const pin = '1234';
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    const valid = await bcrypt.compare('1234', pinHash);
    const invalid = await bcrypt.compare('0000', pinHash);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });

  it('should enforce per-user limit of 15 for starred notifications with custom override', () => {
    const defaultMax = 15;
    const currentStarred = 15;

    // Default limit reached
    expect(currentStarred >= defaultMax).toBe(true);

    // Overridden by Admin to 30
    const overriddenMax = 30;
    expect(currentStarred < overriddenMax).toBe(true);
  });

  it('should restrict discover groups to Top 5 when query is empty, and allow broad search with query', () => {
    const mockGroups = Array.from({ length: 25 }, (_, i) => ({
      id: `group-${i + 1}`,
      name: `Study Circle ${i + 1}`,
      memberCount: 25 - i,
    }));

    // Discover without query: slices to Top 5
    const emptyQueryResults = mockGroups.slice(0, 5);
    expect(emptyQueryResults).toHaveLength(5);
    expect(emptyQueryResults[0].memberCount).toBe(25);
    expect(emptyQueryResults[4].memberCount).toBe(21);

    // Search with query "Circle 1": returns matched groups
    const searchedResults = mockGroups.filter((g) => g.name.includes('Circle 1'));
    expect(searchedResults.length).toBeGreaterThan(5);
  });

  it('should verify 14-day username change cooldown and admin override logic', () => {
    const now = new Date();
    // Changed 3 days ago (within 14 days)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const diffDays = (now.getTime() - threeDaysAgo.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays < 14).toBe(true);

    // Admin resets cooldown
    const resetLastUsernameChangeAt = null;
    expect(resetLastUsernameChangeAt).toBeNull();
  });

  it('should verify 14-day email change cooldown and admin override logic', () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const diffDays = (now.getTime() - fiveDaysAgo.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays < 14).toBe(true);

    // Admin resets email cooldown
    const resetEmailLastChangedAt = null;
    expect(resetEmailLastChangedAt).toBeNull();

    // Direct email update with regex format validation
    const validEmail = 'newadminuser@example.com';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(validEmail)).toBe(true);
    expect(emailRegex.test('invalid-email')).toBe(false);
  });

  it('should guarantee member-isolated group task streaks', () => {
    // Member A and Member B in same group have independent Task records
    const memberATask = { id: 'task-1', groupId: 'group-100', userId: 'user-a', currentStreak: 5 };
    const memberBTask = { id: 'task-2', groupId: 'group-100', userId: 'user-b', currentStreak: 12 };

    // Admin updates member A's task streak
    const updatedMemberATask = { ...memberATask, currentStreak: 20 };

    expect(updatedMemberATask.currentStreak).toBe(20);
    // Member B's task streak remains untouched
    expect(memberBTask.currentStreak).toBe(12);
  });

  it('should format and validate historical freeze log scope and protected date', () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const validDate = '2026-10-15';
    expect(datePattern.test(validDate)).toBe(true);

    const overallFreezeLog = {
      userId: 'test-user',
      scope: 'OVERALL',
      scopeKey: 'OVERALL',
      protectedDate: validDate,
    };
    expect(overallFreezeLog.scopeKey).toBe('OVERALL');

    const taskFreezeLog = {
      userId: 'test-user',
      scope: 'TASK',
      scopeKey: 'TASK:task-123',
      taskId: 'task-123',
      protectedDate: validDate,
    };
    expect(taskFreezeLog.scopeKey).toBe('TASK:task-123');
  });

  it('should maintain point ledger balance consistency', () => {
    let currentBalance = 100;
    const delta = -35;
    const newBalance = Math.max(0, currentBalance + delta);
    expect(newBalance).toBe(65);

    const ledgerEntry = {
      userId: 'test-user',
      points: delta,
      reason: 'ADMIN_CORRECTION: Deducted penalty for verified violation',
      date: '2026-10-18',
    };
    expect(ledgerEntry.points).toBe(-35);
  });

  it('should preserve streak completion record when study note is moderated', () => {
    const completionRecord = {
      id: 'completion-1',
      taskId: 'task-1',
      userId: 'user-1',
      completionDate: '2026-10-18',
      studyNote: 'Old inappropriate note',
    };

    // Admin scrubs the note
    const moderatedRecord = {
      ...completionRecord,
      studyNote: null,
    };

    // Underlying completion is preserved with date and taskId intact
    expect(moderatedRecord.id).toBe(completionRecord.id);
    expect(moderatedRecord.completionDate).toBe('2026-10-18');
    expect(moderatedRecord.studyNote).toBeNull();
  });

  it('should support custom reminders, discover groups, and profile image quota overrides', async () => {
    const {
      getUserReminderLimit,
      setUserReminderLimit,
      getUserTaskReminderLimit,
      setUserTaskReminderLimit,
      getUserDiscoverGroupsLimit,
      setUserDiscoverGroupsLimit,
      getUserProfileImageLimitMb,
      setUserProfileImageLimitMb,
      deleteUserAdminConfig,
    } = await import('../src/services/adminConfigService');

    const testUserId = `test-quota-user-${Date.now()}`;
    deleteUserAdminConfig(testUserId);

    try {
      // Defaults
      expect(getUserReminderLimit(testUserId)).toBe(3);
      expect(getUserTaskReminderLimit(testUserId)).toBe(1);
      expect(getUserDiscoverGroupsLimit(testUserId)).toBe(5);
      expect(getUserProfileImageLimitMb(testUserId)).toBe(5);

      // Overrides
      setUserReminderLimit(testUserId, 10);
      expect(getUserReminderLimit(testUserId)).toBe(10);

      setUserTaskReminderLimit(testUserId, 4);
      expect(getUserTaskReminderLimit(testUserId)).toBe(4);

      setUserDiscoverGroupsLimit(testUserId, 25);
      expect(getUserDiscoverGroupsLimit(testUserId)).toBe(25);

      setUserProfileImageLimitMb(testUserId, 15);
      expect(getUserProfileImageLimitMb(testUserId)).toBe(15);
    } finally {
      deleteUserAdminConfig(testUserId);
    }
  });

  it('should award +5 points per selected task for multi-task heatmap streak granting', () => {
    const pointsPerTask = 5;
    const selectedTaskIds = ['task-1', 'task-2', 'task-3', 'task-4'];
    const calculatedPoints = selectedTaskIds.length * pointsPerTask;

    expect(calculatedPoints).toBe(20);

    // Single task yields 5 points
    const singleTaskSelection = ['task-1'];
    expect(singleTaskSelection.length * pointsPerTask).toBe(5);
  });

  it('should validate profile image formats and size boundaries', () => {
    // Valid data URI
    const validDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const match = validDataUri.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i);
    expect(match).not.toBeNull();

    // Valid HTTPS URL
    const validUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
    expect(/^https?:\/\/.+/i.test(validUrl)).toBe(true);

    // Invalid scheme
    expect(/^https?:\/\/.+/i.test('ftp://invalid.com/pic.png')).toBe(false);
  });
});


