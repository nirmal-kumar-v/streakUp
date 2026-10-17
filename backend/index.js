let app;
let initError = null;

try {
  app = require('./dist/app');
} catch (err) {
  initError = err;
  console.error('Failed to load ./dist/app in backend/index.js:', err);
}

const handler = (req, res) => {
  if (initError) {
    return res.status(500).json({
      success: false,
      error: 'Backend initialization failed: ' + initError.message,
      stack: process.env.NODE_ENV === 'development' ? initError.stack : undefined
    });
  }
  const expressApp = app.default || app;
  return expressApp(req, res);
};

exports.default = handler;
module.exports = handler;
module.exports.default = handler;
