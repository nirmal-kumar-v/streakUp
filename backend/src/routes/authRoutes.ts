import { Router } from 'express';
import {
  register,
  verifySignup,
  resendSignupOtp,
  login,
  forgotPassword,
  resendPasswordResetOtp,
  resetPassword,
  getMe,
  logout,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';
import { authRateLimiter, sensitiveActionLimiter } from '../middleware/rateLimiter';

const router = Router();

// Registration & OTP verification (rate-limited against bot spam)
router.post('/register', authRateLimiter, register);
router.post('/verify-signup', sensitiveActionLimiter, verifySignup);
router.post('/resend-signup-otp', sensitiveActionLimiter, resendSignupOtp);

// Login & Session (rate-limited against brute-force password guessing)
router.post('/login', authRateLimiter, login);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

// Password recovery via OTP (rate-limited against token exhaustion)
router.post('/forgot-password', sensitiveActionLimiter, forgotPassword);
router.post('/resend-reset-otp', sensitiveActionLimiter, resendPasswordResetOtp);
router.post('/reset-password', sensitiveActionLimiter, resetPassword);

export default router;
