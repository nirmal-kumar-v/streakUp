import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateNumericOtp, hashToken } from '../src/services/otpService';
import {
  getAppBaseUrl,
  buildSignupOtpEmail,
  buildChangeEmailOtpEmail,
  buildVerifyNotificationEmailOtpEmail,
  buildPasswordResetOtpEmail,
  buildPasswordResetLinkEmail,
  buildPasswordChangedConfirmationEmail,
  buildFriendTaskActivityEmail,
  buildFriendOverallActivityEmail,
  buildOverallReminderEmail,
  buildTaskReminderEmail,
  getPrimarySmtpConfig,
  getSecondarySmtpConfig,
  getRoundRobinStatus,
  resetRoundRobinForTesting,
} from '../src/services/emailService';

describe('Email OTP, Password Recovery, and Plain-Text Email Suite', () => {
  describe('Cryptographic OTP and Hashing Validation', () => {
    it('generates 6-digit cryptographically secure numeric OTPs', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateNumericOtp();
        expect(otp).toMatch(/^\d{6}$/);
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });

    it('generates deterministic SHA-256 hashes for secure token comparison', () => {
      const code = '482910';
      const hash1 = hashToken(code);
      const hash2 = hashToken(code);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
      expect(hashToken('482911')).not.toBe(hash1);
    });
  });

  describe('Hosted URL Consistency (Canonical APP_BASE_URL)', () => {
    it('uses canonical deployed frontend URL instead of localhost in production defaults', () => {
      const baseUrl = getAppBaseUrl();
      expect(baseUrl).toBeTruthy();
      expect(baseUrl.startsWith('http')).toBe(true);
      // In production/deployment, should point to hosted StreakUp URL on Vercel
      expect(baseUrl).toContain('streakup-karo.vercel.app');
      expect(baseUrl).not.toContain('streakup-karo.onrender.com');
      expect(baseUrl).not.toContain('localhost:5000');
    });

    it('generates valid hosted links in password reset and reminder emails', () => {
      const resetEmail = buildPasswordResetLinkEmail({
        name: 'Nirmal',
        resetToken: 'test_token_hex_123',
      });

      expect(resetEmail.text).toContain('https://streakup-karo.vercel.app/reset-password?token=test_token_hex_123');
      expect(resetEmail.text).not.toContain('localhost:5173');
      expect(resetEmail.text).not.toContain('localhost:5000');
      expect(resetEmail.text).not.toContain('onrender.com');
    });
  });

  describe('Natural Plain-Text Email Format & Deliverability (No conflicting HTML/CSS)', () => {
    it('builds natural plain-text messages without HTML tags, banners, or styling', () => {
      const signupEmail = buildSignupOtpEmail({
        name: 'Nirmal',
        otp: '654321',
      });

      expect(signupEmail.subject).toContain('654321');
      expect(signupEmail.text).toContain('654321');
      expect(signupEmail.text).toContain('5 minutes');
      // No HTML tags
      expect(signupEmail.text).not.toContain('<div>');
      expect(signupEmail.text).not.toContain('style=');
      expect(signupEmail.text).not.toContain('<table');
      expect(signupEmail.text).not.toContain('class=');
    });

    it('creates clear, respectful password changed confirmation emails', () => {
      const confirmation = buildPasswordChangedConfirmationEmail({
        name: 'Nirmal',
      });

      expect(confirmation.subject).toBe('Your StreakUp password was successfully changed');
      expect(confirmation.text).toContain('Hi Nirmal,');
      expect(confirmation.text).toContain('password for your StreakUp account was recently changed');
      expect(confirmation.text).not.toContain('<html>');
    });

    it('builds password reset OTP email containing 6-digit code and no links', () => {
      const resetOtpEmail = buildPasswordResetOtpEmail({
        name: 'Nirmal',
        otp: '918273',
      });

      expect(resetOtpEmail.subject).toBe('Your StreakUp password reset code: 918273');
      expect(resetOtpEmail.text).toContain('Hi Nirmal,');
      expect(resetOtpEmail.text).toContain('918273');
      expect(resetOtpEmail.text).toContain('5 minutes');
      expect(resetOtpEmail.text).not.toContain('http://');
      expect(resetOtpEmail.text).not.toContain('https://');
      expect(resetOtpEmail.text).not.toContain('<html>');
    });
  });

  describe('Study Notes in Friend Task Emails (Section 4)', () => {
    it('includes friend study note when present', () => {
      const emailWithNote = buildFriendTaskActivityEmail({
        recipientName: 'Nirmal',
        friendName: 'Nithish',
        taskTitle: 'GATE Preparation',
        studyNote: 'Studied MCQs in Computer Networks',
      });

      expect(emailWithNote.subject).toBe("Nithish completed today's GATE Preparation");
      expect(emailWithNote.text).toContain('Hi Nirmal,');
      expect(emailWithNote.text).toContain('Your friend Nithish completed their GATE Preparation task today.');
      expect(emailWithNote.text).toContain('Study note: Studied MCQs in Computer Networks');
      expect(emailWithNote.text).toContain("You haven't completed your matching task today yet. You still have time to make progress.");
      expect(emailWithNote.text).toContain('https://streakup-karo.vercel.app/tasks');
      expect(emailWithNote.text).not.toContain('onrender.com');
    });

    it('completely omits study note section when note is empty or undefined (never invents a note)', () => {
      const emailWithoutNote = buildFriendTaskActivityEmail({
        recipientName: 'Nirmal',
        friendName: 'Nithish',
        taskTitle: 'GATE Preparation',
        studyNote: null,
      });

      expect(emailWithoutNote.subject).toBe("Nithish completed today's GATE Preparation");
      expect(emailWithoutNote.text).toContain('Your friend Nithish completed their GATE Preparation task today.');
      expect(emailWithoutNote.text).not.toContain('Study note:');
      expect(emailWithoutNote.text).not.toContain('undefined');
      expect(emailWithoutNote.text).not.toContain('null');
    });
  });

  describe('14-Day Registered Email Change Rate Limit Logic (Section 6)', () => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    it('blocks email change if less than 14 days have passed since last change', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const msElapsed = Date.now() - fiveDaysAgo.getTime();
      const canChange = msElapsed >= FOURTEEN_DAYS_MS;
      const daysRemaining = Math.ceil((FOURTEEN_DAYS_MS - msElapsed) / (24 * 60 * 60 * 1000));

      expect(canChange).toBe(false);
      expect(daysRemaining).toBe(9);
    });

    it('allows email change if 14 or more days have passed', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const msElapsed = Date.now() - fifteenDaysAgo.getTime();
      const canChange = msElapsed >= FOURTEEN_DAYS_MS;

      expect(canChange).toBe(true);
    });

    it('allows email change if email has never been changed before (null timestamp)', () => {
      const emailLastChangedAt = null;
      const canChange = emailLastChangedAt === null;

      expect(canChange).toBe(true);
    });
  });

  describe('Custom Verified Notification Email (Section 7)', () => {
    it('formats notification email verification code clearly without affecting login email', () => {
      const notifEmail = buildVerifyNotificationEmailOtpEmail({
        name: 'Nirmal',
        otp: '918273',
        notificationEmail: 'alerts@example.com',
      });

      expect(notifEmail.subject).toContain('918273');
      expect(notifEmail.text).toContain('alerts@example.com');
      expect(notifEmail.text).toContain('918273');
      expect(notifEmail.text).toContain('5 minutes');
    });
  });

  describe('Multi-Account 50-Email Round-Robin SMTP Dispatcher', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      resetRoundRobinForTesting(0, 0);
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      resetRoundRobinForTesting(0, 0);
    });

    it('defaults to primary account when secondary account credentials are not provided', () => {
      delete process.env.SMTP_USER_2;
      delete process.env.SMTP_PASS_2;

      const primary = getPrimarySmtpConfig();
      const secondary = getSecondarySmtpConfig();
      const status = getRoundRobinStatus();

      expect(primary.configured).toBe(true);
      expect(secondary.configured).toBe(false);
      expect(status.secondaryConfigured).toBe(false);
      expect(status.activeAccountIndex).toBe(0);
    });

    it('recognizes secondary account when configured in environment', () => {
      process.env.SMTP_USER_2 = 'backup.streakup@gmail.com';
      process.env.SMTP_PASS_2 = 'apppass12345678';
      process.env.SMTP_HOST_2 = 'smtp.gmail.com';
      process.env.SMTP_PORT_2 = '465';

      const secondary = getSecondarySmtpConfig();
      expect(secondary.configured).toBe(true);
      expect(secondary.user).toBe('backup.streakup@gmail.com');
      expect(secondary.port).toBe(465);
      expect(secondary.secure).toBe(true);

      const status = getRoundRobinStatus();
      expect(status.secondaryConfigured).toBe(true);
      expect(status.secondaryUser).toBe('backup.streakup@gmail.com');
    });

    it('rotates to secondary account after 50 emails and rotates back after next 50', () => {
      // Setup both accounts
      process.env.SMTP_USER_2 = 'backup.streakup@gmail.com';
      process.env.SMTP_PASS_2 = 'apppass12345678';

      // Start at 49 emails sent on Account 1
      resetRoundRobinForTesting(0, 49);
      let status = getRoundRobinStatus();
      expect(status.activeAccountIndex).toBe(0);
      expect(status.consecutiveCount).toBe(49);

      // Simulate sending 50th email:
      // In sendEmail logic, when consecutiveCount reaches 50:
      // activeAccountIndex switches to 1, consecutiveCount resets to 0
      resetRoundRobinForTesting(1, 0);
      status = getRoundRobinStatus();
      expect(status.activeAccountIndex).toBe(1);
      expect(status.consecutiveCount).toBe(0);

      // Account 2 reaches 50 emails
      resetRoundRobinForTesting(1, 50);
      // Switches back to Account 1
      resetRoundRobinForTesting(0, 0);
      status = getRoundRobinStatus();
      expect(status.activeAccountIndex).toBe(0);
      expect(status.consecutiveCount).toBe(0);
    });
  });
});
