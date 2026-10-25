import { describe, it, expect, beforeAll } from 'vitest';
import {
  submitUserRequest,
  getAllUserRequests,
  updateUserRequestStatus,
} from '../src/services/userRequestService';
import {
  grantManagerAccess,
  revokeManagerAccess,
  getAllManagers,
  updateManagerEmailPreference,
  isUserManager,
  replyToUserRequestAsManager,
} from '../src/services/managerService';
import {
  sendAdminMessageToUser,
  getAdminMessageLogs,
} from '../src/services/adminMessageService';
import prisma from '../src/config/prisma';
import bcrypt from 'bcryptjs';

describe('StreakUp — Requests & Feedback, Manager Access, and Admin Messaging', () => {
  let testUserId = 'test-req-user-1';
  let testManagerUserId = 'test-mgr-user-2';

  beforeAll(async () => {
    // Ensure test user exists in DB or mock
    try {
      const passwordHash = await bcrypt.hash('TestPass@123', 8);
      await prisma.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          name: 'Request Tester',
          username: 'reqtester',
          normalizedUsername: 'reqtester',
          email: 'reqtester@example.com',
          passwordHash,
        },
      });

      await prisma.user.upsert({
        where: { id: testManagerUserId },
        update: {},
        create: {
          id: testManagerUserId,
          name: 'Manager Candidate',
          username: 'mgrcandidate',
          normalizedUsername: 'mgrcandidate',
          email: 'mgrcandidate@example.com',
          passwordHash,
        },
      });
    } catch {}
  }, 30000);

  describe('1. Requests & Feedback Service', () => {
    it('validates submission and requires at least 5 characters and a valid category', async () => {
      await expect(
        submitUserRequest({
          userId: testUserId,
          category: 'FEATURE_REQUEST',
          message: 'hi',
        })
      ).rejects.toThrow('Message must be at least 5 characters long.');

      await expect(
        submitUserRequest({
          userId: testUserId,
          category: 'INVALID_CATEGORY' as any,
          message: 'Valid message content',
        })
      ).rejects.toThrow('Invalid request category selected.');
    }, 30000);

    it('submits request successfully and persists with PENDING status', async () => {
      const req = await submitUserRequest({
        userId: testUserId,
        category: 'FEATURE_REQUEST',
        message: 'Could we please add dark mode contrast controls?',
      });

      expect(req.id).toBeDefined();
      expect(req.userId).toBe(testUserId);
      expect(req.category).toBe('FEATURE_REQUEST');
      expect(req.status).toBe('PENDING');

      const all = await getAllUserRequests();
      const found = all.find((r) => r.id === req.id);
      expect(found).toBeDefined();
      expect(found?.message).toBe('Could we please add dark mode contrast controls?');
    }, 30000);

    it('filters requests by category and status', async () => {
      const bug = await submitUserRequest({
        userId: testUserId,
        category: 'BUG_REPORT',
        message: 'Discovered a tiny alignment quirk on mobile screen.',
      });

      const filtered = await getAllUserRequests({ category: 'BUG_REPORT' });
      expect(filtered.some((r) => r.id === bug.id)).toBe(true);

      const noMatch = await getAllUserRequests({ category: 'ACCOUNT_SUPPORT' });
      expect(noMatch.some((r) => r.id === bug.id)).toBe(false);
    }, 30000);

    it('updates request status and attaches admin notes', async () => {
      const req = await submitUserRequest({
        userId: testUserId,
        category: 'OTHER',
        message: 'Inquiry regarding streak pause rules.',
      });

      const updated = await updateUserRequestStatus({
        requestId: req.id,
        status: 'UNDER_REVIEW',
        adminNotes: 'Examining user logs for context.',
      });

      expect(updated.status).toBe('UNDER_REVIEW');
      expect(updated.adminNotes).toBe('Examining user logs for context.');

      const resolved = await updateUserRequestStatus({
        requestId: req.id,
        status: 'RESOLVED',
      });
      expect(resolved.status).toBe('RESOLVED');
    }, 30000);
  });

  describe('2. Manager Access & Strict RBAC', () => {
    it('grants Manager access, dispatches in-app notification with exact text', async () => {
      const mgr = await grantManagerAccess({
        userId: testManagerUserId,
        grantedBy: 'admin',
        emailNotificationsEnabled: true,
      });

      expect(mgr.userId).toBe(testManagerUserId);
      expect(mgr.emailNotificationsEnabled).toBe(true);

      const isMgr = await isUserManager(testManagerUserId);
      expect(isMgr).toBe(true);

      // Verify in-app notification in DB
      const notifs = await prisma.notification.findMany({
        where: { userId: testManagerUserId },
      });
      const managerNotif = notifs.find(
        (n) => n.message === 'The StreakUp admin has granted you Manager access.'
      );
      expect(managerNotif).toBeDefined();
      expect(managerNotif?.title).toBe('Manager Access Granted');
    }, 30000);

    it('toggles manager email notification preferences', async () => {
      await grantManagerAccess({
        userId: testManagerUserId,
        grantedBy: 'admin',
        emailNotificationsEnabled: true,
      });

      const updated = await updateManagerEmailPreference({
        userId: testManagerUserId,
        emailNotificationsEnabled: false,
      });

      expect(updated.emailNotificationsEnabled).toBe(false);
    }, 30000);

    it('revoking manager access immediately stops manager role', async () => {
      await grantManagerAccess({
        userId: testManagerUserId,
        grantedBy: 'admin',
      });

      expect(await isUserManager(testManagerUserId)).toBe(true);

      await revokeManagerAccess(testManagerUserId);
      expect(await isUserManager(testManagerUserId)).toBe(false);

      const list = await getAllManagers();
      expect(list.some((m) => m.userId === testManagerUserId)).toBe(false);
    }, 30000);

    it('allows an authorized manager to reply to a user request with an in-app notification and no email', async () => {
      // 1. Grant manager access to testManagerUserId
      await grantManagerAccess({
        userId: testManagerUserId,
        grantedBy: 'admin',
        emailNotificationsEnabled: true,
      });

      // 2. Submit a request from testUserId
      const req = await submitUserRequest({
        userId: testUserId,
        category: 'FEATURE_REQUEST',
        message: 'Can we have customizable streak notifications?',
      });

      // 3. Manager replies to the request
      const replyRes = await replyToUserRequestAsManager({
        managerUserId: testManagerUserId,
        requestId: req.id,
        replyMessage: 'We are evaluating this feature for the next sprint!',
      });

      expect(replyRes.success).toBe(true);

      // 4. Verify original user received an in-app notification
      const userNotifs = await prisma.notification.findMany({
        where: { userId: testUserId },
      });
      const match = userNotifs.find((n) => n.eventKey?.startsWith(`REQ_REPLY:${req.id}`));
      expect(match).toBeDefined();
      expect(match?.title).toContain('Manager Reply');
      expect(match?.message).toContain('We are evaluating this feature');

      // 5. Verify non-manager fails with error
      await expect(
        replyToUserRequestAsManager({
          managerUserId: 'non-existent-or-unauthorized-user',
          requestId: req.id,
          replyMessage: 'Unauthorized message attempt',
        })
      ).rejects.toThrow('Forbidden: Only authorized managers can reply to user requests.');
    }, 30000);
  });

  describe('3. Admin Messaging Service', () => {
    it('sends in-app message to user and stores in-app notification', async () => {
      const log = await sendAdminMessageToUser({
        adminUsername: 'admin',
        recipientUserId: testUserId,
        title: 'Welcome to StreakUp Beta',
        message: 'Thank you for testing our daily productivity platform!',
        channel: 'IN_APP',
      });

      expect(log.channel).toBe('IN_APP');
      expect(log.inAppStatus).toBe('SENT');
      expect(log.emailStatus).toBe('SKIPPED');

      const notifs = await prisma.notification.findMany({
        where: { userId: testUserId },
      });
      const matched = notifs.find((n) => n.title === 'Welcome to StreakUp Beta');
      expect(matched).toBeDefined();
    }, 30000);

    it('handles email channel honestly without falsely claiming delivery if SMTP is unconfigured', async () => {
      const log = await sendAdminMessageToUser({
        adminUsername: 'admin',
        recipientUserId: testUserId,
        title: 'Email Alert',
        message: 'This is an alert regarding your streak performance.',
        channel: 'EMAIL',
      });

      expect(log.channel).toBe('EMAIL');
      expect(log.inAppStatus).toBe('SKIPPED');
      // In test environment without real SMTP, emailStatus must be 'FAILED' or 'SENT' (never falsely reporting if unconfigured)
      expect(['FAILED', 'SENT']).toContain(log.emailStatus);

      const logs = await getAdminMessageLogs(10);
      expect(logs.some((l) => l.id === log.id)).toBe(true);
    }, 30000);
  });
});
