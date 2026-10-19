"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitRequest = submitRequest;
exports.getAdminRequests = getAdminRequests;
exports.updateRequestStatus = updateRequestStatus;
exports.checkManagerStatus = checkManagerStatus;
exports.replyRequestAsManager = replyRequestAsManager;
const userRequestService_1 = require("../services/userRequestService");
const managerService_1 = require("../services/managerService");
/**
 * POST /api/requests - Authenticated user submits a request or feedback
 */
async function submitRequest(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized user.' });
        }
        const { category, message } = req.body;
        if (!category || !message) {
            return res.status(400).json({
                success: false,
                error: 'Both category and message are required.',
            });
        }
        const newRequest = await (0, userRequestService_1.submitUserRequest)({
            userId,
            category: category,
            message,
        });
        return res.status(201).json({
            success: true,
            message: 'Your request has been submitted successfully.',
            request: newRequest,
        });
    }
    catch (err) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Failed to submit request.',
        });
    }
}
/**
 * GET /api/admin/requests - Super Admin views all submitted requests with filters
 */
async function getAdminRequests(req, res) {
    try {
        const { status, category, search } = req.query;
        const requests = await (0, userRequestService_1.getAllUserRequests)({
            status: status ? String(status) : undefined,
            category: category ? String(category) : undefined,
            search: search ? String(search) : undefined,
        });
        return res.json({
            success: true,
            requests,
            count: requests.length,
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to fetch user requests.',
        });
    }
}
/**
 * PATCH /api/admin/requests/:id/status - Super Admin updates request status
 */
async function updateRequestStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required.',
            });
        }
        const updated = await (0, userRequestService_1.updateUserRequestStatus)({
            requestId: id,
            status: status,
            adminNotes,
        });
        return res.json({
            success: true,
            message: `Request status updated to ${status}.`,
            request: updated,
        });
    }
    catch (err) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Failed to update request status.',
        });
    }
}
/**
 * GET /api/requests/manager-check - Check if authenticated user has Manager access
 */
async function checkManagerStatus(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.json({ success: true, isManager: false });
        }
        const isMgr = await (0, managerService_1.isUserManager)(userId);
        return res.json({ success: true, isManager: isMgr });
    }
    catch {
        return res.json({ success: true, isManager: false });
    }
}
/**
 * POST /api/requests/:id/reply - Manager replies to a user request/feedback
 * Dispatches an IN-APP ONLY notification to the original requesting user (NO email).
 */
async function replyRequestAsManager(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required.' });
        }
        const { id } = req.params;
        const { replyMessage } = req.body;
        if (!replyMessage || !replyMessage.trim()) {
            return res.status(400).json({ success: false, error: 'Reply message is required.' });
        }
        const result = await (0, managerService_1.replyToUserRequestAsManager)({
            managerUserId: userId,
            requestId: id,
            replyMessage: replyMessage.trim(),
        });
        return res.json(result);
    }
    catch (err) {
        const isForbidden = err.message && err.message.toLowerCase().includes('forbidden');
        return res.status(isForbidden ? 403 : 400).json({
            success: false,
            error: err.message || 'Failed to send manager reply.',
        });
    }
}
