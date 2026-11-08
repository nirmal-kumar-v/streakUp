"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Registration & OTP verification (rate-limited against bot spam)
router.post('/register', rateLimiter_1.authRateLimiter, authController_1.register);
router.post('/verify-signup', rateLimiter_1.sensitiveActionLimiter, authController_1.verifySignup);
router.post('/resend-signup-otp', rateLimiter_1.sensitiveActionLimiter, authController_1.resendSignupOtp);
// Login & Session (rate-limited against brute-force password guessing)
router.post('/login', rateLimiter_1.authRateLimiter, authController_1.login);
router.get('/me', authMiddleware_1.requireAuth, authController_1.getMe);
router.post('/logout', authController_1.logout);
// Password recovery via OTP (rate-limited against token exhaustion)
router.post('/forgot-password', rateLimiter_1.sensitiveActionLimiter, authController_1.forgotPassword);
router.post('/resend-reset-otp', rateLimiter_1.sensitiveActionLimiter, authController_1.resendPasswordResetOtp);
router.post('/reset-password', rateLimiter_1.sensitiveActionLimiter, authController_1.resetPassword);
exports.default = router;
