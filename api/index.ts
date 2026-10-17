const app = require('../backend/dist/app');

const expressApp = app.default || app;
export default expressApp;
module.exports = expressApp;
module.exports.default = expressApp;
