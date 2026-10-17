import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import friendRoutes from './routes/friendRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import userRoutes from './routes/userRoutes';
import notificationRoutes from './routes/notificationRoutes';
import groupRoutes from './routes/groupRoutes';
import reactionRoutes from './routes/reactionRoutes';
import { getLocalTimeInfo } from './services/timezoneService';
import { isDatabaseConnectionError, DB_CONNECTION_NOTICE } from './utils/dbError';

dotenv.config();

const app = express();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: true, // Automatically mirrors origin (supports localhost, vercel.app, and custom domains)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

import { runReminderCheck } from './services/reminderSchedulerService';

// Health & Info endpoint (accessible at both /api/health and /health)
const handleHealth = (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: 'StreakUp API',
    version: '1.1.0-reminders-v2',
    timestamp: new Date().toISOString(),
    systemClock: getLocalTimeInfo('Asia/Kolkata'),
    environment: process.env.VERCEL ? 'vercel-serverless' : 'local-node',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET)
  });
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);
app.get('/api', handleHealth);
app.get('/', handleHealth);

// Cron / Automated Reminders Trigger (accessible via GET/POST on both /api/cron/reminders and /cron/reminders)
const handleCronReminders = async (_req: Request, res: Response) => {
  try {
    const result = await runReminderCheck();
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error('[cron/reminders] Error running reminder check:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
app.get('/api/cron/reminders', handleCronReminders);
app.get('/cron/reminders', handleCronReminders);
app.post('/api/cron/reminders', handleCronReminders);
app.post('/cron/reminders', handleCronReminders);

// Mount Routes with /api prefix (for standard and local requests)
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/reactions', reactionRoutes);

// Also mount routes without /api prefix (fallback for serverless rewrites)
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/friends', friendRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/users', userRoutes);
app.use('/notifications', notificationRoutes);
app.use('/groups', groupRoutes);
app.use('/reactions', reactionRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (isDatabaseConnectionError(err)) {
    return res.status(503).json({
      success: false,
      error: DB_CONNECTION_NOTICE
    });
  }
  console.error('Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error occurred.'
  });
});

export default app;
module.exports = app;
module.exports.default = app;
