import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Lightweight, zero-dependency in-memory sliding window rate limiter.
 * Protects public authentication endpoints from credential-stuffing and brute-force attacks.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message } = options;
  const ipStore = new Map<string, RateLimitRecord>();

  // Periodic cleanup of stale IP records every 60 seconds to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        ipStore.delete(ip);
      }
    }
  }, 60000);

  // Unref timer so it doesn't prevent clean process shutdown
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Bypass rate limiting during automated test suite execution
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || '127.0.0.1';

    const now = Date.now();
    let record = ipStore.get(ip);

    if (!record) {
      record = { timestamps: [] };
      ipStore.set(ip, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        success: false,
        error:
          message ||
          `Too many attempts from this IP address. Please wait ${retryAfterSeconds} seconds before trying again.`,
        retryAfterSeconds,
      });
    }

    record.timestamps.push(now);
    next();
  };
}

// Pre-configured rate limiters for critical security vectors
// 1. Auth Limiter: max 30 login/signup/reset attempts per 15 minutes per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// 2. Sensitive Action Limiter: max 10 OTP / Password reset requests per 10 minutes per IP
export const sensitiveActionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many sensitive requests. Please wait a few minutes before trying again.',
});

