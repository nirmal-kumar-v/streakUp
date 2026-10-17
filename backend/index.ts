import app from './src/app';

const handler = (app as any).default || app;
export default handler;
module.exports = handler;
module.exports.default = handler;
