import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { isValidTimezone, DEFAULT_TIMEZONE } from '../services/timezoneService';
import { isDatabaseConnectionError, DB_CONNECTION_NOTICE } from '../utils/dbError';

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

/**
 * Register a new user
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

    // Check if email already registered
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Check if username already taken (case-insensitive check)
    const existingUsername = await prisma.user.findUnique({
      where: { normalizedUsername }
    });
    if (existingUsername) {
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

    // Create user
    const user = await prisma.user.create({
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

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user
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
