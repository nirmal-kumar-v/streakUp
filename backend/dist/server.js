"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), 'backend/.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const PORT = parseInt(process.env.PORT || '5000', 10);
const server = app_1.default.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 StreakUp Backend Server Running`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🕒 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Allowed Client: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`===============================================`);
});
process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    server.close(() => process.exit(0));
});
// Export for Vercel Express service (supports both ESM and CJS loaders)
exports.default = app_1.default;
module.exports = app_1.default;
module.exports.default = app_1.default;
