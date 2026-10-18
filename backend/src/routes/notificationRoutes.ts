import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import {
  getNotifications,
  markNotificationAsRead,
  toggleStarNotification,
  markAllNotificationsAsRead,
  dismissNotification,
  getPreferences,
  updatePreferences,
  getReminderSchedules,
  createReminderSchedule,
  deleteReminderSchedule,
  sendTestEmail,
  getSmtpStatus,
  requestNotificationEmailOtp,
  verifyNotificationEmailOtp,
  removeNotificationEmail,
} from '../controllers/notificationController';

const router = Router();

// All notification and reminder routes require authentication
router.use(requireAuth);

// Notification Center Endpoints
router.get('/', getNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.patch('/:id/star', toggleStarNotification);
router.post('/mark-all-read', markAllNotificationsAsRead);
router.delete('/:id', dismissNotification);

// Notification Preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Custom Verified Notification Email
router.post('/custom-email/request-otp', requestNotificationEmailOtp);
router.post('/custom-email/verify-otp', verifyNotificationEmailOtp);
router.delete('/custom-email', removeNotificationEmail);

// Reminder Schedules (Max 3 per scope)
router.get('/reminders', getReminderSchedules);
router.post('/reminders', createReminderSchedule);
router.delete('/reminders/:id', deleteReminderSchedule);

// Email & SMTP Diagnostics
router.post('/test-email', sendTestEmail);
router.get('/smtp-status', getSmtpStatus);

export default router;
