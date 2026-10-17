import app from './app';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 StreakUp Backend Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🕒 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Allowed Client: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  console.log(`===============================================`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

// Export for Vercel Express service (supports both ESM and CJS loaders)
export default app;
module.exports = app;
module.exports.default = app;
