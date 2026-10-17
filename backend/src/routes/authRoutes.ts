import { Router } from 'express';
import {
  register,
  verifySignup,
  resendSignupOtp,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Registration & OTP verification
router.post('/register', register);
router.post('/verify-signup', verifySignup);
router.post('/resend-signup-otp', resendSignupOtp);

// Login & Session
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

// Password recovery via reset link
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
