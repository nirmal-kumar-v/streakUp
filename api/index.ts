let expressApp: any;

try {
  const app = require('../backend/dist/app');
  expressApp = app.default || app;
} catch {
  try {
    const app = require('../backend/src/app');
    expressApp = app.default || app;
  } catch (err) {
    console.error('Failed to resolve express app in api/index.ts:', err);
    throw err;
  }
}

export default expressApp;
module.exports = expressApp;
module.exports.default = expressApp;
