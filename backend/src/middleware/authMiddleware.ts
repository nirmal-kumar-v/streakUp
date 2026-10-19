import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'streakup_dev_jwt_secret_key_2026';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  timezone: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware that requires a valid JWT token in Authorization header.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No Bearer token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    // Reject deleted accounts immediately even if JWT is still cryptographically valid
    const { isAccountDeleted } = require('../services/deletedAccountService');
    const deletion = isAccountDeleted(decoded.userId);
    if (deletion.isDeleted) {
      return res.status(403).json({
        success: false,
        error: 'This account was deleted. Please contact an administrator to recover your account.',
        isDeletedAccount: true,
      });
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
}

/**
 * Optional authentication: if token is present, decode it; otherwise proceed without error.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      const { isAccountDeleted } = require('../services/deletedAccountService');
      const deletion = isAccountDeleted(decoded.userId);
      if (!deletion.isDeleted) {
        req.user = decoded;
      }
    } catch {
      // Ignore token failure for optional endpoints
    }
  }
  next();
}
