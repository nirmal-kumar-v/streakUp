import { describe, it, expect, beforeEach } from 'vitest';
import {
  LINKEDIN_GAMES,
  normalizeGameId,
  isLinkedInName,
  completeMemberGame,
  getSingleGameForMember,
  getAllGamesForMember,
  getGameLeaderboard,
  adminCorrectGameStreak,
  adminGrantGameDate,
  adminFreezeGameDate,
} from '../src/services/linkedInGameService';

describe('LinkedIn Group Games & Independent Streaks', () => {
  const testGroupId = `group-linkedin-test-${Date.now()}`;
  const user1 = 'user-alice-101';
  const user2 = 'user-bob-102';
  const timezone = 'Asia/Kolkata';

  it('1. Recognizes exactly the 8 specified LinkedIn games', () => {
    expect(LINKEDIN_GAMES).toHaveLength(8);
    const gameIds = LINKEDIN_GAMES.map((g) => g.id);
    expect(gameIds).toEqual([
      'pinpoint',
      'crossclimb',
      'queens',
      'tango',
      'zip',
      'mini-sudoku',
      'patches',
      'wend',
    ]);
  });

  it('2. Robust case-insensitive game ID and name normalization', () => {
    expect(normalizeGameId('Pinpoint')).toBe('pinpoint');
    expect(normalizeGameId('crossclimb')).toBe('crossclimb');
    expect(normalizeGameId('Queens')).toBe('queens');
    expect(normalizeGameId('TANGO')).toBe('tango');
    expect(normalizeGameId('zip')).toBe('zip');
    expect(normalizeGameId('Mini Sudoku')).toBe('mini-sudoku');
    expect(normalizeGameId('minisudoku')).toBe('mini-sudoku');
    expect(normalizeGameId('mini_sudoku')).toBe('mini-sudoku');
    expect(normalizeGameId('Patches')).toBe('patches');
    expect(normalizeGameId('WEND')).toBe('wend');
    expect(normalizeGameId('invalid-game')).toBeNull();
  });

  it('3. Robust group name matching for LinkedIn with case variations', () => {
    expect(isLinkedInName('LinkedIn')).toBe(true);
    expect(isLinkedInName('linkedin')).toBe(true);
    expect(isLinkedInName('LINKEDIN')).toBe(true);
    expect(isLinkedInName('Linked-In')).toBe(true);
    expect(isLinkedInName('Linked_In')).toBe(true);
    expect(isLinkedInName('  LinkedIn  ')).toBe(true);
    expect(isLinkedInName('GATE Prep')).toBe(false);
    expect(isLinkedInName('workout')).toBe(false);
    expect(isLinkedInName(null)).toBe(false);
  });

  it('4. Completes Pinpoint independently without affecting Crossclimb or other games', async () => {
    // Initial state: both games have 0 streak
    const pinpointInitial = await getSingleGameForMember(testGroupId, user1, 'pinpoint', timezone);
    const crossclimbInitial = await getSingleGameForMember(testGroupId, user1, 'crossclimb', timezone);

    expect(pinpointInitial?.currentStreak).toBe(0);
    expect(crossclimbInitial?.currentStreak).toBe(0);

    // Complete Pinpoint today
    const pinpointUpdated = await completeMemberGame(
      testGroupId,
      user1,
      'pinpoint',
      timezone,
      undefined,
      'Solved clue in 2 hints!'
    );

    expect(pinpointUpdated.completedToday).toBe(true);
    expect(pinpointUpdated.currentStreak).toBe(1);
    expect(pinpointUpdated.todayNote).toBe('Solved clue in 2 hints!');

    // Crossclimb MUST remain untouched!
    const crossclimbCheck = await getSingleGameForMember(testGroupId, user1, 'crossclimb', timezone);
    expect(crossclimbCheck?.completedToday).toBe(false);
    expect(crossclimbCheck?.currentStreak).toBe(0);
    expect(crossclimbCheck?.totalCompletions).toBe(0);

    // Queens, Tango, Zip, Mini Sudoku, Patches, Wend must also remain 0
    const allGames = await getAllGamesForMember(testGroupId, user1, timezone);
    const completedGames = allGames.filter((g) => g.completedToday);
    expect(completedGames).toHaveLength(1);
    expect(completedGames[0].gameId).toBe('pinpoint');
  });

  it('5. Sequential multi-day completions build independent streak and historical records', async () => {
    // Complete Queens on 3 consecutive dates: 2026-10-17, 2026-10-18, 2026-10-19
    await completeMemberGame(testGroupId, user2, 'queens', timezone, '2026-10-17', 'Row 1 crown');
    await completeMemberGame(testGroupId, user2, 'queens', timezone, '2026-10-18', 'Row 2 crown');
    const queensDay3 = await completeMemberGame(testGroupId, user2, 'queens', timezone, '2026-10-19', 'Row 3 crown');

    expect(queensDay3.currentStreak).toBe(3);
    expect(queensDay3.longestStreak).toBe(3);
    expect(queensDay3.totalCompletions).toBe(3);
    expect(queensDay3.completionsHistory).toHaveLength(3);

    // Verify Tango on user2 is still 0
    const tangoUser2 = await getSingleGameForMember(testGroupId, user2, 'tango', timezone);
    expect(tangoUser2?.currentStreak).toBe(0);
  });

  it('6. Super Admin can adjust streak, grant historical date, and manage freeze for a specific game', async () => {
    // Admin corrects Zip game streak
    const correctedZip = await adminCorrectGameStreak(testGroupId, user1, 'zip', 14, 20);
    expect(correctedZip.currentStreak).toBe(14);
    expect(correctedZip.longestStreak).toBe(20);

    // Admin grants Wend date
    const grantedWend = await adminGrantGameDate(testGroupId, user1, 'wend', '2026-10-15', 'Verified word ladder');
    expect(grantedWend.totalCompletions).toBeGreaterThanOrEqual(1);
    expect(grantedWend.completionsHistory.some((c) => c.completionDate === '2026-10-15')).toBe(true);

    // Admin applies freeze date to Patches
    const frozenPatches = await adminFreezeGameDate(testGroupId, user1, 'patches', '2026-10-16', true);
    expect(frozenPatches.freezeLogs.some((f) => f.protectedDate === '2026-10-16')).toBe(true);

    // Admin removes freeze date from Patches
    const unfrozenPatches = await adminFreezeGameDate(testGroupId, user1, 'patches', '2026-10-16', false);
    expect(unfrozenPatches.freezeLogs.some((f) => f.protectedDate === '2026-10-16')).toBe(false);
  });
});
