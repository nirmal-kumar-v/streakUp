"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
exports.generateNumericOtp = generateNumericOtp;
exports.createEmailOtp = createEmailOtp;
exports.verifyEmailOtp = verifyEmailOtp;
exports.createPasswordResetToken = createPasswordResetToken;
exports.verifyPasswordResetToken = verifyPasswordResetToken;
exports.markPasswordResetTokenUsed = markPasswordResetTokenUsed;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const OTP_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
const RESET_TOKEN_COOLDOWN_MS = 60 * 1000; // 60 seconds
/**
 * Generates a SHA-256 hash of a sensitive token or OTP string.
 */
function hashToken(value) {
    return crypto_1.default.createHash('sha256').update(value).digest('hex');
}
/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
function generateNumericOtp() {
    return crypto_1.default.randomInt(100000, 1000000).toString();
}
/**
 * Creates and stores a hashed 6-digit OTP for signup, email change, or notification verification.
 * Enforces a 60-second cooldown between requests and sets a 5-minute expiration.
 */
async function createEmailOtp(params) {
    const cleanEmail = params.email.trim().toLowerCase();
    // Check cooldown: reject if an OTP for this email and purpose was issued in the last 60 seconds
    const recentOtp = await prisma_1.default.emailOtp.findFirst({
        where: {
            email: cleanEmail,
            purpose: params.purpose,
        },
        orderBy: { createdAt: 'desc' },
    });
    if (recentOtp) {
        const elapsedMs = Date.now() - recentOtp.createdAt.getTime();
        if (elapsedMs < OTP_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000);
            return {
                success: false,
                error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new code.`,
                retryAfterSeconds: remainingSeconds,
            };
        }
    }
    // Invalidate any existing unused OTPs for this email and purpose
    await prisma_1.default.emailOtp.updateMany({
        where: {
            email: cleanEmail,
            purpose: params.purpose,
            isUsed: false,
        },
        data: {
            isUsed: true,
        },
    });
    // Generate 6-digit OTP
    const rawOtp = generateNumericOtp();
    const hashedOtp = hashToken(rawOtp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);
    await prisma_1.default.emailOtp.create({
        data: {
            userId: params.userId || null,
            email: cleanEmail,
            otpHash: hashedOtp,
            purpose: params.purpose,
            targetData: params.targetData || null,
            attempts: 0,
            expiresAt,
            isUsed: false,
        },
    });
    return {
        success: true,
        otp: rawOtp,
        expiresAt,
    };
}
/**
 * Verifies a 6-digit numeric OTP against its stored hash.
 * Enforces expiration, max 5 attempts, and single-use invalidation.
 */
async function verifyEmailOtp(params) {
    const cleanEmail = params.email.trim().toLowerCase();
    const trimmedOtp = params.otp.trim();
    // Find the latest active OTP for this email and purpose
    const whereClause = {
        email: cleanEmail,
        purpose: params.purpose,
        isUsed: false,
    };
    if (params.userId) {
        whereClause.userId = params.userId;
    }
    const otpRecord = await prisma_1.default.emailOtp.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
    });
    if (!otpRecord) {
        return {
            success: false,
            error: 'No active verification code found. Please request a new code.',
        };
    }
    // Check if expired
    if (otpRecord.expiresAt < new Date()) {
        // Invalidate expired code
        await prisma_1.default.emailOtp.update({
            where: { id: otpRecord.id },
            data: { isUsed: true },
        });
        return {
            success: false,
            error: 'Verification code has expired. Please request a new code.',
        };
    }
    // Check attempt limit
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
        await prisma_1.default.emailOtp.update({
            where: { id: otpRecord.id },
            data: { isUsed: true },
        });
        return {
            success: false,
            error: 'Too many incorrect attempts. This code is now invalid. Please request a new code.',
            maxAttemptsExceeded: true,
        };
    }
    // Increment attempts count
    const updatedRecord = await prisma_1.default.emailOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
    });
    // Verify hash
    const inputHash = hashToken(trimmedOtp);
    if (inputHash !== otpRecord.otpHash) {
        const remaining = MAX_OTP_ATTEMPTS - updatedRecord.attempts;
        return {
            success: false,
            error: remaining > 0
                ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                : 'Invalid verification code. Maximum attempts reached. Please request a new code.',
            maxAttemptsExceeded: remaining <= 0,
        };
    }
    // Verification succeeded! Mark as used
    await prisma_1.default.emailOtp.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
    });
    return {
        success: true,
        targetData: otpRecord.targetData,
        userId: otpRecord.userId,
    };
}
/**
 * Creates a cryptographically secure 1-hour password reset token for a user.
 * Enforces a 60-second cooldown between requests and invalidates previous tokens.
 */
async function createPasswordResetToken(userId) {
    // Check cooldown
    const recentToken = await prisma_1.default.passwordResetToken.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    if (recentToken) {
        const elapsedMs = Date.now() - recentToken.createdAt.getTime();
        if (elapsedMs < RESET_TOKEN_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((RESET_TOKEN_COOLDOWN_MS - elapsedMs) / 1000);
            return {
                success: false,
                error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another reset link.`,
                retryAfterSeconds: remainingSeconds,
            };
        }
    }
    // Invalidate any previous unused tokens
    await prisma_1.default.passwordResetToken.updateMany({
        where: {
            userId,
            isUsed: false,
        },
        data: {
            isUsed: true,
        },
    });
    // Generate 32-byte secure random hex token
    const rawToken = crypto_1.default.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MS);
    await prisma_1.default.passwordResetToken.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
            isUsed: false,
        },
    });
    return {
        success: true,
        rawToken,
        expiresAt,
    };
}
/**
 * Verifies a raw password reset token and returns the associated userId if valid.
 */
async function verifyPasswordResetToken(rawToken) {
    const tokenHash = hashToken(rawToken.trim());
    const tokenRecord = await prisma_1.default.passwordResetToken.findFirst({
        where: {
            tokenHash,
            isUsed: false,
        },
    });
    if (!tokenRecord) {
        return {
            success: false,
            error: 'Invalid or previously used password reset link. Please request a new one.',
        };
    }
    if (tokenRecord.expiresAt < new Date()) {
        await prisma_1.default.passwordResetToken.update({
            where: { id: tokenRecord.id },
            data: { isUsed: true },
        });
        return {
            success: false,
            error: 'This password reset link has expired. Please request a new one.',
        };
    }
    return {
        success: true,
        userId: tokenRecord.userId,
        tokenId: tokenRecord.id,
    };
}
/**
 * Marks a password reset token as used once the password change is finalized.
 */
async function markPasswordResetTokenUsed(tokenId) {
    await prisma_1.default.passwordResetToken.update({
        where: { id: tokenId },
        data: { isUsed: true },
    });
}
