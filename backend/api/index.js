let expressApp;

try {
  const app = require('../dist/app');
  expressApp = app.default || app;
} catch {
  try {
    const app = require('../src/app');
    expressApp = app.default || app;
  } catch (err) {
    console.error('Failed to resolve express app in backend/api/index.js:', err);
    throw err;
  }
}

module.exports = expressApp;
