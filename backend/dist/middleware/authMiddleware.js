"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'streakup_dev_jwt_secret_key_2026';
/**
 * Middleware that requires a valid JWT token in Authorization header.
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. No Bearer token provided.'
        });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
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
    }
    catch (err) {
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
function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const { isAccountDeleted } = require('../services/deletedAccountService');
            const deletion = isAccountDeleted(decoded.userId);
            if (!deletion.isDeleted) {
                req.user = decoded;
            }
        }
        catch {
            // Ignore token failure for optional endpoints
        }
    }
    next();
}
