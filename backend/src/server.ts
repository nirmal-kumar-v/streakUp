import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 StreakUp Backend Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🕒 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Allowed Client: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_POSTGRESQL_CONNECTION_STRING_HERE')) {
    console.log(`⚠️  Notice: DATABASE_URL is set to a placeholder in .env.`);
    console.log(`👉 Update backend/.env with your PostgreSQL database URL, then run:`);
    console.log(`   npx prisma migrate dev (or npx prisma db push)`);
  }
  console.log(`===============================================`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
