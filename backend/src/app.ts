import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import friendRoutes from './routes/friendRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import userRoutes from './routes/userRoutes';
import { getLocalTimeInfo } from './services/timezoneService';

dotenv.config();

const app = express();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health & Info endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: 'StreakUp API',
    timestamp: new Date().toISOString(),
    systemClock: getLocalTimeInfo('Asia/Kolkata')
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/users', userRoutes);

// 404 Handler
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

import { isDatabaseConnectionError, DB_CONNECTION_NOTICE } from './utils/dbError';

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
