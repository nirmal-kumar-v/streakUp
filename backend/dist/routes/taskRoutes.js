"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All task routes require authentication
router.use(authMiddleware_1.requireAuth);
router.get('/', taskController_1.getTasks);
router.post('/', taskController_1.createTask);
router.get('/dashboard-summary', taskController_1.getDashboardSummary);
router.get('/activity-history', taskController_1.getActivityHistory);
router.put('/:id', taskController_1.updateTask);
router.delete('/:id', taskController_1.deleteTask);
router.patch('/:id/archive', taskController_1.toggleArchiveTask);
router.post('/:id/complete', taskController_1.completeTask);
router.post('/:id/uncomplete', taskController_1.uncompleteTask);
exports.default = router;
