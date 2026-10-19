"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUserAdminConfigsFromDb = loadUserAdminConfigsFromDb;
exports.getUserLeaderboardLimit = getUserLeaderboardLimit;
exports.setUserLeaderboardLimit = setUserLeaderboardLimit;
exports.getUserReminderLimit = getUserReminderLimit;
exports.setUserReminderLimit = setUserReminderLimit;
exports.getUserTaskReminderLimit = getUserTaskReminderLimit;
exports.setUserTaskReminderLimit = setUserTaskReminderLimit;
exports.getUserDiscoverGroupsLimit = getUserDiscoverGroupsLimit;
exports.setUserDiscoverGroupsLimit = setUserDiscoverGroupsLimit;
exports.getUserProfileImageLimitMb = getUserProfileImageLimitMb;
exports.setUserProfileImageLimitMb = setUserProfileImageLimitMb;
exports.getUserAdminConfig = getUserAdminConfig;
exports.deleteUserAdminConfig = deleteUserAdminConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../config/prisma"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const CONFIG_FILE = path_1.default.join(DATA_DIR, 'user_admin_configs.json');
// In-memory cache for ultra-fast synchronous lookup
let memoryCache = null;
// Ensure directory exists
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function readAllConfigs() {
    if (memoryCache !== null) {
        return memoryCache;
    }
    try {
        ensureDataDir();
        if (!fs_1.default.existsSync(CONFIG_FILE)) {
            memoryCache = {};
            return memoryCache;
        }
        const raw = fs_1.default.readFileSync(CONFIG_FILE, 'utf-8');
        memoryCache = JSON.parse(raw) || {};
        return memoryCache;
    }
    catch (err) {
        console.error('Error reading user_admin_configs.json:', err);
        memoryCache = {};
        return memoryCache;
    }
}
function writeAllConfigs(configs) {
    memoryCache = configs;
    try {
        ensureDataDir();
        fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Error writing user_admin_configs.json:', err);
    }
}
// Background sync to PostgreSQL database
function syncToDatabase(userId, config) {
    prisma_1.default.userAdminConfig.upsert({
        where: { userId },
        create: {
            userId,
            leaderboardLimit: config.leaderboardLimit ?? 10,
            reminderLimit: config.reminderLimit ?? 3,
            discoverGroupsLimit: config.discoverGroupsLimit ?? 5,
            profileImageLimitMb: config.profileImageLimitMb ?? 5,
        },
        update: {
            leaderboardLimit: config.leaderboardLimit ?? 10,
            reminderLimit: config.reminderLimit ?? 3,
            discoverGroupsLimit: config.discoverGroupsLimit ?? 5,
            profileImageLimitMb: config.profileImageLimitMb ?? 5,
        },
    }).catch((err) => {
        // Non-blocking catch for serverless resilience
        console.warn(`[adminConfigService] DB sync for user ${userId} warning:`, err?.message || err);
    });
}
/**
 * Preloads user admin configs from PostgreSQL into memory cache on cold start
 */
async function loadUserAdminConfigsFromDb() {
    try {
        const dbConfigs = await prisma_1.default.userAdminConfig.findMany();
        const configs = readAllConfigs();
        for (const c of dbConfigs) {
            configs[c.userId] = {
                ...configs[c.userId],
                leaderboardLimit: c.leaderboardLimit,
                reminderLimit: c.reminderLimit,
                discoverGroupsLimit: c.discoverGroupsLimit,
                profileImageLimitMb: c.profileImageLimitMb,
            };
        }
        writeAllConfigs(configs);
    }
    catch (err) {
        // Non-fatal if DB not yet reachable
    }
}
function getUserLeaderboardLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.leaderboardLimit === 'number' && userConf.leaderboardLimit > 0) {
        return userConf.leaderboardLimit;
    }
    return 10; // Default Top 10 cohort
}
function setUserLeaderboardLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].leaderboardLimit = Math.max(1, Math.min(100, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserReminderLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.reminderLimit === 'number' && userConf.reminderLimit > 0) {
        return userConf.reminderLimit;
    }
    return 3; // Default 3 scheduled reminders quota
}
function setUserReminderLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].reminderLimit = Math.max(1, Math.min(50, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserTaskReminderLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.taskReminderLimit === 'number' && userConf.taskReminderLimit > 0) {
        return userConf.taskReminderLimit;
    }
    return 1; // Default 1 scheduled reminder per task quota for all users
}
function setUserTaskReminderLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].taskReminderLimit = Math.max(1, Math.min(50, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserDiscoverGroupsLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.discoverGroupsLimit === 'number' && userConf.discoverGroupsLimit > 0) {
        return userConf.discoverGroupsLimit;
    }
    return 5; // Default Top 5 ranking discover groups
}
function setUserDiscoverGroupsLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].discoverGroupsLimit = Math.max(1, Math.min(100, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserProfileImageLimitMb(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.profileImageLimitMb === 'number' && userConf.profileImageLimitMb > 0) {
        return userConf.profileImageLimitMb;
    }
    return 5; // Default 5 MB profile image upload quota
}
function setUserProfileImageLimitMb(userId, limitMb) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].profileImageLimitMb = Math.max(1, Math.min(100, Math.round(limitMb)));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserAdminConfig(userId) {
    const configs = readAllConfigs();
    return configs[userId] || {
        leaderboardLimit: 10,
        reminderLimit: 3,
        discoverGroupsLimit: 5,
        profileImageLimitMb: 5,
    };
}
function deleteUserAdminConfig(userId) {
    const configs = readAllConfigs();
    if (configs[userId]) {
        delete configs[userId];
        writeAllConfigs(configs);
    }
    prisma_1.default.userAdminConfig.delete({
        where: { userId },
    }).catch(() => { });
}
