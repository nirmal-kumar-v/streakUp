"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userRequestController_1 = require("../controllers/userRequestController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Check if authenticated user is manager
router.get('/manager-check', authMiddleware_1.requireAuth, userRequestController_1.checkManagerStatus);
// Submit a new request or feedback (Public or Authenticated)
router.post('/', authMiddleware_1.optionalAuth, userRequestController_1.submitRequest);
router.post('/public', authMiddleware_1.optionalAuth, userRequestController_1.submitRequest);
// Reply to a request or feedback (Manager only)
router.post('/:id/reply', authMiddleware_1.requireAuth, userRequestController_1.replyRequestAsManager);
exports.default = router;
