import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { AdminAuthenticatedRequest } from '../middleware/adminAuthMiddleware';
import {
  submitUserRequest,
  getAllUserRequests,
  updateUserRequestStatus,
  UserRequestCategory,
  UserRequestStatus,
} from '../services/userRequestService';
import { replyToUserRequestAsManager, isUserManager } from '../services/managerService';

/**
 * POST /api/requests - Authenticated user submits a request or feedback
 */
export async function submitRequest(req: AuthenticatedRequest, res: Response) {
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

    const newRequest = await submitUserRequest({
      userId,
      category: category as UserRequestCategory,
      message,
    });

    return res.status(201).json({
      success: true,
      message: 'Your request has been submitted successfully.',
      request: newRequest,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to submit request.',
    });
  }
}

/**
 * GET /api/admin/requests - Super Admin views all submitted requests with filters
 */
export async function getAdminRequests(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { status, category, search } = req.query;

    const requests = await getAllUserRequests({
      status: status ? String(status) : undefined,
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
    });

    return res.json({
      success: true,
      requests,
      count: requests.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch user requests.',
    });
  }
}

/**
 * PATCH /api/admin/requests/:id/status - Super Admin updates request status
 */
export async function updateRequestStatus(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required.',
      });
    }

    const updated = await updateUserRequestStatus({
      requestId: id,
      status: status as UserRequestStatus,
      adminNotes,
    });

    return res.json({
      success: true,
      message: `Request status updated to ${status}.`,
      request: updated,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to update request status.',
    });
  }
}

/**
 * GET /api/requests/manager-check - Check if authenticated user has Manager access
 */
export async function checkManagerStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.json({ success: true, isManager: false });
    }
    const isMgr = await isUserManager(userId);
    return res.json({ success: true, isManager: isMgr });
  } catch {
    return res.json({ success: true, isManager: false });
  }
}

/**
 * POST /api/requests/:id/reply - Manager replies to a user request/feedback
 * Dispatches an IN-APP ONLY notification to the original requesting user (NO email).
 */
export async function replyRequestAsManager(req: AuthenticatedRequest, res: Response) {
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

    const result = await replyToUserRequestAsManager({
      managerUserId: userId,
      requestId: id,
      replyMessage: replyMessage.trim(),
    });

    return res.json(result);
  } catch (err: any) {
    const isForbidden = err.message && err.message.toLowerCase().includes('forbidden');
    return res.status(isForbidden ? 403 : 400).json({
      success: false,
      error: err.message || 'Failed to send manager reply.',
    });
  }
}

