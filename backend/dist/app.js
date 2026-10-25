"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const friendRoutes_1 = __importDefault(require("./routes/friendRoutes"));
const leaderboardRoutes_1 = __importDefault(require("./routes/leaderboardRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const groupRoutes_1 = __importDefault(require("./routes/groupRoutes"));
const reactionRoutes_1 = __importDefault(require("./routes/reactionRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const userRequestRoutes_1 = __importDefault(require("./routes/userRequestRoutes"));
const timezoneService_1 = require("./services/timezoneService");
const dbError_1 = require("./utils/dbError");
dotenv_1.default.config();
const app = (0, express_1.default)();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use((0, cors_1.default)({
    origin: true, // Automatically mirrors origin (supports localhost, vercel.app, and custom domains)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-admin-pin',
        'x-sensitive-key',
        'X-Admin-Pin',
        'X-Sensitive-Key',
        'Accept',
        'Origin',
        'X-Requested-With'
    ]
}));
app.use(express_1.default.json({ limit: '15mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '15mb' }));
const reminderSchedulerService_1 = require("./services/reminderSchedulerService");
const adminConfigService_1 = require("./services/adminConfigService");
const specialGroupMigration_1 = require("./services/specialGroupMigration");
const streakService_1 = require("./services/streakService");
// Preload user admin configs from PostgreSQL into in-memory cache
(0, adminConfigService_1.loadUserAdminConfigsFromDb)().catch(() => { });
// Initialize special groups database columns and backfill legacy groups
(0, specialGroupMigration_1.initSpecialGroupsDatabaseAndMigrate)().catch(() => { });
// Reconcile broken streaks for inactive users on startup
(0, streakService_1.reconcileStaleStreaks)().catch(() => { });
// Health & Info endpoint (accessible at both /api/health and /health)
const handleHealth = (_req, res) => {
    res.json({
        status: 'healthy',
        app: 'StreakUp API',
        version: '1.1.0-reminders-v2',
        timestamp: new Date().toISOString(),
        systemClock: (0, timezoneService_1.getLocalTimeInfo)('Asia/Kolkata'),
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
const handleCronReminders = async (_req, res) => {
    try {
        const result = await (0, reminderSchedulerService_1.runReminderCheck)();
        return res.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
        });
    }
    catch (err) {
        console.error('[cron/reminders] Error running reminder check:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};
app.get('/api/cron/reminders', handleCronReminders);
app.get('/cron/reminders', handleCronReminders);
app.post('/api/cron/reminders', handleCronReminders);
app.post('/cron/reminders', handleCronReminders);
// Mount Routes with /api prefix (for standard and local requests)
app.use('/api/auth', authRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/friends', friendRoutes_1.default);
app.use('/api/leaderboard', leaderboardRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/groups', groupRoutes_1.default);
app.use('/api/reactions', reactionRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/requests', userRequestRoutes_1.default);
// Also mount routes without /api prefix (fallback for serverless rewrites)
app.use('/auth', authRoutes_1.default);
app.use('/tasks', taskRoutes_1.default);
app.use('/friends', friendRoutes_1.default);
app.use('/leaderboard', leaderboardRoutes_1.default);
app.use('/users', userRoutes_1.default);
app.use('/notifications', notificationRoutes_1.default);
app.use('/groups', groupRoutes_1.default);
app.use('/reactions', reactionRoutes_1.default);
app.use('/admin', adminRoutes_1.default);
app.use('/requests', userRequestRoutes_1.default);
// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `API route not found: ${req.method} ${req.originalUrl}`
    });
});
// Global Error Handler
app.use((err, _req, res, _next) => {
    if ((0, dbError_1.isDatabaseConnectionError)(err)) {
        return res.status(503).json({
            success: false,
            error: dbError_1.DB_CONNECTION_NOTICE
        });
    }
    console.error('Unhandled server error:', err);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        error: err.message || 'Internal server error occurred.'
    });
});
exports.default = app;
module.exports = app;
module.exports.default = app;
