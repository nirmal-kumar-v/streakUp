"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
exports.requireSensitiveAuth = requireSensitiveAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../config/prisma"));
const JWT_SECRET = process.env.JWT_SECRET || 'streakup_super_secret_jwt_key_2026_change_in_production';
/**
 * Middleware enforcing Super Admin authentication
 */
async function requireAdminAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Admin authentication required. Please sign in to the Admin Control Panel.',
            });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (!decoded.adminId || decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Super Admin privileges required.',
            });
        }
        const admin = await prisma_1.default.adminAccount.findUnique({
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
    }
    catch (err) {
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
async function requireSensitiveAuth(req, res, next) {
    try {
        if (!req.admin) {
            return res.status(401).json({ success: false, error: 'Admin authentication required.' });
        }
        const sensitivePin = req.headers['x-admin-pin'] ||
            req.headers['x-sensitive-key'] ||
            req.body.sensitivePin ||
            req.body.adminPasswordConfirm;
        if (!sensitivePin || typeof sensitivePin !== 'string') {
            return res.status(403).json({
                success: false,
                requiresSensitiveAuth: true,
                error: 'Secondary confirmation required. Please enter your Admin Sensitive PIN or Password to authorize this sensitive action.',
            });
        }
        const admin = await prisma_1.default.adminAccount.findUnique({
            where: { id: req.admin.adminId },
            select: { passwordHash: true, sensitivePinHash: true },
        });
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Admin account not found.' });
        }
        // Verify against sensitivePinHash if configured, otherwise fallback to passwordHash
        let isValid = false;
        if (admin.sensitivePinHash) {
            isValid = await bcryptjs_1.default.compare(sensitivePin, admin.sensitivePinHash);
        }
        if (!isValid) {
            isValid = await bcryptjs_1.default.compare(sensitivePin, admin.passwordHash);
        }
        if (!isValid) {
            return res.status(403).json({
                success: false,
                error: 'Incorrect sensitive PIN / Password confirmation.',
            });
        }
        return next();
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to verify sensitive authorization.' });
    }
}
