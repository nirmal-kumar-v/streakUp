import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleArchiveTask,
  completeTask,
  uncompleteTask,
  getDashboardSummary,
  getActivityHistory,
} from '../controllers/taskController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/dashboard-summary', getDashboardSummary);
router.get('/activity-history', getActivityHistory);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/archive', toggleArchiveTask);
router.post('/:id/complete', completeTask);
router.post('/:id/uncomplete', uncompleteTask);

export default router;
