import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { getTodayInTimezone } from '../src/services/timezoneService';
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
    const d3 = getTodayInTimezone(timezone);
    const d2 = DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const d1 = DateTime.now().setZone(timezone).minus({ days: 2 }).toFormat('yyyy-MM-dd');

    // Complete Queens on 3 consecutive dates: d1, d2, d3
    await completeMemberGame(testGroupId, user2, 'queens', timezone, d1, 'Row 1 crown');
    await completeMemberGame(testGroupId, user2, 'queens', timezone, d2, 'Row 2 crown');
    const queensDay3 = await completeMemberGame(testGroupId, user2, 'queens', timezone, d3, 'Row 3 crown');

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

  it('7. All eight games are committed by default for members', async () => {
    const userCommitTest = `user-commit-${Date.now()}`;
    const allGames = await getAllGamesForMember(testGroupId, userCommitTest, timezone);
    expect(allGames).toHaveLength(8);
    for (const g of allGames) {
      expect(g.isCommitted).toBe(true);
    }
  });

  it('8. Users can individually uncommit and recommit without losing history or resetting streaks', async () => {
    const userToggle = `user-toggle-${Date.now()}`;
    // 1. Complete Tango to earn a streak of 1
    const tangoCompleted = await completeMemberGame(testGroupId, userToggle, 'tango', timezone);
    expect(tangoCompleted.currentStreak).toBe(1);
    expect(tangoCompleted.isCommitted).toBe(true);

    // 2. Uncommit Tango
    const { setGameCommitment } = await import('../src/services/linkedInGameService');
    const tangoUncommitted = await setGameCommitment(testGroupId, userToggle, 'tango', false, timezone);
    expect(tangoUncommitted.isCommitted).toBe(false);
    // History and streak MUST be preserved!
    expect(tangoUncommitted.currentStreak).toBe(1);
    expect(tangoUncommitted.totalCompletions).toBe(1);

    // 3. Recommit Tango
    const tangoRecommitted = await setGameCommitment(testGroupId, userToggle, 'tango', true, timezone);
    expect(tangoRecommitted.isCommitted).toBe(true);
    expect(tangoRecommitted.currentStreak).toBe(1);
    expect(tangoRecommitted.totalCompletions).toBe(1);
  });

  it('9. Dashboard streak represents the highest current streak among committed games only', async () => {
    const userDash = `user-dash-${Date.now()}`;
    const {
      setGameCommitment,
      getLinkedInDashboardStreak,
      completeCommittedGamesForDashboard,
    } = await import('../src/services/linkedInGameService');

    // Initially all 8 games have 0 streak
    const initialDash = await getLinkedInDashboardStreak(testGroupId, userDash, timezone);
    expect(initialDash.currentStreak).toBe(0);
    expect(initialDash.committedCount).toBe(8);

    // Give Queens a streak of 5, Pinpoint a streak of 3
    await adminCorrectGameStreak(testGroupId, userDash, 'queens', 5, 5);
    await adminCorrectGameStreak(testGroupId, userDash, 'pinpoint', 3, 3);

    const dashWithQueens = await getLinkedInDashboardStreak(testGroupId, userDash, timezone);
    expect(dashWithQueens.currentStreak).toBe(5);

    // If user uncommits from Queens, dashboard highest streak falls back to Pinpoint (3)
    await setGameCommitment(testGroupId, userDash, 'queens', false, timezone);
    const dashAfterUncommitQueens = await getLinkedInDashboardStreak(testGroupId, userDash, timezone);
    expect(dashAfterUncommitQueens.currentStreak).toBe(3);

    // If user uncommits from all committed games, dashboard streak is 0
    const allGames = await getAllGamesForMember(testGroupId, userDash, timezone);
    for (const g of allGames) {
      await setGameCommitment(testGroupId, userDash, g.gameId, false, timezone);
    }
    const dashEmpty = await getLinkedInDashboardStreak(testGroupId, userDash, timezone);
    expect(dashEmpty.currentStreak).toBe(0);
    expect(dashEmpty.committedCount).toBe(0);
  });

  it('10. Dashboard tick completes only committed games and does not touch uncommitted games', async () => {
    const userTickTest = `user-tick-${Date.now()}`;
    const {
      setGameCommitment,
      completeCommittedGamesForDashboard,
    } = await import('../src/services/linkedInGameService');

    // Uncommit Tango and Wend
    await setGameCommitment(testGroupId, userTickTest, 'tango', false, timezone);
    await setGameCommitment(testGroupId, userTickTest, 'wend', false, timezone);

    // Perform dashboard tick (completing all committed games)
    const tickResult = await completeCommittedGamesForDashboard(testGroupId, userTickTest, timezone);
    expect(tickResult.totalCommittedCount).toBe(6);
    expect(tickResult.completedGamesCount).toBe(6);

    // Verify committed games (e.g. Pinpoint, Queens) are completed today
    const pinpoint = await getSingleGameForMember(testGroupId, userTickTest, 'pinpoint', timezone);
    expect(pinpoint?.completedToday).toBe(true);

    // Verify uncommitted games (Tango, Wend) were NOT completed
    const tango = await getSingleGameForMember(testGroupId, userTickTest, 'tango', timezone);
    const wend = await getSingleGameForMember(testGroupId, userTickTest, 'wend', timezone);
    expect(tango?.completedToday).toBe(false);
    expect(tango?.totalCompletions).toBe(0);
    expect(wend?.completedToday).toBe(false);
    expect(wend?.totalCompletions).toBe(0);

    // Repeated dashboard tick does not create duplicate completions
    const repeatTick = await completeCommittedGamesForDashboard(testGroupId, userTickTest, timezone);
    expect(repeatTick.newlyCompletedCount ?? repeatTick.completedGamesCount).toBe(0);
    expect(repeatTick.alreadyCompletedCount).toBe(6);
  });

  it('11. Member can uncomplete/un-tick an individual game inside the group hub', async () => {
    const userUntick = `user-untick-${Date.now()}`;
    const {
      completeMemberGame,
      uncompleteMemberGame,
      getSingleGameForMember,
    } = await import('../src/services/linkedInGameService');

    // 1. Complete Queens
    const completed = await completeMemberGame(testGroupId, userUntick, 'queens', timezone);
    expect(completed.completedToday).toBe(true);
    expect(completed.currentStreak).toBe(1);

    // 2. Uncomplete Queens
    const uncompleted = await uncompleteMemberGame(testGroupId, userUntick, 'queens', timezone);
    expect(uncompleted.completedToday).toBe(false);
    expect(uncompleted.currentStreak).toBe(0);

    // 3. Verify single game query confirms uncompleted state
    const fetched = await getSingleGameForMember(testGroupId, userUntick, 'queens', timezone);
    expect(fetched?.completedToday).toBe(false);
    expect(fetched?.currentStreak).toBe(0);
  });
});

