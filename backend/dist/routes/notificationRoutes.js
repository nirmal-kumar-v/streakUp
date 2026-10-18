"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
// All notification and reminder routes require authentication
router.use(authMiddleware_1.requireAuth);
// Notification Center Endpoints
router.get('/', notificationController_1.getNotifications);
router.patch('/:id/read', notificationController_1.markNotificationAsRead);
router.patch('/:id/star', notificationController_1.toggleStarNotification);
router.post('/mark-all-read', notificationController_1.markAllNotificationsAsRead);
router.delete('/:id', notificationController_1.dismissNotification);
// Notification Preferences
router.get('/preferences', notificationController_1.getPreferences);
router.put('/preferences', notificationController_1.updatePreferences);
// Custom Verified Notification Email
router.post('/custom-email/request-otp', notificationController_1.requestNotificationEmailOtp);
router.post('/custom-email/verify-otp', notificationController_1.verifyNotificationEmailOtp);
router.delete('/custom-email', notificationController_1.removeNotificationEmail);
// Reminder Schedules (Max 3 per scope)
router.get('/reminders', notificationController_1.getReminderSchedules);
router.post('/reminders', notificationController_1.createReminderSchedule);
router.delete('/reminders/:id', notificationController_1.deleteReminderSchedule);
// Email & SMTP Diagnostics
router.post('/test-email', notificationController_1.sendTestEmail);
router.get('/smtp-status', notificationController_1.getSmtpStatus);
exports.default = router;
