import fs from 'fs';
import path from 'path';

interface UserAdminConfig {
  leaderboardLimit?: number;
  [key: string]: any;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'user_admin_configs.json');

// Ensure directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllConfigs(): Record<string, UserAdminConfig> {
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error('Error reading user_admin_configs.json:', err);
    return {};
  }
}

function writeAllConfigs(configs: Record<string, UserAdminConfig>): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing user_admin_configs.json:', err);
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
}

export function getUserReminderLimit(userId: string): number {
  const configs = readAllConfigs();
  const userConf = configs[userId];
  if (userConf && typeof userConf.reminderLimit === 'number' && userConf.reminderLimit > 0) {
    return userConf.reminderLimit;
  }
  return 3; // Default 3 scheduled reminders quota
}

export function setUserReminderLimit(userId: string, limit: number): void {
  const configs = readAllConfigs();
  if (!configs[userId]) {
    configs[userId] = {};
  }
  configs[userId].reminderLimit = Math.max(1, Math.min(50, limit));
  writeAllConfigs(configs);
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
}

export function getUserAdminConfig(userId: string): UserAdminConfig {
  const configs = readAllConfigs();
  return configs[userId] || {
    leaderboardLimit: 10,
    reminderLimit: 3,
    discoverGroupsLimit: 5,
    profileImageLimitMb: 5,
  };
}

export function deleteUserAdminConfig(userId: string): void {
  const configs = readAllConfigs();
  if (configs[userId]) {
    delete configs[userId];
    writeAllConfigs(configs);
  }
}


