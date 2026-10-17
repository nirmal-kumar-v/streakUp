import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { isValidTimezone, DEFAULT_TIMEZONE } from '../services/timezoneService';
import { isDatabaseConnectionError, DB_CONNECTION_NOTICE } from '../utils/dbError';
import { OtpPurpose, NotificationCategory } from '@prisma/client';
import {
  createEmailOtp,
  verifyEmailOtp,
  createPasswordResetToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../services/otpService';
import {
  sendEmail,
  buildSignupOtpEmail,
  buildPasswordResetOtpEmail,
  buildPasswordResetLinkEmail,
  buildPasswordChangedConfirmationEmail,
  getAppBaseUrl,
} from '../services/emailService';
import { getOrCreateNotificationPreferences } from '../services/notificationService';

const JWT_SECRET = process.env.JWT_SECRET || 'streakup_dev_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';

// Registration schema validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(25, 'Username cannot exceed 25 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().optional(),
  timezone: z.string().optional(),
}).refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Login schema validation
const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Verify OTP schema
const verifyOtpSchema = z.object({
  email: z.string().email('Valid email address required'),
  otp: z.string().trim().min(6, '6-digit OTP code required').max(6, '6-digit OTP code required'),
});

// Resend OTP schema
const resendOtpSchema = z.object({
  email: z.string().email('Valid email address required'),
});

// Forgot password schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email address required'),
});

// Reset password schema (supports OTP or token)
const resetPasswordSchema = z.object({
  email: z.string().email('Valid email address required').optional(),
  otp: z.string().trim().min(6, '6-digit OTP code required').max(6, '6-digit OTP code required').optional(),
  token: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().optional(),
}).refine(data => !data.confirmPassword || data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
}).refine(data => (data.email && data.otp) || Boolean(data.token), {
  message: 'Email and 6-digit verification code are required',
  path: ['otp']
});

/**
 * Register a new user:
 * - Creates unverified account record
 * - Issues cryptographically secure 6-digit OTP
 * - Dispatches plain-text verification email
 * - Returns pendingVerification: true (no JWT token until verified)
 */
export async function register(req: Request, res: Response) {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input data';
      return res.status(400).json({ success: false, error: firstError, details: parseResult.error.errors });
    }

    const { name, username, email, password, timezone } = parseResult.data;
    const cleanUsername = username.trim();
    const normalizedUsername = cleanUsername.toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered and verified
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingEmail && existingEmail.isEmailVerified) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please log in.'
      });
    }

    // Check if username already taken by another verified user
    const existingUsername = await prisma.user.findUnique({
      where: { normalizedUsername }
    });

    if (existingUsername && existingUsername.isEmailVerified && existingUsername.id !== existingEmail?.id) {
      return res.status(409).json({
        success: false,
        error: `Username "${cleanUsername}" is already taken. Please choose another.`
      });
    }

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Validate timezone or use default
    const userTimezone = timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;

    // Create or update the pending unverified user record
    let user;
    if (existingEmail && !existingEmail.isEmailVerified) {
      user = await prisma.user.update({
        where: { id: existingEmail.id },
        data: {
          name: name.trim(),
          username: cleanUsername,
          normalizedUsername,
          passwordHash,
          timezone: userTimezone,
          isEmailVerified: false,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          username: cleanUsername,
          normalizedUsername,
          email: cleanEmail,
          passwordHash,
          timezone: userTimezone,
          currentStreak: 0,
          longestStreak: 0,
          isEmailVerified: false,
        },
      });
    }

    // Generate and store secure 6-digit OTP
    const otpResult = await createEmailOtp({
      email: cleanEmail,
      purpose: OtpPurpose.SIGNUP,
      userId: user.id,
    });

    if (!otpResult.success) {
      return res.status(429).json({
        success: false,
        error: otpResult.error,
        retryAfterSeconds: otpResult.retryAfterSeconds,
      });
    }

    // Dispatch plain-text verification email asynchronously
    const emailData = buildSignupOtpEmail({
      name: user.name,
      otp: otpResult.otp,
    });

    sendEmail({
      userId: user.id,
      recipientEmail: cleanEmail,
      category: NotificationCategory.SYSTEM,
      subject: emailData.subject,
      text: emailData.text,
      idempotencyKey: `SIGNUP_OTP:${user.id}:${Date.now()}`,
    }).catch((err) => {
      console.error('[authController.register] Failed to dispatch verification email:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please enter the 6-digit code to activate your account.',
      pendingVerification: true,
      email: cleanEmail,
    });
  } catch (err: any) {
    if (isDatabaseConnectionError(err)) {
      console.warn('⚠️ Registration failed: PostgreSQL not connected yet.');
      return res.status(503).json({
        success: false,
        error: DB_CONNECTION_NOTICE
      });
    }
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'Registration failed due to a server error. Please try again.'
    });
  }
}

/**
 * Verify signup OTP and activate user account
 */
export async function verifySignup(req: Request, res: Response) {
  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Email and 6-digit code are required',
      });
    }

    const { email, otp } = parseResult.data;
    const cleanEmail = email.trim().toLowerCase();

    // Verify OTP against hashed database record
    const otpVerification = await verifyEmailOtp({
      email: cleanEmail,
      purpose: OtpPurpose.SIGNUP,
      otp,
    });

    if (!otpVerification.success) {
      return res.status(400).json({
        success: false,
        error: otpVerification.error,
        maxAttemptsExceeded: otpVerification.maxAttemptsExceeded,
      });
    }

    // Find and activate the user account
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found. Please register again.',
      });
    }

    // Activate user
    const activatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        timezone: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
      },
    });

    // Initialize notification preferences
    await getOrCreateNotificationPreferences(activatedUser.id);

    // Issue JWT token
    const token = jwt.sign(
      {
        userId: activatedUser.id,
        username: activatedUser.username,
        email: activatedUser.email,
        timezone: activatedUser.timezone,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Email verified successfully. Welcome to StreakUp!',
      token,
      user: activatedUser,
    });
  } catch (err: any) {
    console.error('verifySignup error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code. Please try again.',
    });
  }
}

/**
 * Resend signup verification OTP with cooldown check
 */
export async function resendSignupOtp(req: Request, res: Response) {
  try {
    const parseResult = resendOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address required',
      });
    }

    const cleanEmail = parseResult.data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No registration found with this email address.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'This account is already verified. Please log in.',
      });
    }

    const otpResult = await createEmailOtp({
      email: cleanEmail,
      purpose: OtpPurpose.SIGNUP,
      userId: user.id,
    });

    if (!otpResult.success) {
      return res.status(429).json({
        success: false,
        error: otpResult.error,
        retryAfterSeconds: otpResult.retryAfterSeconds,
      });
    }

    const emailData = buildSignupOtpEmail({
      name: user.name,
      otp: otpResult.otp,
    });

    sendEmail({
      userId: user.id,
      recipientEmail: cleanEmail,
      category: NotificationCategory.SYSTEM,
      subject: emailData.subject,
      text: emailData.text,
      idempotencyKey: `SIGNUP_OTP_RESEND:${user.id}:${Date.now()}`,
    }).catch((err) => {
      console.error('[authController.resendSignupOtp] Email error:', err);
    });

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
    });
  } catch (err: any) {
    console.error('resendSignupOtp error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to resend verification code.',
    });
  }
}

/**
 * Login with username or email
 */
export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Identifier and password are required'
      });
    }

    const { identifier, password } = parseResult.data;
    const cleanIdentifier = identifier.trim();
    const normalizedIdentifier = cleanIdentifier.toLowerCase();

    // Query user by email OR normalized username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { normalizedUsername: normalizedIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password.'
      });
    }

    // Verify password
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password.'
      });
    }

    // Require email verification before allowing login
    if (!user.isEmailVerified) {
      // Trigger new OTP if needed
      await createEmailOtp({
        email: user.email,
        purpose: OtpPurpose.SIGNUP,
        userId: user.id,
      }).then(async (otpResult) => {
        if (otpResult.success) {
          const emailData = buildSignupOtpEmail({
            name: user.name,
            otp: otpResult.otp,
          });
          sendEmail({
            userId: user.id,
            recipientEmail: user.email,
            category: NotificationCategory.SYSTEM,
            subject: emailData.subject,
            text: emailData.text,
            idempotencyKey: `SIGNUP_OTP_LOGIN_PROMPT:${user.id}:${Date.now()}`,
          }).catch(console.error);
        }
      }).catch(console.error);

      return res.status(403).json({
        success: false,
        error: 'Please verify your email address before logging in. A verification code has been sent to your email.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        timezone: user.timezone
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        timezone: user.timezone,
        profileImage: user.profileImage,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      }
    });
  } catch (err: any) {
    if (isDatabaseConnectionError(err)) {
      return res.status(503).json({
        success: false,
        error: DB_CONNECTION_NOTICE
      });
    }
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Login failed due to a server error.'
    });
  }
}

/**
 * Forgot password:
 * Generates a 6-digit OTP and sends it to the user's email address.
 * Returns a consistent response that does not reveal whether the account exists.
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required',
      });
    }

    const cleanEmail = parseResult.data.email.trim().toLowerCase();

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user && user.isEmailVerified) {
      const otpResult = await createEmailOtp({
        email: cleanEmail,
        purpose: OtpPurpose.PASSWORD_RESET,
        userId: user.id,
      });

      if (otpResult.success) {
        const emailContent = buildPasswordResetOtpEmail({
          name: user.name,
          otp: otpResult.otp,
        });

        sendEmail({
          userId: user.id,
          recipientEmail: user.email,
          category: NotificationCategory.SYSTEM,
          subject: emailContent.subject,
          text: emailContent.text,
          idempotencyKey: `PASSWORD_RESET_OTP:${user.id}:${Date.now()}`,
        }).catch((err) => {
          console.error('[forgotPassword] Error dispatching reset OTP email:', err);
        });
      } else {
        return res.status(429).json({
          success: false,
          error: otpResult.error,
          retryAfterSeconds: otpResult.retryAfterSeconds,
        });
      }
    }

    // Always return a consistent response to prevent email enumeration
    return res.json({
      success: true,
      message: 'If an account exists with this email address, a 6-digit verification code has been sent.',
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request.',
    });
  }
}

/**
 * Resend password reset OTP
 */
export async function resendPasswordResetOtp(req: Request, res: Response) {
  try {
    const parseResult = resendOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address required',
      });
    }

    const cleanEmail = parseResult.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'If an account exists with this email address, a new verification code has been sent.',
      });
    }

    const otpResult = await createEmailOtp({
      email: cleanEmail,
      purpose: OtpPurpose.PASSWORD_RESET,
      userId: user.id,
    });

    if (!otpResult.success) {
      return res.status(429).json({
        success: false,
        error: otpResult.error,
        retryAfterSeconds: otpResult.retryAfterSeconds,
      });
    }

    const emailContent = buildPasswordResetOtpEmail({
      name: user.name,
      otp: otpResult.otp,
    });

    sendEmail({
      userId: user.id,
      recipientEmail: user.email,
      category: NotificationCategory.SYSTEM,
      subject: emailContent.subject,
      text: emailContent.text,
      idempotencyKey: `PASSWORD_RESET_OTP_RESEND:${user.id}:${Date.now()}`,
    }).catch(console.error);

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
    });
  } catch (err: any) {
    console.error('resendPasswordResetOtp error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to resend reset code.',
    });
  }
}

/**
 * Reset password using 6-digit OTP (or token for backward compatibility):
 * Updates the user's password and invalidates the reset code.
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors[0]?.message || 'Invalid reset data';
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const { email, otp, token, newPassword } = parseResult.data;

    let targetUserId: string | null = null;

    if (otp && email) {
      const cleanEmail = email.trim().toLowerCase();
      const verification = await verifyEmailOtp({
        email: cleanEmail,
        purpose: OtpPurpose.PASSWORD_RESET,
        otp,
      });

      if (!verification.success) {
        return res.status(400).json({
          success: false,
          error: verification.error,
          maxAttemptsExceeded: verification.maxAttemptsExceeded,
        });
      }

      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User account not found.' });
      }
      targetUserId = user.id;
    } else if (token) {
      const verification = await verifyPasswordResetToken(token);
      if (!verification.success) {
        return res.status(400).json({
          success: false,
          error: verification.error,
        });
      }
      targetUserId = verification.userId;
      await markPasswordResetTokenUsed(verification.tokenId);
    } else {
      return res.status(400).json({ success: false, error: 'Email and 6-digit verification code are required.' });
    }

    // Hash new password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user password
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
      select: { id: true, name: true, email: true },
    });

    // Send confirmation plain-text email asynchronously
    const confirmEmail = buildPasswordChangedConfirmationEmail({
      name: user.name,
    });

    sendEmail({
      userId: user.id,
      recipientEmail: user.email,
      category: NotificationCategory.SYSTEM,
      subject: confirmEmail.subject,
      text: confirmEmail.text,
      idempotencyKey: `PASSWORD_CONFIRM:${user.id}:${Date.now()}`,
    }).catch(console.error);

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('resetPassword error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.',
    });
  }
}

/**
 * Get current authenticated user details
 */
export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        timezone: true,
        profileImage: true,
        currentStreak: true,
        longestStreak: true,
        isEmailVerified: true,
        emailLastChangedAt: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      user
    });
  } catch (err: any) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve user profile.' });
  }
}

/**
 * Logout
 */
export async function logout(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}
