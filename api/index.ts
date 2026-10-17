let app: any;
let initError: any = null;

try {
  app = require('../backend/dist/app');
} catch (err) {
  initError = err;
  console.error('Failed to load ../backend/dist/app in api/index.ts:', err);
}

const handler = (req: any, res: any) => {
  if (initError) {
    return res.status(500).json({
      success: false,
      error: 'API serverless initialization failed: ' + initError.message,
      stack: process.env.NODE_ENV === 'development' ? initError.stack : undefined
    });
  }
  const expressApp = app.default || app;
  return expressApp(req, res);
};

export default handler;
module.exports = handler;
module.exports.default = handler;
