"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Registration & OTP verification
router.post('/register', authController_1.register);
router.post('/verify-signup', authController_1.verifySignup);
router.post('/resend-signup-otp', authController_1.resendSignupOtp);
// Login & Session
router.post('/login', authController_1.login);
router.get('/me', authMiddleware_1.requireAuth, authController_1.getMe);
router.post('/logout', authController_1.logout);
// Password recovery via reset link
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/reset-password', authController_1.resetPassword);
exports.default = router;
