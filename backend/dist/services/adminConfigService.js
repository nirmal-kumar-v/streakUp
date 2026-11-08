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
exports.getUserActiveTaskLimit = getUserActiveTaskLimit;
exports.setUserActiveTaskLimit = setUserActiveTaskLimit;
exports.getUserArchivedTaskLimit = getUserArchivedTaskLimit;
exports.setUserArchivedTaskLimit = setUserArchivedTaskLimit;
exports.getUserFriendLimit = getUserFriendLimit;
exports.setUserFriendLimit = setUserFriendLimit;
exports.getUserEmailTriggerLimit = getUserEmailTriggerLimit;
exports.setUserEmailTriggerLimit = setUserEmailTriggerLimit;
exports.getUserAdminConfig = getUserAdminConfig;
exports.getUserDuolingoCourseLimit = getUserDuolingoCourseLimit;
exports.setUserDuolingoCourseLimit = setUserDuolingoCourseLimit;
exports.deleteUserAdminConfig = deleteUserAdminConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../config/prisma"));
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const CONFIG_FILE = path_1.default.join(DATA_DIR, 'user_admin_configs.json');
// In-memory cache for ultra-fast synchronous lookup
let memoryCache = null;
let isConfigsDbTableInitialized = false;
async function initConfigsDbTable() {
    if (isConfigsDbTableInitialized)
        return;
    isConfigsDbTableInitialized = true;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_admin_configs_store" (
        "user_id" VARCHAR(100) PRIMARY KEY,
        "data" JSONB NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    }
    catch {
        // Failover silently
    }
}
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
// Background sync to PostgreSQL database (both JSONB store and legacy prisma model)
function syncToDatabase(userId, config) {
    (async () => {
        try {
            await initConfigsDbTable();
            await prisma_1.default.$executeRawUnsafe(`
        INSERT INTO "user_admin_configs_store" ("user_id", "data", "updated_at")
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT ("user_id")
        DO UPDATE SET "data" = EXCLUDED."data", "updated_at" = NOW();
      `, userId, JSON.stringify(config));
        }
        catch {
            // Fallback
        }
        try {
            const existingUser = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { id: true } });
            if (existingUser) {
                await prisma_1.default.userAdminConfig.upsert({
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
                });
            }
        }
        catch {
            // Non-blocking catch for serverless resilience
        }
    })().catch(() => { });
}
/**
 * Preloads user admin configs from PostgreSQL into memory cache on cold start
 */
async function loadUserAdminConfigsFromDb() {
    try {
        await initConfigsDbTable();
        const rows = (await prisma_1.default.$queryRawUnsafe(`
      SELECT "user_id", "data" FROM "user_admin_configs_store"
    `).catch(() => []));
        const configs = readAllConfigs();
        if (Array.isArray(rows) && rows.length > 0) {
            for (const r of rows) {
                try {
                    const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    configs[r.user_id] = { ...configs[r.user_id], ...parsed };
                }
                catch { }
            }
        }
        // Also merge with legacy userAdminConfig table for backwards-compatibility
        const dbConfigs = await prisma_1.default.userAdminConfig.findMany().catch(() => []);
        for (const c of dbConfigs) {
            configs[c.userId] = {
                leaderboardLimit: c.leaderboardLimit,
                reminderLimit: c.reminderLimit,
                discoverGroupsLimit: c.discoverGroupsLimit,
                profileImageLimitMb: c.profileImageLimitMb,
                ...configs[c.userId], // JSONB store takes precedence
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
    return 2; // Default 2 scheduled reminders quota
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
function getUserActiveTaskLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.activeTaskLimit === 'number' && userConf.activeTaskLimit > 0) {
        return userConf.activeTaskLimit;
    }
    return 10; // Default 10 active tasks + groups combined
}
function setUserActiveTaskLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].activeTaskLimit = Math.max(1, Math.min(100, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserArchivedTaskLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.archivedTaskLimit === 'number' && userConf.archivedTaskLimit > 0) {
        return userConf.archivedTaskLimit;
    }
    return 5; // Default 5 archived tasks
}
function setUserArchivedTaskLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].archivedTaskLimit = Math.max(1, Math.min(50, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserFriendLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.friendLimit === 'number' && userConf.friendLimit > 0) {
        return userConf.friendLimit;
    }
    return 15; // Default 15 friend connections quota
}
function setUserFriendLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].friendLimit = Math.max(1, Math.min(100, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserEmailTriggerLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.emailTriggerLimit === 'number' && userConf.emailTriggerLimit >= 1) {
        return Math.max(1, Math.min(8, userConf.emailTriggerLimit));
    }
    return 4; // Default 4 maximum email notification triggers
}
function setUserEmailTriggerLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].emailTriggerLimit = Math.max(1, Math.min(8, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function getUserAdminConfig(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId] || {};
    return {
        leaderboardLimit: userConf.leaderboardLimit ?? 10,
        reminderLimit: userConf.reminderLimit ?? 2,
        taskReminderLimit: userConf.taskReminderLimit ?? 1,
        discoverGroupsLimit: userConf.discoverGroupsLimit ?? 5,
        profileImageLimitMb: userConf.profileImageLimitMb ?? 5,
        activeTaskLimit: userConf.activeTaskLimit ?? 10,
        archivedTaskLimit: userConf.archivedTaskLimit ?? 5,
        friendLimit: userConf.friendLimit ?? 15,
        emailTriggerLimit: userConf.emailTriggerLimit ?? 4,
        duolingoCourseLimit: userConf.duolingoCourseLimit ?? 5,
        ...userConf,
    };
}
function getUserDuolingoCourseLimit(userId) {
    const configs = readAllConfigs();
    const userConf = configs[userId];
    if (userConf && typeof userConf.duolingoCourseLimit === 'number' && userConf.duolingoCourseLimit >= 1) {
        return userConf.duolingoCourseLimit;
    }
    return 5; // Default 5 Duolingo courses per user
}
function setUserDuolingoCourseLimit(userId, limit) {
    const configs = readAllConfigs();
    if (!configs[userId]) {
        configs[userId] = {};
    }
    configs[userId].duolingoCourseLimit = Math.max(1, Math.min(45, limit));
    writeAllConfigs(configs);
    syncToDatabase(userId, configs[userId]);
}
function deleteUserAdminConfig(userId) {
    const configs = readAllConfigs();
    if (configs[userId]) {
        delete configs[userId];
        writeAllConfigs(configs);
    }
    prisma_1.default.userAdminConfig.deleteMany({
        where: { userId },
    }).catch(() => { });
}
