"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), 'backend/.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const globalForPrisma = globalThis;
function createPrismaClient() {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
}
// Lazy-initialized Prisma instance prevents serverless crash if DB environment variables are missing during cold start
exports.prisma = new Proxy({}, {
    get(_target, prop) {
        if (!globalForPrisma.prisma) {
            globalForPrisma.prisma = createPrismaClient();
        }
        const val = globalForPrisma.prisma[prop];
        if (typeof val === 'function') {
            return val.bind(globalForPrisma.prisma);
        }
        return val;
    }
});
exports.default = exports.prisma;
