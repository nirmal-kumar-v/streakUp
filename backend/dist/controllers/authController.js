"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.verifySignup = verifySignup;
exports.resendSignupOtp = resendSignupOtp;
exports.login = login;
exports.forgotPassword = forgotPassword;
exports.resendPasswordResetOtp = resendPasswordResetOtp;
exports.resetPassword = resetPassword;
exports.getMe = getMe;
exports.logout = logout;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const dbError_1 = require("../utils/dbError");
const client_1 = require("@prisma/client");
const otpService_1 = require("../services/otpService");
const emailService_1 = require("../services/emailService");
const notificationService_1 = require("../services/notificationService");
const adminConfigService_1 = require("../services/adminConfigService");
const JWT_SECRET = process.env.JWT_SECRET || 'streakup_dev_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '365d';
// Registration schema validation
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters long').max(50),
    username: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters long')
        .max(25, 'Username cannot exceed 25 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters long'),
    confirmPassword: zod_1.z.string().optional(),
    timezone: zod_1.z.string().optional(),
    termsAccepted: zod_1.z.boolean().optional(),
    termsVersion: zod_1.z.string().optional(),
}).refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});
// Login schema validation
const loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, 'Username or email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// Verify OTP schema
const verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
    otp: zod_1.z.string().trim().min(6, '6-digit OTP code required').max(6, '6-digit OTP code required'),
});
// Resend OTP schema
const resendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
});
// Forgot password schema
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
});
// Reset password schema (supports OTP or token)
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required').optional(),
    otp: zod_1.z.string().trim().min(6, '6-digit OTP code required').max(6, '6-digit OTP code required').optional(),
    token: zod_1.z.string().optional(),
    newPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters long'),
    confirmPassword: zod_1.z.string().optional(),
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
async function register(req, res) {
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
        const existingEmail = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail }
        });
        if (existingEmail && existingEmail.isEmailVerified) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email address already exists. Please log in.'
            });
        }
        // Check if username already taken by another verified user
        const existingUsername = await prisma_1.default.user.findUnique({
            where: { normalizedUsername }
        });
        if (existingUsername && existingUsername.isEmailVerified && existingUsername.id !== existingEmail?.id) {
            return res.status(409).json({
                success: false,
                error: `Username "${cleanUsername}" is already taken. Please choose another.`
            });
        }
        // Hash password securely
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Validate timezone or use default
        const userTimezone = timezone && (0, timezoneService_1.isValidTimezone)(timezone) ? timezone : timezoneService_1.DEFAULT_TIMEZONE;
        // Create or update the pending unverified user record
        let user;
        if (existingEmail && !existingEmail.isEmailVerified) {
            user = await prisma_1.default.user.update({
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
        }
        else {
            user = await prisma_1.default.user.create({
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
        const otpResult = await (0, otpService_1.createEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.SIGNUP,
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
        const emailData = (0, emailService_1.buildSignupOtpEmail)({
            name: user.name,
            otp: otpResult.otp,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: cleanEmail,
            category: client_1.NotificationCategory.SYSTEM,
            subject: emailData.subject,
            text: emailData.text,
            idempotencyKey: `SIGNUP_OTP:${user.id}:${Date.now()}`,
        });
        return res.status(200).json({
            success: true,
            message: 'Verification code sent to your email. Please enter the 6-digit code to activate your account.',
            pendingVerification: true,
            email: cleanEmail,
        });
    }
    catch (err) {
        if ((0, dbError_1.isDatabaseConnectionError)(err)) {
            console.warn('⚠️ Registration failed: PostgreSQL not connected yet.');
            return res.status(503).json({
                success: false,
                error: dbError_1.DB_CONNECTION_NOTICE
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
async function verifySignup(req, res) {
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
        const otpVerification = await (0, otpService_1.verifyEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.SIGNUP,
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
        const user = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail },
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User account not found. Please register again.',
            });
        }
        // Activate user
        const activatedUser = await prisma_1.default.user.update({
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
        await (0, notificationService_1.getOrCreateNotificationPreferences)(activatedUser.id);
        // Issue JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: activatedUser.id,
            username: activatedUser.username,
            email: activatedUser.email,
            timezone: activatedUser.timezone,
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.json({
            success: true,
            message: 'Email verified successfully. Welcome to StreakUp!',
            token,
            user: activatedUser,
        });
    }
    catch (err) {
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
async function resendSignupOtp(req, res) {
    try {
        const parseResult = resendOtpSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Valid email address required',
            });
        }
        const cleanEmail = parseResult.data.email.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
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
        const otpResult = await (0, otpService_1.createEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.SIGNUP,
            userId: user.id,
        });
        if (!otpResult.success) {
            return res.status(429).json({
                success: false,
                error: otpResult.error,
                retryAfterSeconds: otpResult.retryAfterSeconds,
            });
        }
        const emailData = (0, emailService_1.buildSignupOtpEmail)({
            name: user.name,
            otp: otpResult.otp,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: cleanEmail,
            category: client_1.NotificationCategory.SYSTEM,
            subject: emailData.subject,
            text: emailData.text,
            idempotencyKey: `SIGNUP_OTP_RESEND:${user.id}:${Date.now()}`,
        });
        return res.json({
            success: true,
            message: 'A new 6-digit verification code has been sent to your email.',
        });
    }
    catch (err) {
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
async function login(req, res) {
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
        const user = await prisma_1.default.user.findFirst({
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
        const passwordMatches = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username/email or password.'
            });
        }
        // Verify deleted account status: user cannot login if account is deleted
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        const deletion = isAccountDeleted(user.id);
        if (deletion.isDeleted) {
            return res.status(403).json({
                success: false,
                error: 'This account was deleted. You cannot log in without admin approval. Please contact an administrator to recover your account.',
                isDeletedAccount: true,
            });
        }
        // Require email verification before allowing login
        if (!user.isEmailVerified) {
            // Trigger new OTP if needed
            const otpResult = await (0, otpService_1.createEmailOtp)({
                email: user.email,
                purpose: client_1.OtpPurpose.SIGNUP,
                userId: user.id,
            });
            if (otpResult.success) {
                const emailData = (0, emailService_1.buildSignupOtpEmail)({
                    name: user.name,
                    otp: otpResult.otp,
                });
                await (0, emailService_1.sendEmail)({
                    userId: user.id,
                    recipientEmail: user.email,
                    category: client_1.NotificationCategory.SYSTEM,
                    subject: emailData.subject,
                    text: emailData.text,
                    idempotencyKey: `SIGNUP_OTP_LOGIN_PROMPT:${user.id}:${Date.now()}`,
                });
            }
            return res.status(403).json({
                success: false,
                error: 'Please verify your email address before logging in. A verification code has been sent to your email.',
                requiresVerification: true,
                email: user.email,
            });
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            username: user.username,
            email: user.email,
            timezone: user.timezone
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
    }
    catch (err) {
        if ((0, dbError_1.isDatabaseConnectionError)(err)) {
            return res.status(503).json({
                success: false,
                error: dbError_1.DB_CONNECTION_NOTICE
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
async function forgotPassword(req, res) {
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
        const user = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail },
        });
        if (user && user.isEmailVerified) {
            const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
            const delInfo = isAccountDeleted(user.id);
            if (delInfo.isDeleted) {
                // Send deleted account guidance email
                const { buildDeletedAccountNoticeEmail } = await Promise.resolve().then(() => __importStar(require('../services/emailService')));
                const noticeEmail = buildDeletedAccountNoticeEmail({
                    name: user.name,
                    username: user.username,
                    daysRemaining: delInfo.daysRemaining,
                });
                await (0, emailService_1.sendEmail)({
                    userId: user.id,
                    recipientEmail: user.email,
                    category: client_1.NotificationCategory.SYSTEM,
                    subject: noticeEmail.subject,
                    text: noticeEmail.text,
                    idempotencyKey: `DELETED_NOTICE:${user.id}:${Date.now()}`,
                });
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, you will receive instructions shortly.',
                });
            }
            const otpResult = await (0, otpService_1.createEmailOtp)({
                email: cleanEmail,
                purpose: client_1.OtpPurpose.PASSWORD_RESET,
                userId: user.id,
            });
            if (otpResult.success) {
                const emailContent = (0, emailService_1.buildPasswordResetOtpEmail)({
                    name: user.name,
                    otp: otpResult.otp,
                });
                await (0, emailService_1.sendEmail)({
                    userId: user.id,
                    recipientEmail: user.email,
                    category: client_1.NotificationCategory.SYSTEM,
                    subject: emailContent.subject,
                    text: emailContent.text,
                    idempotencyKey: `PASSWORD_RESET_OTP:${user.id}:${Date.now()}`,
                });
            }
            else {
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
    }
    catch (err) {
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
async function resendPasswordResetOtp(req, res) {
    try {
        const parseResult = resendOtpSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Valid email address required',
            });
        }
        const cleanEmail = parseResult.data.email.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail },
        });
        if (!user || !user.isEmailVerified) {
            return res.json({
                success: true,
                message: 'If an account exists with this email address, a new verification code has been sent.',
            });
        }
        const otpResult = await (0, otpService_1.createEmailOtp)({
            email: cleanEmail,
            purpose: client_1.OtpPurpose.PASSWORD_RESET,
            userId: user.id,
        });
        if (!otpResult.success) {
            return res.status(429).json({
                success: false,
                error: otpResult.error,
                retryAfterSeconds: otpResult.retryAfterSeconds,
            });
        }
        const emailContent = (0, emailService_1.buildPasswordResetOtpEmail)({
            name: user.name,
            otp: otpResult.otp,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: user.email,
            category: client_1.NotificationCategory.SYSTEM,
            subject: emailContent.subject,
            text: emailContent.text,
            idempotencyKey: `PASSWORD_RESET_OTP_RESEND:${user.id}:${Date.now()}`,
        });
        return res.json({
            success: true,
            message: 'A new 6-digit verification code has been sent to your email.',
        });
    }
    catch (err) {
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
async function resetPassword(req, res) {
    try {
        const parseResult = resetPasswordSchema.safeParse(req.body);
        if (!parseResult.success) {
            const errorMsg = parseResult.error.errors[0]?.message || 'Invalid reset data';
            return res.status(400).json({ success: false, error: errorMsg });
        }
        const { email, otp, token, newPassword } = parseResult.data;
        let targetUserId = null;
        if (otp && email) {
            const cleanEmail = email.trim().toLowerCase();
            const verification = await (0, otpService_1.verifyEmailOtp)({
                email: cleanEmail,
                purpose: client_1.OtpPurpose.PASSWORD_RESET,
                otp,
            });
            if (!verification.success) {
                return res.status(400).json({
                    success: false,
                    error: verification.error,
                    maxAttemptsExceeded: verification.maxAttemptsExceeded,
                });
            }
            const user = await prisma_1.default.user.findUnique({ where: { email: cleanEmail } });
            if (!user) {
                return res.status(404).json({ success: false, error: 'User account not found.' });
            }
            targetUserId = user.id;
        }
        else if (token) {
            const verification = await (0, otpService_1.verifyPasswordResetToken)(token);
            if (!verification.success) {
                return res.status(400).json({
                    success: false,
                    error: verification.error,
                });
            }
            targetUserId = verification.userId;
            await (0, otpService_1.markPasswordResetTokenUsed)(verification.tokenId);
        }
        else {
            return res.status(400).json({ success: false, error: 'Email and 6-digit verification code are required.' });
        }
        const { isAccountDeleted } = await Promise.resolve().then(() => __importStar(require('../services/deletedAccountService')));
        if (isAccountDeleted(targetUserId).isDeleted) {
            return res.status(403).json({
                success: false,
                error: 'This account was deleted. Please contact an administrator to recover your account.',
                isDeletedAccount: true,
            });
        }
        // Hash new password securely
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        // Update user password
        const user = await prisma_1.default.user.update({
            where: { id: targetUserId },
            data: { passwordHash },
            select: { id: true, name: true, email: true },
        });
        // Send confirmation plain-text email asynchronously
        const confirmEmail = (0, emailService_1.buildPasswordChangedConfirmationEmail)({
            name: user.name,
        });
        await (0, emailService_1.sendEmail)({
            userId: user.id,
            recipientEmail: user.email,
            category: client_1.NotificationCategory.SYSTEM,
            subject: confirmEmail.subject,
            text: confirmEmail.text,
            idempotencyKey: `PASSWORD_CONFIRM:${user.id}:${Date.now()}`,
        });
        return res.json({
            success: true,
            message: 'Your password has been reset successfully. You can now log in with your new password.',
        });
    }
    catch (err) {
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
async function getMe(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const user = await prisma_1.default.user.findUnique({
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
                lastUsernameChangeAt: true,
                createdAt: true,
                _count: {
                    select: {
                        friendshipsAsUser1: true,
                        friendshipsAsUser2: true,
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const { _count, ...userData } = user;
        const connectionsCount = (_count?.friendshipsAsUser1 || 0) + (_count?.friendshipsAsUser2 || 0);
        const safeUser = {
            ...userData,
            connectionsCount,
            profileImageLimitMb: (0, adminConfigService_1.getUserProfileImageLimitMb)(user.id),
        };
        return res.json({
            success: true,
            user: safeUser
        });
    }
    catch (err) {
        console.error('getMe error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve user profile.' });
    }
}
/**
 * Logout
 */
async function logout(_req, res) {
    return res.json({
        success: true,
        message: 'Logged out successfully.'
    });
}
