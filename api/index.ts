const app = require('../backend/dist/server');

const handler = app.default || app;
export default handler;
module.exports = handler;
module.exports.default = handler;
