import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';
import { calculateStreakAndFreezes } from './freezeService';
import { getTodayInTimezone, DEFAULT_TIMEZONE } from './timezoneService';

// ─── Course Catalogue ───────────────────────────────────────────────────────

export interface DuolingoCourse {
  id: string;        // normalized lowercase slug e.g. 'spanish'
  name: string;      // display name e.g. 'Spanish'
  emoji: string;     // flag/icon emoji
  category: 'language' | 'other';
}

export const DUOLINGO_COURSES: DuolingoCourse[] = [
  // Languages
  { id: 'english',             name: 'English',             emoji: '🇬🇧', category: 'language' },
  { id: 'spanish',             name: 'Spanish',             emoji: '🇪🇸', category: 'language' },
  { id: 'french',              name: 'French',              emoji: '🇫🇷', category: 'language' },
  { id: 'japanese',            name: 'Japanese',            emoji: '🇯🇵', category: 'language' },
  { id: 'german',              name: 'German',              emoji: '🇩🇪', category: 'language' },
  { id: 'korean',              name: 'Korean',              emoji: '🇰🇷', category: 'language' },
  { id: 'italian',             name: 'Italian',             emoji: '🇮🇹', category: 'language' },
  { id: 'chinese-mandarin',    name: 'Chinese (Mandarin)',  emoji: '🇨🇳', category: 'language' },
  { id: 'portuguese',          name: 'Portuguese',          emoji: '🇵🇹', category: 'language' },
  { id: 'hindi',               name: 'Hindi',               emoji: '🇮🇳', category: 'language' },
  { id: 'russian',             name: 'Russian',             emoji: '🇷🇺', category: 'language' },
  { id: 'arabic',              name: 'Arabic',              emoji: '🇸🇦', category: 'language' },
  { id: 'turkish',             name: 'Turkish',             emoji: '🇹🇷', category: 'language' },
  { id: 'dutch',               name: 'Dutch',               emoji: '🇳🇱', category: 'language' },
  { id: 'swedish',             name: 'Swedish',             emoji: '🇸🇪', category: 'language' },
  { id: 'polish',              name: 'Polish',              emoji: '🇵🇱', category: 'language' },
  { id: 'ukrainian',           name: 'Ukrainian',           emoji: '🇺🇦', category: 'language' },
  { id: 'vietnamese',          name: 'Vietnamese',          emoji: '🇻🇳', category: 'language' },
  { id: 'indonesian',          name: 'Indonesian',          emoji: '🇮🇩', category: 'language' },
  { id: 'irish',               name: 'Irish',               emoji: '🇮🇪', category: 'language' },
  { id: 'greek',               name: 'Greek',               emoji: '🇬🇷', category: 'language' },
  { id: 'norwegian',           name: 'Norwegian',           emoji: '🇳🇴', category: 'language' },
  { id: 'hebrew',              name: 'Hebrew',              emoji: '🇮🇱', category: 'language' },
  { id: 'czech',               name: 'Czech',               emoji: '🇨🇿', category: 'language' },
  { id: 'danish',              name: 'Danish',              emoji: '🇩🇰', category: 'language' },
  { id: 'finnish',             name: 'Finnish',             emoji: '🇫🇮', category: 'language' },
  { id: 'hungarian',           name: 'Hungarian',           emoji: '🇭🇺', category: 'language' },
  { id: 'romanian',            name: 'Romanian',            emoji: '🇷🇴', category: 'language' },
  { id: 'swahili',             name: 'Swahili',             emoji: '🇰🇪', category: 'language' },
  { id: 'welsh',               name: 'Welsh',               emoji: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', category: 'language' },
  { id: 'intermediate-english',name: 'Intermediate English',emoji: '🇬🇧', category: 'language' },
  { id: 'latin',               name: 'Latin',               emoji: '🏛️', category: 'language' },
  { id: 'catalan',             name: 'Catalan',             emoji: '🏴', category: 'language' },
  { id: 'esperanto',           name: 'Esperanto',           emoji: '🌍', category: 'language' },
  { id: 'haitian-creole',      name: 'Haitian Creole',      emoji: '🇭🇹', category: 'language' },
  { id: 'hawaiian',            name: 'Hawaiian',            emoji: '🌺', category: 'language' },
  { id: 'navajo',              name: 'Navajo',              emoji: '🪶', category: 'language' },
  { id: 'scottish-gaelic',     name: 'Scottish Gaelic',     emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', category: 'language' },
  { id: 'yiddish',             name: 'Yiddish',             emoji: '✡️', category: 'language' },
  { id: 'zulu',                name: 'Zulu',                emoji: '🇿🇦', category: 'language' },
  { id: 'high-valyrian',       name: 'High Valyrian',       emoji: '🐉', category: 'language' },
  { id: 'klingon',             name: 'Klingon',             emoji: '🖖', category: 'language' },
  // Other subjects
  { id: 'chess',               name: 'Chess',               emoji: '♟️', category: 'other' },
  { id: 'math',                name: 'Math',                emoji: '➕', category: 'other' },
  { id: 'music',               name: 'Music',               emoji: '🎵', category: 'other' },
];

export const DEFAULT_COURSE_LIMIT = 5;

export function normalizeCourseId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .replace(/-+/g, '-');
  const match = DUOLINGO_COURSES.find(
    (c) => c.id === clean || c.name.toLowerCase() === input.trim().toLowerCase()
  );
  return match ? match.id : null;
}

export function getCourseById(id: string): DuolingoCourse | undefined {
  return DUOLINGO_COURSES.find((c) => c.id === id);
}

export function isDuolingoName(name?: string | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return n.includes('duolingo') || n.includes('duo lingo') || n.includes('duo-lingo');
}

// ─── Storage Layer (mirrors linkedInGameService pattern) ─────────────────────

export interface CourseCompletionItem {
  completionDate: string;
  completedAt: string;
  studyNote?: string | null;
}

export interface CourseFreezeItem {
  protectedDate: string;
  usedAt: string;
}

export interface StoredCourseRecord {
  groupId: string;
  userId: string;
  courseId: string;
  isCommitted: boolean;
  manualCurrentStreak?: number | null;
  manualLongestStreak?: number | null;
  completions: CourseCompletionItem[];
  freezeLogs: CourseFreezeItem[];
  updatedAt: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'duolingo_courses.json');

let coursesCache: Record<string, StoredCourseRecord> | null = null;
let isDbTableInitialized = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getRecordKey(groupId: string, userId: string, courseId: string): string {
  return `${groupId}:${userId}:${courseId}`;
}

function loadAllRecords(): Record<string, StoredCourseRecord> {
  if (coursesCache !== null) return coursesCache;
  try {
    ensureDataDir();
    if (!fs.existsSync(STORAGE_FILE)) {
      coursesCache = {};
      return coursesCache;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    coursesCache = JSON.parse(raw) || {};
    return coursesCache!;
  } catch {
    coursesCache = {};
    return coursesCache;
  }
}

function saveAllRecords(records: Record<string, StoredCourseRecord>) {
  coursesCache = records;
  try {
    ensureDataDir();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch { /* silent */ }
}

// ─── Database Backing Table ──────────────────────────────────────────────────

export async function initDuolingoDatabaseTable() {
  if (isDbTableInitialized) return;
  isDbTableInitialized = true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "duolingo_course_records" (
        "id" VARCHAR(200) PRIMARY KEY,
        "group_id" VARCHAR(100) NOT NULL,
        "user_id" VARCHAR(100) NOT NULL,
        "course_id" VARCHAR(100) NOT NULL,
        "manual_current_streak" INT,
        "manual_longest_streak" INT,
        "data" JSONB NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_duolingo_course_records_group" ON "duolingo_course_records" ("group_id", "course_id")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_duolingo_course_records_user" ON "duolingo_course_records" ("user_id")
    `);
  } catch { /* failover to file store */ }
}

const loadedMembers = new Set<string>();

export async function ensureMemberRecordsLoaded(groupId: string, userId: string, force = false): Promise<void> {
  const memberKey = `${groupId}:${userId}`;
  if (!force && loadedMembers.has(memberKey)) return;
  loadedMembers.add(memberKey);
  try {
    await initDuolingoDatabaseTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "data", "manual_current_streak", "manual_longest_streak"
       FROM "duolingo_course_records"
       WHERE "group_id" = $1 AND "user_id" = $2`,
      groupId,
      userId
    );
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const records = loadAllRecords();
      for (const row of rows) {
        if (row?.data) {
          const rec = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          const key = row.id || getRecordKey(groupId, userId, rec.courseId);
          if (row.manual_current_streak != null) rec.manualCurrentStreak = row.manual_current_streak;
          if (row.manual_longest_streak != null) rec.manualLongestStreak = row.manual_longest_streak;
          records[key] = rec;
        }
      }
      saveAllRecords(records);
    }
  } catch { /* failover */ }
}

async function syncRecordToDb(record: StoredCourseRecord): Promise<void> {
  try {
    await initDuolingoDatabaseTable();
    const id = getRecordKey(record.groupId, record.userId, record.courseId);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "duolingo_course_records" ("id", "group_id", "user_id", "course_id", "manual_current_streak", "manual_longest_streak", "data", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
       ON CONFLICT ("id") DO UPDATE
       SET "manual_current_streak" = EXCLUDED."manual_current_streak",
           "manual_longest_streak" = EXCLUDED."manual_longest_streak",
           "data" = EXCLUDED."data",
           "updated_at" = NOW()`,
      id,
      record.groupId,
      record.userId,
      record.courseId,
      record.manualCurrentStreak ?? null,
      record.manualLongestStreak ?? null,
      JSON.stringify(record)
    );
  } catch { /* silent failover */ }
}

// ─── Core Record Access ──────────────────────────────────────────────────────

export function getRawCourseRecord(groupId: string, userId: string, courseId: string): StoredCourseRecord {
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, courseId);
  if (!records[key]) {
    records[key] = {
      groupId,
      userId,
      courseId,
      isCommitted: false, // Duolingo: NOT committed by default; users must opt-in
      manualCurrentStreak: null,
      manualLongestStreak: null,
      completions: [],
      freezeLogs: [],
      updatedAt: new Date().toISOString(),
    };
    saveAllRecords(records);
  }
  return records[key];
}

// ─── Computed Course Data ────────────────────────────────────────────────────

export interface ComputedCourseData {
  courseId: string;
  name: string;
  emoji: string;
  category: 'language' | 'other';
  isCommitted: boolean;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  todayNote: string | null;
  freezeBalance: number;
  freezeRechargeDays: number;
  totalCompletions: number;
  lastCompletedDate: string | null;
  completionsHistory: CourseCompletionItem[];
}

export function computeCourseDataForUser(
  record: StoredCourseRecord,
  userTimezone: string = DEFAULT_TIMEZONE
): ComputedCourseData {
  const meta = DUOLINGO_COURSES.find((c) => c.id === record.courseId) || {
    id: record.courseId,
    name: record.courseId,
    emoji: '📚',
    category: 'other' as const,
  };

  const todayStr = getTodayInTimezone(userTimezone);
  const completionDates = record.completions.map((c) => c.completionDate);
  const protectedDates = record.freezeLogs.map((f) => f.protectedDate);

  const streakResult = calculateStreakAndFreezes(
    completionDates,
    protectedDates,
    userTimezone,
    undefined,
    [0, 1, 2, 3, 4, 5, 6], // daily
    1
  );

  const completedToday = completionDates.includes(todayStr);
  const todayItem = record.completions.find((c) => c.completionDate === todayStr);

  const currentStreak =
    typeof record.manualCurrentStreak === 'number'
      ? record.manualCurrentStreak
      : streakResult.currentStreak;

  const longestStreak =
    typeof record.manualLongestStreak === 'number'
      ? Math.max(record.manualLongestStreak, currentStreak)
      : Math.min(
          Math.max(streakResult.longestStreak, currentStreak),
          Math.max(record.completions.length, currentStreak)
        );

  const sortedCompletions = [...record.completions].sort((a, b) =>
    b.completionDate.localeCompare(a.completionDate)
  );

  return {
    courseId: record.courseId,
    name: meta.name,
    emoji: meta.emoji,
    category: meta.category,
    isCommitted: record.isCommitted === true,
    currentStreak,
    longestStreak,
    completedToday,
    todayNote: todayItem?.studyNote || null,
    freezeBalance: streakResult.freezeBalance,
    freezeRechargeDays: streakResult.freezeRechargeDays,
    totalCompletions: record.completions.length,
    lastCompletedDate: streakResult.lastCompletedDate,
    completionsHistory: sortedCompletions.slice(0, 30),
  };
}

// ─── Leaderboard Cache ───────────────────────────────────────────────────────

interface CachedLeaderboard {
  timestamp: number;
  data: CourseLeaderboardEntry[];
}
const leaderboardCache = new Map<string, CachedLeaderboard>();
const LEADERBOARD_CACHE_TTL_MS = 15000;

export function invalidateCourseLeaderboardCache(groupId?: string, courseId?: string) {
  if (!groupId) { leaderboardCache.clear(); return; }
  if (!courseId) {
    for (const key of leaderboardCache.keys()) {
      if (key.startsWith(`${groupId}:`)) leaderboardCache.delete(key);
    }
    return;
  }
  leaderboardCache.delete(`${groupId}:${courseId}`);
}

export interface CourseLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  profileImage: string | null;
  role: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completedToday: boolean;
  todayNote: string | null;
  lastCompletedDate: string | null;
}

/**
 * Returns leaderboard for a specific Duolingo course.
 * Only includes members who are committed to that course.
 */
export async function getCourseLeaderboard(
  groupId: string,
  courseId: string
): Promise<CourseLeaderboardEntry[]> {
  const cacheKey = `${groupId}:${courseId}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
    return cached.data;
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: { id: true, name: true, username: true, profileImage: true, timezone: true },
      },
    },
  });

  // Ensure member records are loaded from database table into memory
  await Promise.all(members.map((m) => ensureMemberRecordsLoaded(groupId, m.userId)));

  const entries: Omit<CourseLeaderboardEntry, 'rank'>[] = [];

  for (const m of members) {
    const raw = getRawCourseRecord(groupId, m.userId, courseId);
    if (!raw.isCommitted) continue; // only show committed members
    const computed = computeCourseDataForUser(raw, m.user.timezone || DEFAULT_TIMEZONE);
    entries.push({
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
    });
  }

  entries.sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
    if (b.totalCompletions !== a.totalCompletions) return b.totalCompletions - a.totalCompletions;
    return a.name.localeCompare(b.name);
  });

  let currentRank = 1;
  const ranked: CourseLeaderboardEntry[] = entries.map((entry, index) => {
    if (index > 0) {
      const prev = entries[index - 1];
      if (
        entry.currentStreak !== prev.currentStreak ||
        entry.longestStreak !== prev.longestStreak ||
        entry.totalCompletions !== prev.totalCompletions
      ) {
        currentRank = index + 1;
      }
    }
    return { ...entry, rank: currentRank };
  });

  leaderboardCache.set(cacheKey, { timestamp: Date.now(), data: ranked });
  return ranked;
}

// ─── Member Course Management ────────────────────────────────────────────────

/**
 * Get all 45 courses for a member (only committed ones shown by default on hub)
 */
export async function getAllCoursesForMember(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<ComputedCourseData[]> {
  await ensureMemberRecordsLoaded(groupId, userId);
  return DUOLINGO_COURSES.map((course) => {
    const raw = getRawCourseRecord(groupId, userId, course.id);
    return computeCourseDataForUser(raw, userTimezone);
  });
}

/**
 * Get only committed courses for a member
 */
export async function getCommittedCoursesForMember(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<ComputedCourseData[]> {
  const all = await getAllCoursesForMember(groupId, userId, userTimezone);
  return all.filter((c) => c.isCommitted);
}

/**
 * Commit a user to a course. Enforces the per-user limit.
 * Returns { success, error?, data? }
 */
export async function commitToCourse(
  groupId: string,
  userId: string,
  courseId: string,
  courseLimit: number = DEFAULT_COURSE_LIMIT,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<{ success: boolean; error?: string; data?: ComputedCourseData }> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) return { success: false, error: `Unknown Duolingo course: ${courseId}` };

  await ensureMemberRecordsLoaded(groupId, userId);

  const all = await getAllCoursesForMember(groupId, userId, userTimezone);
  const committedCount = all.filter((c) => c.isCommitted).length;
  const isAlreadyCommitted = all.find((c) => c.courseId === normalized)?.isCommitted;

  if (!isAlreadyCommitted && committedCount >= courseLimit) {
    return {
      success: false,
      error: `You can commit to at most ${courseLimit} course${courseLimit === 1 ? '' : 's'}.`,
    };
  }

  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);
  record.isCommitted = true;
  record.updatedAt = new Date().toISOString();
  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);

  return { success: true, data: computeCourseDataForUser(record, userTimezone) };
}

/**
 * Uncommit a user from a course. History is preserved.
 */
export async function uncommitFromCourse(
  groupId: string,
  userId: string,
  courseId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<{ success: boolean; error?: string; data?: ComputedCourseData }> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) return { success: false, error: `Unknown Duolingo course: ${courseId}` };

  await ensureMemberRecordsLoaded(groupId, userId);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);
  record.isCommitted = false;
  record.updatedAt = new Date().toISOString();
  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);

  return { success: true, data: computeCourseDataForUser(record, userTimezone) };
}

// ─── Completion Logic ────────────────────────────────────────────────────────

/**
 * Complete a single Duolingo course for today.
 * studyNote is attached if provided (used for the last course).
 */
export async function completeCourse(
  groupId: string,
  userId: string,
  courseId: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  studyNote?: string | null,
  completionDate?: string
): Promise<ComputedCourseData> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) throw new Error(`Unknown Duolingo course: ${courseId}`);

  await ensureMemberRecordsLoaded(groupId, userId);
  const targetDate = completionDate || getTodayInTimezone(userTimezone);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);

  const existingIdx = record.completions.findIndex((c) => c.completionDate === targetDate);
  if (existingIdx >= 0) {
    if (studyNote !== undefined) record.completions[existingIdx].studyNote = studyNote;
  } else {
    record.completions.push({
      completionDate: targetDate,
      completedAt: new Date().toISOString(),
      studyNote: studyNote || null,
    });
    if (typeof record.manualCurrentStreak === 'number') {
      record.manualCurrentStreak = record.manualCurrentStreak + 1;
    }
  }

  const computed = computeCourseDataForUser(record, userTimezone);
  record.manualLongestStreak = Math.max(record.manualLongestStreak || 0, computed.longestStreak);
  record.updatedAt = new Date().toISOString();

  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);
  invalidateCourseLeaderboardCache(groupId, normalized);

  return computeCourseDataForUser(record, userTimezone);
}

/**
 * Uncomplete a single Duolingo course for today.
 */
export async function uncompleteCourse(
  groupId: string,
  userId: string,
  courseId: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  completionDate?: string
): Promise<ComputedCourseData> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) throw new Error(`Unknown Duolingo course: ${courseId}`);

  await ensureMemberRecordsLoaded(groupId, userId);
  const targetDate = completionDate || getTodayInTimezone(userTimezone);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);

  const prevComputed = computeCourseDataForUser(record, userTimezone);
  const hadCompletion = record.completions.some((c) => c.completionDate === targetDate);
  record.completions = record.completions.filter((c) => c.completionDate !== targetDate);

  record.manualLongestStreak = Math.max(record.manualLongestStreak || 0, prevComputed.longestStreak);
  if (typeof record.manualCurrentStreak === 'number') {
    record.manualCurrentStreak = hadCompletion
      ? Math.max(0, record.manualCurrentStreak - 1)
      : record.manualCurrentStreak;
  }
  record.updatedAt = new Date().toISOString();

  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);
  invalidateCourseLeaderboardCache(groupId, normalized);

  return computeCourseDataForUser(record, userTimezone);
}

/**
 * Complete ALL committed courses for dashboard tick.
 */
export async function completeAllCommittedCourses(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  studyNote?: string | null,
  completionDate?: string
): Promise<{ newlyCompleted: number; alreadyCompleted: number; totalCommitted: number }> {
  const todayDate = completionDate || getTodayInTimezone(userTimezone);
  const courses = await getAllCoursesForMember(groupId, userId, userTimezone);
  const committed = courses.filter((c) => c.isCommitted);
  const records = loadAllRecords();
  const recordsToSync: StoredCourseRecord[] = [];

  let newlyCompleted = 0;
  let alreadyCompleted = 0;

  for (const course of committed) {
    const key = getRecordKey(groupId, userId, course.courseId);
    const raw = getRawCourseRecord(groupId, userId, course.courseId);
    const isDone = raw.completions.some((c) => c.completionDate === todayDate);
    if (isDone) {
      alreadyCompleted++;
    } else {
      raw.completions.push({
        completionDate: todayDate,
        completedAt: new Date().toISOString(),
        studyNote: studyNote || null,
      });
      if (typeof raw.manualCurrentStreak === 'number') {
        raw.manualCurrentStreak = raw.manualCurrentStreak + 1;
      }
      const computed = computeCourseDataForUser(raw, userTimezone);
      raw.manualLongestStreak = Math.max(raw.manualLongestStreak || 0, computed.longestStreak);
      raw.updatedAt = new Date().toISOString();
      records[key] = raw;
      recordsToSync.push(raw);
      newlyCompleted++;
    }
  }

  saveAllRecords(records);
  if (recordsToSync.length > 0) {
    await Promise.all(recordsToSync.map((rec) => syncRecordToDb(rec)));
    invalidateCourseLeaderboardCache(groupId);
  }

  return { newlyCompleted, alreadyCompleted, totalCommitted: committed.length };
}

/**
 * Uncomplete ALL committed courses (dashboard untick).
 */
export async function uncompleteAllCommittedCourses(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE,
  completionDate?: string
): Promise<void> {
  const targetDate = completionDate || getTodayInTimezone(userTimezone);
  const courses = await getAllCoursesForMember(groupId, userId, userTimezone);
  const committed = courses.filter((c) => c.isCommitted);
  const records = loadAllRecords();
  const recordsToSync: StoredCourseRecord[] = [];

  for (const course of committed) {
    const key = getRecordKey(groupId, userId, course.courseId);
    const raw = getRawCourseRecord(groupId, userId, course.courseId);
    const hadCompletion = raw.completions.some((c) => c.completionDate === targetDate);
    raw.completions = raw.completions.filter((c) => c.completionDate !== targetDate);
    raw.manualLongestStreak = Math.max(
      raw.manualLongestStreak || 0,
      course.longestStreak || 0,
      raw.manualCurrentStreak || 0
    );
    if (typeof raw.manualCurrentStreak === 'number') {
      raw.manualCurrentStreak = hadCompletion
        ? Math.max(0, raw.manualCurrentStreak - 1)
        : raw.manualCurrentStreak;
    }
    raw.updatedAt = new Date().toISOString();
    records[key] = raw;
    recordsToSync.push(raw);
  }

  saveAllRecords(records);
  if (recordsToSync.length > 0) {
    await Promise.all(recordsToSync.map((rec) => syncRecordToDb(rec)));
    invalidateCourseLeaderboardCache(groupId);
  }
}

// ─── Dashboard Streak Aggregate ──────────────────────────────────────────────

/**
 * Overall Duolingo streak = MAX current streak among committed courses.
 * completedToday = ALL committed courses completed today.
 */
export async function getDuolingoDashboardStreak(
  groupId: string,
  userId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<{
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  committedCount: number;
  totalCourses: number;
  coursesCompletedToday: number;
}> {
  const courses = await getAllCoursesForMember(groupId, userId, userTimezone);
  const committed = courses.filter((c) => c.isCommitted);

  const currentStreak = committed.length > 0
    ? Math.max(0, ...committed.map((c) => c.currentStreak))
    : 0;
  const longestStreak = committed.length > 0
    ? Math.max(0, ...committed.map((c) => c.longestStreak))
    : 0;
  const completedToday = committed.length > 0 && committed.every((c) => c.completedToday);
  const coursesCompletedToday = committed.filter((c) => c.completedToday).length;

  return {
    currentStreak,
    longestStreak,
    completedToday,
    committedCount: committed.length,
    totalCourses: DUOLINGO_COURSES.length,
    coursesCompletedToday,
  };
}

// ─── Admin Functions ─────────────────────────────────────────────────────────

export async function adminCorrectCourseStreak(
  groupId: string,
  userId: string,
  courseId: string,
  currentStreak: number,
  longestStreak: number
): Promise<ComputedCourseData> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) throw new Error(`Unknown Duolingo course: ${courseId}`);

  await ensureMemberRecordsLoaded(groupId, userId);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);

  record.manualCurrentStreak = currentStreak;
  record.manualLongestStreak = Math.max(longestStreak, currentStreak);
  record.updatedAt = new Date().toISOString();

  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);
  invalidateCourseLeaderboardCache(groupId, normalized);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }).catch(() => null);
  return computeCourseDataForUser(record, user?.timezone || DEFAULT_TIMEZONE);
}

export async function adminGrantCourseDate(
  groupId: string,
  userId: string,
  courseId: string,
  date: string,
  studyNote?: string
): Promise<ComputedCourseData> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) throw new Error(`Unknown Duolingo course: ${courseId}`);

  await ensureMemberRecordsLoaded(groupId, userId);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);

  const existingIdx = record.completions.findIndex((c) => c.completionDate === date);
  if (existingIdx >= 0) {
    record.completions[existingIdx].studyNote = studyNote || record.completions[existingIdx].studyNote;
  } else {
    record.completions.push({
      completionDate: date,
      completedAt: new Date().toISOString(),
      studyNote: studyNote || 'Retroactively granted by admin',
    });
  }
  record.manualCurrentStreak = null;
  record.updatedAt = new Date().toISOString();

  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);
  invalidateCourseLeaderboardCache(groupId, normalized);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }).catch(() => null);
  return computeCourseDataForUser(record, user?.timezone || DEFAULT_TIMEZONE);
}

/**
 * Force-commit a user to a course regardless of limit (admin override)
 */
export async function adminForceCommitCourse(
  groupId: string,
  userId: string,
  courseId: string
): Promise<{ success: boolean; error?: string; data?: ComputedCourseData }> {
  const normalized = normalizeCourseId(courseId);
  if (!normalized) return { success: false, error: `Unknown Duolingo course: ${courseId}` };

  await ensureMemberRecordsLoaded(groupId, userId);
  const records = loadAllRecords();
  const key = getRecordKey(groupId, userId, normalized);
  const record = getRawCourseRecord(groupId, userId, normalized);
  record.isCommitted = true;
  record.updatedAt = new Date().toISOString();
  records[key] = record;
  saveAllRecords(records);
  await syncRecordToDb(record);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }).catch(() => null);
  return { success: true, data: computeCourseDataForUser(record, user?.timezone || DEFAULT_TIMEZONE) };
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Migrates existing groups with 'duolingo' in the name (case-insensitive)
 * to specialPlatform = 'DUOLINGO'. Idempotent.
 */
export async function migrateDuolingoGroups(): Promise<{ migrated: number; already: number }> {
  try {
    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { name: { contains: 'duolingo', mode: 'insensitive' } },
          { name: { contains: 'duo lingo', mode: 'insensitive' } },
        ],
      },
    });

    let migrated = 0;
    let already = 0;

    for (const g of groups) {
      if (g.isSpecialGroup && g.specialPlatform === 'DUOLINGO') {
        already++;
        continue;
      }
      await prisma.group.update({
        where: { id: g.id },
        data: { isSpecialGroup: true, specialPlatform: 'DUOLINGO' },
      });
      migrated++;
    }

    return { migrated, already };
  } catch (err) {
    console.error('[migrateDuolingoGroups] Error:', err);
    return { migrated: 0, already: 0 };
  }
}
