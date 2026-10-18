import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

export interface AdminAuthenticatedRequest extends Request {
  admin?: {
    adminId: string;
    username: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'streakup_super_secret_jwt_key_2026_change_in_production';

/**
 * Middleware enforcing Super Admin authentication
 */
export async function requireAdminAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required. Please sign in to the Admin Control Panel.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      adminId?: string;
      username?: string;
      role?: string;
    };

    if (!decoded.adminId || decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Super Admin privileges required.',
      });
    }

    const admin = await prisma.adminAccount.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, username: true, role: true },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin account not found or has been revoked.',
      });
    }

    req.admin = {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
    };

    return next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired Admin session. Please sign in again.',
    });
  }
}

/**
 * Middleware enforcing secondary authentication for high-risk / sensitive actions
 * e.g., deleting user accounts, permanent streak wipeouts, or admin password resets.
 */
export async function requireSensitiveAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: 'Admin authentication required.' });
    }

    const sensitivePin =
      (req.headers['x-admin-pin'] as string) ||
      (req.headers['x-sensitive-key'] as string) ||
      req.body.sensitivePin ||
      req.body.adminPasswordConfirm;

    if (!sensitivePin || typeof sensitivePin !== 'string') {
      return res.status(403).json({
        success: false,
        requiresSensitiveAuth: true,
        error: 'Secondary confirmation required. Please enter your Admin Sensitive PIN or Password to authorize this sensitive action.',
      });
    }

    const admin = await prisma.adminAccount.findUnique({
      where: { id: req.admin.adminId },
      select: { passwordHash: true, sensitivePinHash: true },
    });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Admin account not found.' });
    }

    // Verify against sensitivePinHash if configured, otherwise fallback to passwordHash
    let isValid = false;
    if (admin.sensitivePinHash) {
      isValid = await bcrypt.compare(sensitivePin, admin.sensitivePinHash);
    }
    if (!isValid) {
      isValid = await bcrypt.compare(sensitivePin, admin.passwordHash);
    }

    if (!isValid) {
      return res.status(403).json({
        success: false,
        error: 'Incorrect sensitive PIN / Password confirmation.',
      });
    }

    return next();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to verify sensitive authorization.' });
  }
}
