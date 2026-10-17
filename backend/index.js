const app = require('./dist/app');

const handler = app.default || app;
exports.default = handler;
module.exports = handler;
module.exports.default = handler;
