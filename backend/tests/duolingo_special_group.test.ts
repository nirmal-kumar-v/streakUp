import { describe, it, expect } from 'vitest';
import {
  DUOLINGO_COURSES,
  normalizeCourseId,
  isDuolingoName,
  getAllCoursesForMember,
  getCommittedCoursesForMember,
  commitToCourse,
  uncommitFromCourse,
  completeCourse,
  uncompleteCourse,
  completeAllCommittedCourses,
  uncompleteAllCommittedCourses,
  getDuolingoDashboardStreak,
  adminCorrectCourseStreak,
  adminGrantCourseDate,
  adminForceCommitCourse,
  migrateDuolingoGroups,
} from '../src/services/duolingoService';
import {
  getUserDuolingoCourseLimit,
  setUserDuolingoCourseLimit,
} from '../src/services/adminConfigService';

describe('Duolingo Special Group System', () => {
  const testGroupId = `group-duolingo-test-${Date.now()}`;
  const user1 = `user-duo-1-${Date.now()}`;
  const user2 = `user-duo-2-${Date.now()}`;
  const timezone = 'Asia/Kolkata';

  it('1. Recognizes exactly the 45 specified Duolingo courses', () => {
    expect(DUOLINGO_COURSES).toHaveLength(45);
    const names = DUOLINGO_COURSES.map((c) => c.name);

    // Verify key courses from the user's list
    expect(names).toContain('Chess');
    expect(names).toContain('Math');
    expect(names).toContain('Music');
    expect(names).toContain('English');
    expect(names).toContain('Spanish');
    expect(names).toContain('French');
    expect(names).toContain('Japanese');
    expect(names).toContain('German');
    expect(names).toContain('Korean');
    expect(names).toContain('Italian');
    expect(names).toContain('Chinese (Mandarin)');
    expect(names).toContain('Portuguese');
    expect(names).toContain('Hindi');
    expect(names).toContain('Russian');
    expect(names).toContain('Arabic');
    expect(names).toContain('Turkish');
    expect(names).toContain('Dutch');
    expect(names).toContain('Swedish');
    expect(names).toContain('Polish');
    expect(names).toContain('Ukrainian');
    expect(names).toContain('Vietnamese');
    expect(names).toContain('Indonesian');
    expect(names).toContain('Irish');
    expect(names).toContain('Greek');
    expect(names).toContain('Norwegian');
    expect(names).toContain('Hebrew');
    expect(names).toContain('Czech');
    expect(names).toContain('Danish');
    expect(names).toContain('Finnish');
    expect(names).toContain('Hungarian');
    expect(names).toContain('Romanian');
    expect(names).toContain('Swahili');
    expect(names).toContain('Welsh');
    expect(names).toContain('Intermediate English');
    expect(names).toContain('Latin');
    expect(names).toContain('Catalan');
    expect(names).toContain('Esperanto');
    expect(names).toContain('Haitian Creole');
    expect(names).toContain('Hawaiian');
    expect(names).toContain('Navajo');
    expect(names).toContain('Scottish Gaelic');
    expect(names).toContain('Yiddish');
    expect(names).toContain('Zulu');
    expect(names).toContain('High Valyrian');
    expect(names).toContain('Klingon');
  });

  it('2. Robust course name and slug normalization', () => {
    expect(normalizeCourseId('Spanish')).toBe('spanish');
    expect(normalizeCourseId('spanish')).toBe('spanish');
    expect(normalizeCourseId('SPANISH')).toBe('spanish');
    expect(normalizeCourseId('Chinese (Mandarin)')).toBe('chinese-mandarin');
    expect(normalizeCourseId('chinese-mandarin')).toBe('chinese-mandarin');
    expect(normalizeCourseId('High Valyrian')).toBe('high-valyrian');
    expect(normalizeCourseId('Chess')).toBe('chess');
    expect(normalizeCourseId('Math')).toBe('math');
    expect(normalizeCourseId('Music')).toBe('music');
    expect(normalizeCourseId('NonExistentCourse')).toBeNull();
  });

  it('3. Robust group name matching for Duolingo (case-insensitive)', () => {
    expect(isDuolingoName('Duolingo')).toBe(true);
    expect(isDuolingoName('duolingo')).toBe(true);
    expect(isDuolingoName('DUOLINGO')).toBe(true);
    expect(isDuolingoName('Daily Duolingo Squad')).toBe(true);
    expect(isDuolingoName('duolingo-learners')).toBe(true);
    expect(isDuolingoName('LeetCode Group')).toBe(false);
    expect(isDuolingoName('Chess Club')).toBe(false);
    expect(isDuolingoName(null)).toBe(false);
  });

  it('4. Enforces default limit of 5 committed courses per user', async () => {
    // Commit to 5 courses
    const c1 = await commitToCourse(testGroupId, user1, 'spanish', 5, timezone);
    expect(c1.success).toBe(true);
    expect(c1.data?.isCommitted).toBe(true);

    const c2 = await commitToCourse(testGroupId, user1, 'french', 5, timezone);
    expect(c2.success).toBe(true);

    const c3 = await commitToCourse(testGroupId, user1, 'japanese', 5, timezone);
    expect(c3.success).toBe(true);

    const c4 = await commitToCourse(testGroupId, user1, 'german', 5, timezone);
    expect(c4.success).toBe(true);

    const c5 = await commitToCourse(testGroupId, user1, 'chess', 5, timezone);
    expect(c5.success).toBe(true);

    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    expect(committed).toHaveLength(5);

    // 6th commit MUST fail with quota error
    const c6 = await commitToCourse(testGroupId, user1, 'korean', 5, timezone);
    expect(c6.success).toBe(false);
    expect(c6.error).toMatch(/at most 5/);
  });

  it('5. Admin can increase course limit beyond 5, allowing more courses', async () => {
    // Increase limit to 8 for user1
    setUserDuolingoCourseLimit(user1, 8);
    expect(getUserDuolingoCourseLimit(user1)).toBe(8);

    // Now 6th and 7th commit succeed!
    const c6 = await commitToCourse(testGroupId, user1, 'korean', 8, timezone);
    expect(c6.success).toBe(true);

    const c7 = await commitToCourse(testGroupId, user1, 'math', 8, timezone);
    expect(c7.success).toBe(true);

    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    expect(committed).toHaveLength(7);
  });

  it('6. Uncommitting a course reduces count and allows committing another', async () => {
    // Uncommit 'chess'
    const uncommitRes = await uncommitFromCourse(testGroupId, user1, 'chess', timezone);
    expect(uncommitRes.success).toBe(true);
    expect(uncommitRes.data?.isCommitted).toBe(false);

    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    expect(committed.find((c) => c.courseId === 'chess')).toBeUndefined();
    expect(committed).toHaveLength(6);
  });

  it('7. Independent streaks per course: Spanish completed does not complete French or Japanese', async () => {
    // Complete Spanish today
    const res = await completeCourse(testGroupId, user1, 'spanish', timezone, 'Learned food vocabulary');
    expect(res.completedToday).toBe(true);
    expect(res.currentStreak).toBe(1);
    expect(res.todayNote).toBe('Learned food vocabulary');

    // French and Japanese MUST remain uncompleted with streak 0
    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    const french = committed.find((c) => c.courseId === 'french');
    const japanese = committed.find((c) => c.courseId === 'japanese');

    expect(french?.completedToday).toBe(false);
    expect(french?.currentStreak).toBe(0);
    expect(japanese?.completedToday).toBe(false);
    expect(japanese?.currentStreak).toBe(0);
  });

  it('8. Overall Duolingo streak aggregate equals MAX of committed course streaks', async () => {
    // Admin corrects French streak to 15 and German to 8
    await adminCorrectCourseStreak(testGroupId, user1, 'french', 15, 20);
    await adminCorrectCourseStreak(testGroupId, user1, 'german', 8, 10);

    const dash = await getDuolingoDashboardStreak(testGroupId, user1, timezone);
    // Highest current streak is 15 (from French)
    expect(dash.currentStreak).toBe(15);
    // Highest longest streak is 20 (from French)
    expect(dash.longestStreak).toBe(20);
    // Not all completed today yet
    expect(dash.completedToday).toBe(false);
  });

  it('9. "Complete All" completes all committed courses at once', async () => {
    const res = await completeAllCommittedCourses(testGroupId, user1, timezone, 'Daily Duolingo Practice Done');
    expect(res.newlyCompleted).toBeGreaterThan(0);

    const dash = await getDuolingoDashboardStreak(testGroupId, user1, timezone);
    // Now all committed courses are completed today
    expect(dash.completedToday).toBe(true);

    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    for (const c of committed) {
      expect(c.completedToday).toBe(true);
    }
  });

  it('10. "Uncomplete All" unticks all committed courses accurately', async () => {
    await uncompleteAllCommittedCourses(testGroupId, user1, timezone);

    const dash = await getDuolingoDashboardStreak(testGroupId, user1, timezone);
    expect(dash.completedToday).toBe(false);

    const committed = await getCommittedCoursesForMember(testGroupId, user1, timezone);
    for (const c of committed) {
      expect(c.completedToday).toBe(false);
    }
  });

  it('11. Admin can force-commit a user to any course regardless of limit', async () => {
    // Force commit user2 to Klingon
    const forceRes = await adminForceCommitCourse(testGroupId, user2, 'klingon');
    expect(forceRes.success).toBe(true);
    expect(forceRes.data?.courseId).toBe('klingon');
    expect(forceRes.data?.isCommitted).toBe(true);
  });
});

