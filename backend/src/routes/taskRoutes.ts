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
  updateCompletionNote,
  getTaskDetails,
} from '../controllers/taskController';
import {
  getTaskFriendsLeaderboard,
  confirmTaskEquivalence,
  rejectTaskEquivalence,
} from '../controllers/friendTaskController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/dashboard-summary', getDashboardSummary);
router.get('/activity-history', getActivityHistory);
router.post('/equivalences/confirm', confirmTaskEquivalence);
router.post('/equivalences/reject', rejectTaskEquivalence);
router.get('/:id/details', getTaskDetails);
router.get('/:id/friends-leaderboard', getTaskFriendsLeaderboard);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/archive', toggleArchiveTask);
router.post('/:id/complete', completeTask);
router.post('/:id/uncomplete', uncompleteTask);
router.put('/:id/completions/:date/note', updateCompletionNote);

export default router;

