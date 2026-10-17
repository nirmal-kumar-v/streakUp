"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
exports.logout = logout;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const timezoneService_1 = require("../services/timezoneService");
const dbError_1 = require("../utils/dbError");
const JWT_SECRET = process.env.JWT_SECRET || 'streakup_dev_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';
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
}).refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});
// Login schema validation
const loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, 'Username or email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
/**
 * Register a new user
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
        // Check if email already registered
        const existingEmail = await prisma_1.default.user.findUnique({
            where: { email: cleanEmail }
        });
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email address already exists.'
            });
        }
        // Check if username already taken (case-insensitive check)
        const existingUsername = await prisma_1.default.user.findUnique({
            where: { normalizedUsername }
        });
        if (existingUsername) {
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
        // Create user
        const user = await prisma_1.default.user.create({
            data: {
                name: name.trim(),
                username: cleanUsername,
                normalizedUsername,
                email: cleanEmail,
                passwordHash,
                timezone: userTimezone,
                currentStreak: 0,
                longestStreak: 0,
            },
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
            }
        });
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            username: user.username,
            email: user.email,
            timezone: user.timezone
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.status(201).json({
            success: true,
            message: 'Account registered successfully.',
            token,
            user
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
