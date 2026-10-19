"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINKEDIN_GAMES = void 0;
exports.normalizeGameId = normalizeGameId;
exports.isLinkedInName = isLinkedInName;
exports.initDatabaseTable = initDatabaseTable;
exports.getRawGameRecord = getRawGameRecord;
exports.computeGameDataForUser = computeGameDataForUser;
exports.getAllGamesForMember = getAllGamesForMember;
exports.getSingleGameForMember = getSingleGameForMember;
exports.completeMemberGame = completeMemberGame;
exports.uncompleteMemberGame = uncompleteMemberGame;
exports.invalidateGameLeaderboardCache = invalidateGameLeaderboardCache;
exports.getGameLeaderboard = getGameLeaderboard;
exports.adminCorrectGameStreak = adminCorrectGameStreak;
exports.adminGrantGameDate = adminGrantGameDate;
exports.adminFreezeGameDate = adminFreezeGameDate;
exports.setGameCommitment = setGameCommitment;
exports.getLinkedInDashboardStreak = getLinkedInDashboardStreak;
exports.completeCommittedGamesForDashboard = completeCommittedGamesForDashboard;
exports.uncompleteCommittedGamesForDashboard = uncompleteCommittedGamesForDashboard;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../config/prisma"));
const freezeService_1 = require("./freezeService");
const timezoneService_1 = require("./timezoneService");
exports.LINKEDIN_GAMES = [
    {
        id: 'pinpoint',
        name: 'Pinpoint',
        description: 'Guess the secret category in as few clues as possible.',
        tagline: '5 clues • 1 category',
    },
    {
        id: 'crossclimb',
        name: 'Crossclimb',
        description: 'Solve trivia clues to build the word ladder from start to finish.',
        tagline: 'Trivia • Word ladder',
    },
    {
        id: 'queens',
        name: 'Queens',
        description: 'Place exactly one crown in every row, column, and color region without touching.',
        tagline: 'Crown logic puzzle',
    },
    {
        id: 'tango',
        name: 'Tango',
        description: 'Balance suns and moons across the grid so no more than two adjacent match.',
        tagline: 'Sun & Moon grid logic',
    },
    {
        id: 'zip',
        name: 'Zip',
        description: 'Trace through the number path connecting points in sequential order.',
        tagline: 'Connect the path',
    },
    {
        id: 'mini-sudoku',
        name: 'Mini Sudoku',
        description: 'Solve the quick 6x6 number grid puzzle with numbers 1 through 6.',
        tagline: 'Quick 6x6 numbers',
    },
    {
        id: 'patches',
        name: 'Patches',
        description: 'Arrange pattern shapes to perfectly cover the target silhouette.',
        tagline: 'Pattern matching & tangram',
    },
    {
        id: 'wend',
        name: 'Wend',
        description: 'Step-by-step word morphing puzzle to navigate from starting to target word.',
        tagline: 'Word morphing pathway',
    },
];
function normalizeGameId(gameId) {
    if (!gameId)
        return null;
    const clean = gameId.trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (clean === 'minisudoku')
        return 'mini-sudoku';
    const match = exports.LINKEDIN_GAMES.find((g) => g.id === clean || g.name.toLowerCase() === clean);
    return match ? match.id : null;
}
function isLinkedInName(name) {
    if (!name)
        return false;
    const clean = name.trim().toLowerCase().replace(/[\s\-_]+/g, '');
    return clean === 'linkedin' || clean === 'linkdin' || clean === 'linked';
}
const DATA_DIR = path_1.default.resolve(__dirname, '../../data');
const STORAGE_FILE = path_1.default.join(DATA_DIR, 'linkedin_games.json');
// In-memory cache for high-throughput reads
let gamesCache = null;
let isDbTableInitialized = false;
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function getRecordKey(groupId, userId, gameId) {
    return `${groupId}:${userId}:${gameId}`;
}
function loadAllRecords() {
    if (gamesCache !== null) {
        return gamesCache;
    }
    try {
        ensureDataDir();
        if (!fs_1.default.existsSync(STORAGE_FILE)) {
            gamesCache = {};
            return gamesCache;
        }
        const raw = fs_1.default.readFileSync(STORAGE_FILE, 'utf-8');
        gamesCache = JSON.parse(raw) || {};
        return gamesCache;
    }
    catch (err) {
        console.error('[LinkedInGameService] Error reading storage file:', err);
        gamesCache = {};
        return gamesCache;
    }
}
function saveAllRecords(records) {
    gamesCache = records;
    try {
        ensureDataDir();
        fs_1.default.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[LinkedInGameService] Error writing storage file:', err);
    }
}
// Ensure the PostgreSQL backing table exists without relying on Prisma generator renames
async function initDatabaseTable() {
    if (isDbTableInitialized)
        return;
    isDbTableInitialized = true;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "linkedin_game_records" (
        "id" VARCHAR(100) PRIMARY KEY,
        "group_id" VARCHAR(100) NOT NULL,
        "user_id" VARCHAR(100) NOT NULL,
        "game_id" VARCHAR(50) NOT NULL,
        "manual_current_streak" INT,
        "manual_longest_streak" INT,
        "data" JSONB NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_linkedin_game_records_group_game" ON "linkedin_game_records" ("group_id", "game_id")
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_linkedin_game_records_user" ON "linkedin_game_records" ("user_id")
    `);
    }
    catch (err) {
        // If raw query fails (e.g. permission or network), fallback gracefully to file store
    }
}
async function syncRecordToDb(record) {
    // Execute database synchronization in the background without blocking execution
    setImmediate(async () => {
        try {
            await initDatabaseTable();
            const id = getRecordKey(record.groupId, record.userId, record.gameId);
            await prisma_1.default.$executeRawUnsafe(`INSERT INTO "linkedin_game_records" ("id", "group_id", "user_id", "game_id", "manual_current_streak", "manual_longest_streak", "data", "updated_at")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
         ON CONFLICT ("id") DO UPDATE
         SET "manual_current_streak" = EXCLUDED."manual_current_streak",
             "manual_longest_streak" = EXCLUDED."manual_longest_streak",
             "data" = EXCLUDED."data",
             "updated_at" = NOW()`, id, record.groupId, record.userId, record.gameId, record.manualCurrentStreak ?? null, record.manualLongestStreak ?? null, JSON.stringify(record));
        }
        catch (err) {
            // Silent failover to file store
        }
    });
}
function getRawGameRecord(groupId, userId, gameId) {
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, gameId);
    if (!records[key]) {
        records[key] = {
            groupId,
            userId,
            gameId,
            manualCurrentStreak: null,
            manualLongestStreak: null,
            isCommitted: true, // All 8 games committed by default for existing and newly created participants
            completions: [],
            freezeLogs: [],
            updatedAt: new Date().toISOString(),
        };
        saveAllRecords(records);
    }
    return records[key];
}
function computeGameDataForUser(record, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const meta = exports.LINKEDIN_GAMES.find((g) => g.id === record.gameId) || {
        id: record.gameId,
        name: record.gameId,
        description: '',
        tagline: '',
    };
    const todayStr = (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const completionDates = record.completions.map((c) => c.completionDate);
    const protectedDates = record.freezeLogs.map((f) => f.protectedDate);
    const streakResult = (0, freezeService_1.calculateStreakAndFreezes)(completionDates, protectedDates, userTimezone, undefined, [0, 1, 2, 3, 4, 5, 6], // Daily games
    1 // Default 1 freeze capacity
    );
    const completedToday = completionDates.includes(todayStr);
    const todayItem = record.completions.find((c) => c.completionDate === todayStr);
    const currentStreak = typeof record.manualCurrentStreak === 'number'
        ? record.manualCurrentStreak
        : streakResult.currentStreak;
    const longestStreak = typeof record.manualLongestStreak === 'number'
        ? record.manualLongestStreak
        : Math.max(streakResult.longestStreak, currentStreak);
    // Sort completions descending by date
    const sortedCompletions = [...record.completions].sort((a, b) => b.completionDate.localeCompare(a.completionDate));
    return {
        gameId: record.gameId,
        name: meta.name,
        description: meta.description,
        tagline: meta.tagline,
        isCommitted: record.isCommitted !== false,
        currentStreak,
        longestStreak,
        completedToday,
        todayNote: todayItem?.studyNote || null,
        freezeBalance: streakResult.freezeBalance,
        freezeRechargeDays: streakResult.freezeRechargeDays,
        totalCompletions: record.completions.length,
        lastCompletedDate: streakResult.lastCompletedDate,
        completionsHistory: sortedCompletions.slice(0, 30),
        freezeLogs: record.freezeLogs,
    };
}
/**
 * Retrieves all 8 games for a specific group member
 */
async function getAllGamesForMember(groupId, userId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const result = [];
    for (const game of exports.LINKEDIN_GAMES) {
        const raw = getRawGameRecord(groupId, userId, game.id);
        result.push(computeGameDataForUser(raw, userTimezone));
    }
    return result;
}
/**
 * Retrieves single game data for a specific group member
 */
async function getSingleGameForMember(groupId, userId, gameId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const normalized = normalizeGameId(gameId);
    if (!normalized)
        return null;
    const raw = getRawGameRecord(groupId, userId, normalized);
    return computeGameDataForUser(raw, userTimezone);
}
/**
 * Completes a specific game for a member on a local date
 */
async function completeMemberGame(groupId, userId, gameId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE, completionDate, studyNote) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const targetDate = completionDate || (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    // If already completed on this date, update the note
    const existingIndex = record.completions.findIndex((c) => c.completionDate === targetDate);
    if (existingIndex >= 0) {
        if (studyNote !== undefined) {
            record.completions[existingIndex].studyNote = studyNote;
        }
    }
    else {
        // Add new completion record
        record.completions.push({
            completionDate: targetDate,
            completedAt: new Date().toISOString(),
            studyNote: studyNote || null,
        });
    }
    // Clear any manual override once real completion arrives
    record.manualCurrentStreak = null;
    record.manualLongestStreak = null;
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    invalidateGameLeaderboardCache(groupId, normalized);
    return computeGameDataForUser(record, userTimezone);
}
/**
 * Reverses/uncompletes a specific LinkedIn game for a member on a local date
 */
async function uncompleteMemberGame(groupId, userId, gameId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE, completionDate) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const targetDate = completionDate || (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    record.completions = record.completions.filter((c) => c.completionDate !== targetDate);
    record.manualCurrentStreak = null;
    record.manualLongestStreak = null;
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    invalidateGameLeaderboardCache(groupId, normalized);
    return computeGameDataForUser(record, userTimezone);
}
const leaderboardCache = new Map();
const LEADERBOARD_CACHE_TTL_MS = 15000;
function invalidateGameLeaderboardCache(groupId, gameId) {
    if (!groupId) {
        leaderboardCache.clear();
        return;
    }
    if (!gameId) {
        for (const key of leaderboardCache.keys()) {
            if (key.startsWith(`${groupId}:`)) {
                leaderboardCache.delete(key);
            }
        }
        return;
    }
    const normalized = normalizeGameId(gameId) || gameId;
    leaderboardCache.delete(`${groupId}:${normalized}`);
}
/**
 * Generates an independent leaderboard for a specific game across all accepted group members
 */
async function getGameLeaderboard(groupId, gameId) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const cacheKey = `${groupId}:${normalized}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
        return cached.data;
    }
    // 1. Fetch all accepted members of this group
    const members = await prisma_1.default.groupMember.findMany({
        where: { groupId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    profileImage: true,
                    timezone: true,
                },
            },
        },
    });
    // 2. Compute game streaks for each member
    const entries = members.map((m) => {
        const raw = getRawGameRecord(groupId, m.userId, normalized);
        const computed = computeGameDataForUser(raw, m.user.timezone || timezoneService_1.DEFAULT_TIMEZONE);
        return {
            userId: m.user.id,
            name: m.user.name,
            username: m.user.username,
            profileImage: m.user.profileImage,
            role: m.role,
            currentStreak: computed.currentStreak,
            longestStreak: computed.longestStreak,
            totalCompletions: computed.totalCompletions,
            completedToday: computed.completedToday,
            todayNote: computed.todayNote,
            lastCompletedDate: computed.lastCompletedDate,
        };
    });
    // 3. Sort: currentStreak DESC, then longestStreak DESC, then totalCompletions DESC, then name ASC
    entries.sort((a, b) => {
        if (b.currentStreak !== a.currentStreak)
            return b.currentStreak - a.currentStreak;
        if (b.longestStreak !== a.longestStreak)
            return b.longestStreak - a.longestStreak;
        if (b.totalCompletions !== a.totalCompletions)
            return b.totalCompletions - a.totalCompletions;
        return a.name.localeCompare(b.name);
    });
    // 4. Assign rank with tie handling
    let currentRank = 1;
    const ranked = entries.map((entry, index) => {
        if (index > 0) {
            const prev = entries[index - 1];
            if (entry.currentStreak === prev.currentStreak &&
                entry.longestStreak === prev.longestStreak &&
                entry.totalCompletions === prev.totalCompletions) {
                // Tie maintains same rank
            }
            else {
                currentRank = index + 1;
            }
        }
        return {
            ...entry,
            rank: currentRank,
        };
    });
    leaderboardCache.set(cacheKey, { timestamp: Date.now(), data: ranked });
    return ranked;
}
/**
 * Super Admin streak correction for an individual game
 */
async function adminCorrectGameStreak(groupId, userId, gameId, currentStreak, longestStreak) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    record.manualCurrentStreak = currentStreak;
    record.manualLongestStreak = Math.max(longestStreak, currentStreak);
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    invalidateGameLeaderboardCache(groupId, normalized);
    const user = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return computeGameDataForUser(record, user?.timezone || timezoneService_1.DEFAULT_TIMEZONE);
}
/**
 * Super Admin retroactively grants or toggles completion for an individual game on a calendar date
 */
async function adminGrantGameDate(groupId, userId, gameId, date, studyNote) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    const existingIdx = record.completions.findIndex((c) => c.completionDate === date);
    if (existingIdx >= 0) {
        record.completions[existingIdx].studyNote = studyNote || record.completions[existingIdx].studyNote;
    }
    else {
        record.completions.push({
            completionDate: date,
            completedAt: new Date().toISOString(),
            studyNote: studyNote || 'Retroactively granted by admin',
        });
    }
    record.manualCurrentStreak = null;
    record.manualLongestStreak = null;
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    invalidateGameLeaderboardCache(groupId, normalized);
    const user = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return computeGameDataForUser(record, user?.timezone || timezoneService_1.DEFAULT_TIMEZONE);
}
/**
 * Super Admin applies or removes freeze protection on a calendar date for an individual game
 */
async function adminFreezeGameDate(groupId, userId, gameId, date, isFrozen) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    if (isFrozen) {
        if (!record.freezeLogs.some((f) => f.protectedDate === date)) {
            record.freezeLogs.push({
                protectedDate: date,
                usedAt: new Date().toISOString(),
            });
        }
    }
    else {
        record.freezeLogs = record.freezeLogs.filter((f) => f.protectedDate !== date);
    }
    record.manualCurrentStreak = null;
    record.manualLongestStreak = null;
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    invalidateGameLeaderboardCache(groupId, normalized);
    const user = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return computeGameDataForUser(record, user?.timezone || timezoneService_1.DEFAULT_TIMEZONE);
}
/**
 * Updates a member's commitment status for an individual LinkedIn game.
 * Uncommitting does NOT delete history, reset streak, or consume freeze.
 * Recommitting preserves history and normal streak rules.
 */
async function setGameCommitment(groupId, userId, gameId, isCommitted, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const normalized = normalizeGameId(gameId);
    if (!normalized) {
        throw new Error(`Invalid LinkedIn game ID: ${gameId}`);
    }
    const records = loadAllRecords();
    const key = getRecordKey(groupId, userId, normalized);
    const record = getRawGameRecord(groupId, userId, normalized);
    record.isCommitted = Boolean(isCommitted);
    record.updatedAt = new Date().toISOString();
    records[key] = record;
    saveAllRecords(records);
    syncRecordToDb(record).catch(() => { });
    return computeGameDataForUser(record, userTimezone);
}
/**
 * Calculates the LinkedIn dashboard streak aggregate:
 * Highest current streak among that user's committed LinkedIn games.
 * If no games are committed, returns zero.
 * completedToday is true if at least 1 game is committed and all committed games are completed today.
 */
async function getLinkedInDashboardStreak(groupId, userId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE) {
    const games = await getAllGamesForMember(groupId, userId, userTimezone);
    const committedGames = games.filter((g) => g.isCommitted);
    // Highest current streak of any of the committed LinkedIn games
    const currentStreak = committedGames.length > 0 ? Math.max(0, ...committedGames.map((g) => g.currentStreak)) : 0;
    const longestStreak = committedGames.length > 0 ? Math.max(0, ...committedGames.map((g) => g.longestStreak)) : 0;
    const completedToday = committedGames.length > 0 && committedGames.every((g) => g.completedToday);
    return {
        currentStreak,
        longestStreak,
        completedToday,
        committedCount: committedGames.length,
        totalGames: games.length,
    };
}
/**
 * Ticking the LinkedIn dashboard task completes all currently committed games
 * for that user on the qualifying date without completing uncommitted games.
 * Does not award duplicate completions if already completed.
 */
async function completeCommittedGamesForDashboard(groupId, userId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE, completionDate) {
    const todayDate = completionDate || (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const games = await getAllGamesForMember(groupId, userId, userTimezone);
    const committedGames = games.filter((g) => g.isCommitted);
    let newlyCompleted = 0;
    let alreadyCompleted = 0;
    for (const game of committedGames) {
        const raw = getRawGameRecord(groupId, userId, game.gameId);
        const isDone = raw.completions.some((c) => c.completionDate === todayDate);
        if (isDone) {
            alreadyCompleted++;
        }
        else {
            await completeMemberGame(groupId, userId, game.gameId, userTimezone, todayDate, null // No study note requested for LinkedIn dashboard completion
            );
            newlyCompleted++;
        }
    }
    const dashSummary = await getLinkedInDashboardStreak(groupId, userId, userTimezone);
    return {
        highestStreak: dashSummary.currentStreak,
        longestStreak: dashSummary.longestStreak,
        completedGamesCount: newlyCompleted,
        alreadyCompletedCount: alreadyCompleted,
        totalCommittedCount: committedGames.length,
    };
}
/**
 * Unticking the LinkedIn dashboard task marks committed games as incomplete for today.
 */
async function uncompleteCommittedGamesForDashboard(groupId, userId, userTimezone = timezoneService_1.DEFAULT_TIMEZONE, completionDate) {
    const targetDate = completionDate || (0, timezoneService_1.getTodayInTimezone)(userTimezone);
    const games = await getAllGamesForMember(groupId, userId, userTimezone);
    const committedGames = games.filter((g) => g.isCommitted);
    const records = loadAllRecords();
    for (const game of committedGames) {
        const key = getRecordKey(groupId, userId, game.gameId);
        const raw = getRawGameRecord(groupId, userId, game.gameId);
        raw.completions = raw.completions.filter((c) => c.completionDate !== targetDate);
        raw.manualCurrentStreak = null;
        raw.manualLongestStreak = null;
        raw.updatedAt = new Date().toISOString();
        records[key] = raw;
        syncRecordToDb(raw).catch(() => { });
    }
    saveAllRecords(records);
    invalidateGameLeaderboardCache(groupId);
    const dashSummary = await getLinkedInDashboardStreak(groupId, userId, userTimezone);
    return {
        highestStreak: dashSummary.currentStreak,
        longestStreak: dashSummary.longestStreak,
    };
}
