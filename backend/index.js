const app = require('./dist/app');

const expressApp = app.default || app;
module.exports = expressApp;
module.exports.default = expressApp;
