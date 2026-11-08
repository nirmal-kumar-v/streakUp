import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

export interface UserAdminConfig {
  leaderboardLimit?: number;
  reminderLimit?: number;
  taskReminderLimit?: number;
  discoverGroupsLimit?: number;
  profileImageLimitMb?: number;
  activeTaskLimit?: number;
  archivedTaskLimit?: number;
  friendLimit?: number;
  emailTriggerLimit?: number;
  [key: string]: any;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'user_admin_configs.json');

// In-memory cache for ultra-fast synchronous lookup
let memoryCache: Record<string, UserAdminConfig> | null = null;

// Ensure directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllConfigs(): Record<string, UserAdminConfig> {
  if (memoryCache !== null) {
    return memoryCache;
  }
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      memoryCache = {};
      return memoryCache;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    memoryCache = JSON.parse(raw) || {};
    return memoryCache!;
  } catch (err) {
    console.error('Error reading user_admin_configs.json:', err);
    memoryCache = {};
    return memoryCache;
  }
}

function writeAllConfigs(configs: Record<string, UserAdminConfig>): void {
  memoryCache = configs;
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing user_admin_configs.json:', err);
  }
}

// Background sync to PostgreSQL database
function syncToDatabase(userId: string, config: UserAdminConfig): void {
  prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    .then((existingUser) => {
      if (!existingUser) return;
      return prisma.userAdminConfig.upsert({
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
    })
    .catch(() => {
      // Non-blocking catch for serverless resilience
    });
}

/**
 * Preloads user admin configs from PostgreSQL into memory cache on cold start
 */
export async function loadUserAdminConfigsFromDb(): Promise<void> {
  try {
    const dbConfigs = await prisma.userAdminConfig.findMany();
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
  } catch (err) {
    // Non-fatal if DB not yet reachable
  }
}


export function getUserLeaderboardLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.leaderboardLimit === 'number' && userConf.leaderboardLimit > 0) {
    return userConf.leaderboardLimit;
  }
  return 10; // Default Top 10 cohort
}

export function setUserLeaderboardLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].leaderboardLimit = Math.max(1, Math.min(100, limit));
  writeAllConfigs(configs);
  syncToDatabase(userId, configs[userId]);
}

export function getUserReminderLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.reminderLimit === 'number' && userConf.reminderLimit > 0) {
    return userConf.reminderLimit;
  }
  return 2; // Default 2 scheduled reminders quota
}

export function setUserReminderLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].reminderLimit = Math.max(1, Math.min(50, limit));
  writeAllConfigs(configs);
  syncToDatabase(userId, configs[userId]);
}

export function getUserTaskReminderLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.taskReminderLimit === 'number' && userConf.taskReminderLimit > 0) {
    return userConf.taskReminderLimit;
  }
  return 1; // Default 1 scheduled reminder per task quota for all users
}

export function setUserTaskReminderLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].taskReminderLimit = Math.max(1, Math.min(50, limit));
  writeAllConfigs(configs);
  syncToDatabase(userId, configs[userId]);
}

export function getUserDiscoverGroupsLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.discoverGroupsLimit === 'number' && userConf.discoverGroupsLimit > 0) {
    return userConf.discoverGroupsLimit;
  }
  return 5; // Default Top 5 ranking discover groups
}

export function setUserDiscoverGroupsLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].discoverGroupsLimit = Math.max(1, Math.min(100, limit));
  writeAllConfigs(configs);
  syncToDatabase(userId, configs[userId]);
}

export function getUserProfileImageLimitMb(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.profileImageLimitMb === 'number' && userConf.profileImageLimitMb > 0) {
    return userConf.profileImageLimitMb;
  }
  return 5; // Default 5 MB profile image upload quota
}

export function setUserProfileImageLimitMb(userId: string, limitMb: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].profileImageLimitMb = Math.max(1, Math.min(100, Math.round(limitMb)));
  writeAllConfigs(configs);
  syncToDatabase(userId, configs[userId]);
}

export function getUserActiveTaskLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.activeTaskLimit === 'number' && userConf.activeTaskLimit > 0) {
    return userConf.activeTaskLimit;
  }
  return 10; // Default 10 active tasks + groups combined
}

export function setUserActiveTaskLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].activeTaskLimit = Math.max(1, Math.min(100, limit));
  writeAllConfigs(configs);
}

export function getUserArchivedTaskLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.archivedTaskLimit === 'number' && userConf.archivedTaskLimit > 0) {
    return userConf.archivedTaskLimit;
  }
  return 5; // Default 5 archived tasks
}

export function setUserArchivedTaskLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].archivedTaskLimit = Math.max(1, Math.min(50, limit));
  writeAllConfigs(configs);
}

export function getUserFriendLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.friendLimit === 'number' && userConf.friendLimit > 0) {
    return userConf.friendLimit;
  }
  return 15; // Default 15 friend connections quota
}

export function setUserFriendLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].friendLimit = Math.max(1, Math.min(100, limit));
  writeAllConfigs(configs);
}

export function getUserEmailTriggerLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.emailTriggerLimit === 'number' && userConf.emailTriggerLimit >= 1) {
    return Math.max(1, Math.min(8, userConf.emailTriggerLimit));
  }
  return 4; // Default 4 maximum email notification triggers
}

export function setUserEmailTriggerLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].emailTriggerLimit = Math.max(1, Math.min(8, limit));
  writeAllConfigs(configs);
}

export function getUserAdminConfig(userId: string): UserAdminConfig {
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
    ...userConf,
  };
}

export function deleteUserAdminConfig(userId: string): void {
  const configs = readAllConfigs();
  if (configs[userId]) {
    delete configs[userId];
    writeAllConfigs(configs);
  }
  prisma.userAdminConfig.deleteMany({
    where: { userId },
  }).catch(() => {});
}



