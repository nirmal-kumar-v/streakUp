import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLinkedInGames,
  fetchSingleLinkedInGame,
  completeLinkedInGame,
  uncompleteLinkedInGame,
  updateLinkedInGameCommitment,
  LinkedInGameItem,
  LinkedInGameLeaderboardEntry,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { InitialsAvatar } from './InitialsAvatar';
import {
  Gamepad2,
  Flame,
  Trophy,
  CheckCircle2,
  Calendar,
  Sparkles,
  Snowflake,
  RefreshCw,
  Crown,
  HelpCircle,
  TrendingUp,
  SunMedium,
  Zap,
  Grid3X3,
  Boxes,
  Shuffle,
  Check,
  Plus,
  X,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

interface LinkedInGamesHubProps {
  groupId: string;
  groupName: string;
  initialGameId?: string;
}

const GAME_ICONS: Record<string, React.FC<{ className?: string }>> = {
  pinpoint: HelpCircle,
  crossclimb: TrendingUp,
  queens: Crown,
  tango: SunMedium,
  zip: Zap,
  'mini-sudoku': Grid3X3,
  patches: Boxes,
  wend: Shuffle,
};

export const LinkedInGamesHub: React.FC<LinkedInGamesHubProps> = ({
  groupId,
  groupName,
  initialGameId = 'pinpoint',
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [games, setGames] = useState<LinkedInGameItem[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId);
  const [activeGameData, setActiveGameData] = useState<LinkedInGameItem | null>(null);
  const [leaderboard, setLeaderboard] = useState<LinkedInGameLeaderboardEntry[]>([]);

  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingCommitment, setIsTogglingCommitment] = useState(false);

  const [studyNote, setStudyNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Load summary for all 8 games
  const loadAllGames = useCallback(async () => {
    try {
      const res = await fetchLinkedInGames(groupId);
      if (res.success && res.games) {
        setGames(res.games);
        // Instant warm-up of active game
        const currentActive = res.games.find((g) => g.gameId === selectedGameId) || res.games[0];
        if (currentActive) {
          setActiveGameData((prev) => prev && prev.gameId === currentActive.gameId ? { ...currentActive, ...prev } : currentActive);
          if (currentActive.todayNote) {
            setStudyNote(currentActive.todayNote);
          }
        }
      }
    } catch (err: any) {
      toastRef.current.error(extractErrorMessage(err, 'Failed to load LinkedIn games.'));
    } finally {
      setIsLoadingAll(false);
    }
  }, [groupId, selectedGameId]);

  // Load detailed game data + independent leaderboard for the selected game
  const loadGameDetails = useCallback(
    async (gameId: string) => {
      try {
        setIsLoadingDetails(true);
        const res = await fetchSingleLinkedInGame(groupId, gameId);
        if (res.success && res.game) {
          // Sync authoritative state
          setActiveGameData(res.game);
          setLeaderboard(res.leaderboard || []);
          if (res.game.todayNote) {
            setStudyNote(res.game.todayNote);
          }
          // Update game in local list
          setGames((prev) =>
            prev.map((g) => (g.gameId === gameId ? res.game : g))
          );
        }
      } catch (err: any) {
        toastRef.current.error(extractErrorMessage(err, 'Failed to load game details.'));
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    loadAllGames();
  }, [loadAllGames]);

  useEffect(() => {
    if (selectedGameId) {
      loadGameDetails(selectedGameId);
    }
  }, [selectedGameId, loadGameDetails]);

  // Instant game selection: immediately switches active state from local cache (0ms lag, no stale completion)
  const handleSelectGame = (gameId: string) => {
    if (gameId === selectedGameId) return;
    setSelectedGameId(gameId);
    setShowNoteInput(false);

    const cachedGame = games.find((g) => g.gameId === gameId);
    if (cachedGame) {
      setActiveGameData(cachedGame);
      setStudyNote(cachedGame.todayNote || '');
    }
  };

  // Instant optimistic game completion: zero processing visible to user
  const handleCompleteGame = async () => {
    if (isSubmitting || !selectedGameId || !activeGameData) return;
    setIsSubmitting(true);

    const prevActive = { ...activeGameData };
    const prevGames = [...games];
    const newStreak = (prevActive.currentStreak || 0) + 1;
    const newLongest = Math.max(prevActive.longestStreak || 0, newStreak);

    // 1. Instant optimistic UI update: user sees completion immediately!
    const optimisticGame: LinkedInGameItem = {
      ...prevActive,
      completedToday: true,
      currentStreak: newStreak,
      longestStreak: newLongest,
      todayNote: studyNote.trim() || null,
      totalCompletions: (prevActive.totalCompletions || 0) + 1,
    };

    setActiveGameData(optimisticGame);
    setGames((prev) =>
      prev.map((g) => (g.gameId === selectedGameId ? optimisticGame : g))
    );
    setShowNoteInput(false);
    toast.success(`${optimisticGame.name} completed! Streak: ${newStreak}d 🔥`);

    // 2. Background API sync
    try {
      const res = await completeLinkedInGame(groupId, selectedGameId, {
        studyNote: studyNote.trim() || undefined,
      });
      if (res.success && res.game) {
        setActiveGameData(res.game);
        setLeaderboard(res.leaderboard || []);
        setGames((prev) =>
          prev.map((g) => (g.gameId === selectedGameId ? res.game : g))
        );
      }
    } catch (err: any) {
      // Rollback only on actual failure
      setActiveGameData(prevActive);
      setGames(prevGames);
      toast.error(extractErrorMessage(err, 'Failed to complete game.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant optimistic game uncomplete (undo tick inside group)
  const handleUncompleteGame = async () => {
    if (isSubmitting || !selectedGameId || !activeGameData) return;
    setIsSubmitting(true);

    const prevActive = { ...activeGameData };
    const prevGames = [...games];
    const newStreak = Math.max(0, (prevActive.currentStreak || 1) - 1);

    // 1. Instant optimistic UI update
    const optimisticGame: LinkedInGameItem = {
      ...prevActive,
      completedToday: false,
      currentStreak: newStreak,
      todayNote: null,
      totalCompletions: Math.max(0, (prevActive.totalCompletions || 1) - 1),
      completionsHistory: (prevActive.completionsHistory || []).slice(1),
    };

    setActiveGameData(optimisticGame);
    setGames((prev) =>
      prev.map((g) => (g.gameId === selectedGameId ? optimisticGame : g))
    );
    setShowNoteInput(false);
    toast.info(`${optimisticGame.name} undone`);

    // 2. Background API sync
    try {
      const res = await uncompleteLinkedInGame(groupId, selectedGameId);
      if (res.success && res.game) {
        setActiveGameData(res.game);
        setLeaderboard(res.leaderboard || []);
        setGames((prev) =>
          prev.map((g) => (g.gameId === selectedGameId ? res.game : g))
        );
      }
    } catch (err: any) {
      // Rollback on error
      setActiveGameData(prevActive);
      setGames(prevGames);
      toast.error(extractErrorMessage(err, 'Failed to undo game completion.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle game commitment status
  const handleToggleCommitment = async (gameId: string, targetCommitment: boolean) => {
    if (isTogglingCommitment) return;
    setIsTogglingCommitment(true);

    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) => (g.gameId === gameId ? { ...g, isCommitted: targetCommitment } : g))
    );
    if (activeGameData && activeGameData.gameId === gameId) {
      setActiveGameData((prev) => (prev ? { ...prev, isCommitted: targetCommitment } : null));
    }

    try {
      const res = await updateLinkedInGameCommitment(groupId, gameId, targetCommitment);
      if (res.success && res.game) {
        setGames((prev) =>
          prev.map((g) => (g.gameId === gameId ? res.game : g))
        );
        if (activeGameData && activeGameData.gameId === gameId) {
          setActiveGameData(res.game);
        }
        toastRef.current.info(
          targetCommitment
            ? `Committed to ${res.game.name}. Dashboard tick will include this game.`
            : `Uncommitted from ${res.game.name}. History and streak are preserved.`
        );
      }
    } catch (err: any) {
      // Rollback on error
      setGames((prev) =>
        prev.map((g) => (g.gameId === gameId ? { ...g, isCommitted: !targetCommitment } : g))
      );
      if (activeGameData && activeGameData.gameId === gameId) {
        setActiveGameData((prev) => (prev ? { ...prev, isCommitted: !targetCommitment } : null));
      }
      toastRef.current.error(extractErrorMessage(err, 'Failed to update commitment.'));
    } finally {
      setIsTogglingCommitment(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-zinc-950 font-black text-xs shadow-sm shadow-amber-400/20">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-300 text-zinc-950 font-black text-xs shadow-sm">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-zinc-100 font-black text-xs shadow-sm">
          3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 text-zinc-400 font-mono font-bold text-xs">
        #{rank}
      </span>
    );
  };

  const ActiveIcon = GAME_ICONS[selectedGameId] || Gamepad2;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center text-zinc-300 shrink-0">
              <Gamepad2 className="w-5 h-5 text-flame-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                  LinkedIn Games
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-dark-surface text-zinc-400 border border-dark-border font-bold">
                  {groupName}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              loadAllGames();
              if (selectedGameId) loadGameDetails(selectedGameId);
            }}
            disabled={isLoadingAll || isLoadingDetails}
            className="p-2 sm:px-3 sm:py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5 shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoadingAll || isLoadingDetails ? 'animate-spin text-flame-400' : ''
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 8 Games Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {games.map((g) => {
          const Icon = GAME_ICONS[g.gameId] || Gamepad2;
          const isSelected = g.gameId === selectedGameId;

          return (
            <button
              key={g.gameId}
              type="button"
              onClick={() => handleSelectGame(g.gameId)}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[74px] active:scale-[0.98] ${
                isSelected
                  ? 'bg-dark-surface border-zinc-500 text-zinc-100 shadow-sm ring-1 ring-white/10'
                  : 'bg-dark-card border-dark-border hover:border-zinc-700 text-zinc-300 hover:bg-dark-surface/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-flame-400' : 'text-zinc-500'
                  }`}
                />
                <div className="flex items-center gap-1">
                  {g.isCommitted && (
                    <span
                      className="text-[9px] font-mono font-bold text-zinc-300 bg-dark-surface px-1 py-0.2 rounded border border-dark-border"
                      title="Committed"
                    >
                      ✓
                    </span>
                  )}
                  {g.completedToday ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" title="Completed" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" title="Pending" />
                  )}
                </div>
              </div>

              <div className="mt-2">
                <div className="text-xs font-bold truncate leading-tight">
                  {g.name}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono mt-0.5">
                  <Flame className="w-2.5 h-2.5 text-flame-400 fill-flame-400 shrink-0" />
                  <span className="font-bold text-flame-400">{g.currentStreak}d</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Game Detailed View */}
      {isLoadingDetails && !activeGameData ? (
        <div className="py-20 text-center text-xs text-dark-muted flex flex-col items-center gap-2 bg-dark-card border border-dark-border rounded-2xl">
          <RefreshCw className="w-5 h-5 animate-spin text-flame-400" />
          <span>Loading {selectedGameId}...</span>
        </div>
      ) : activeGameData ? (
        <div className="space-y-6">
          {/* Active Game Banner & Action */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 sm:p-6 shadow-panel">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-dark-surface border border-dark-border flex items-center justify-center text-zinc-200 shrink-0 shadow-sm">
                  <ActiveIcon className="w-5 h-5 text-flame-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-100 tracking-tight">
                      {activeGameData.name}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-dark-surface border border-dark-border text-zinc-400 font-medium">
                      {activeGameData.tagline}
                    </span>
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    {activeGameData.description}
                  </p>
                </div>
              </div>

              {/* Actions: Commitment Toggle & Completion Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                {/* Commit / Committed Toggle with icon */}
                <button
                  type="button"
                  onClick={() => handleToggleCommitment(activeGameData.gameId, !activeGameData.isCommitted)}
                  disabled={isTogglingCommitment}
                  title={
                    activeGameData.isCommitted
                      ? 'Committed. Click to uncommit.'
                      : 'Uncommitted. Click to commit.'
                  }
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    activeGameData.isCommitted
                      ? 'bg-dark-surface hover:bg-rose-500/10 text-zinc-300 hover:text-rose-400 border-dark-border hover:border-rose-500/30'
                      : 'bg-dark-surface hover:bg-dark-hover text-zinc-500 hover:text-zinc-300 border-dark-border'
                  }`}
                >
                  {isTogglingCommitment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : activeGameData.isCommitted ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span>Committed</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Commit</span>
                    </>
                  )}
                </button>

                {/* Tick / Un-tick Completion Button */}
                {activeGameData.completedToday ? (
                  <button
                    type="button"
                    onClick={handleUncompleteGame}
                    disabled={isSubmitting}
                    title="Click to un-tick and mark incomplete"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-dark-surface hover:bg-rose-500/10 border border-emerald-500/40 hover:border-rose-500/30 text-emerald-400 hover:text-rose-400 text-xs font-semibold transition-all active:scale-95 group"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5] group-hover:hidden" />
                    <X className="w-4 h-4 stroke-[2.5] hidden group-hover:block" />
                    <span className="group-hover:hidden">Completed</span>
                    <span className="hidden group-hover:inline">Undo Tick</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompleteGame}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 min-h-[44px] bg-flame-500 hover:bg-flame-400 active:scale-95 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    )}
                    <span>Mark Done</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNoteInput((prev) => !prev)}
                  className="px-3 py-2 min-h-[44px] bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl transition-colors text-center"
                  title="Note"
                >
                  {showNoteInput ? <X className="w-3.5 h-3.5" /> : activeGameData.todayNote ? 'Note' : '+ Note'}
                </button>
              </div>
            </div>

            {/* Optional Study/Game Note input */}
            {showNoteInput && (
              <div className="mt-4 pt-4 border-t border-dark-border space-y-2">
                <label className="block text-[11px] font-semibold text-zinc-400">
                  Game Note / Clues Solved / Score (Optional):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={studyNote}
                    onChange={(e) => setStudyNote(e.target.value)}
                    placeholder="e.g. Solved with 0 mistakes in 2m 14s!"
                    className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-flame-500"
                  />
                  <button
                    type="button"
                    onClick={handleCompleteGame}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {/* Display existing todayNote if available */}
            {activeGameData.todayNote && !showNoteInput && (
              <div className="mt-4 pt-3 border-t border-dark-border/60 text-xs text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-flame-400 shrink-0" />
                <span className="text-dark-muted font-medium">Today:</span>
                <span className="italic">"{activeGameData.todayNote}"</span>
              </div>
            )}

            {/* 4 Stat Badges for Selected Game */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-dark-border">
              <div className="bg-dark-surface rounded-xl p-3 border border-dark-border/80 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-dark-muted uppercase font-semibold">
                  <Flame className="w-3.5 h-3.5 text-flame-400" />
                  <span>Current Streak</span>
                </div>
                <div className="text-2xl font-black font-mono text-flame-400 mt-1">
                  {activeGameData.currentStreak}
                  <span className="text-xs font-normal text-dark-muted ml-1">days</span>
                </div>
              </div>

              <div className="bg-dark-surface rounded-xl p-3 border border-dark-border/80 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-dark-muted uppercase font-semibold">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Best Streak</span>
                </div>
                <div className="text-2xl font-black font-mono text-zinc-100 mt-1">
                  {activeGameData.longestStreak}
                  <span className="text-xs font-normal text-dark-muted ml-1">days</span>
                </div>
              </div>

              <div className="bg-dark-surface rounded-xl p-3 border border-dark-border/80 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-dark-muted uppercase font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Total Check-ins</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  {activeGameData.totalCompletions}
                </div>
              </div>

              <div className="bg-dark-surface rounded-xl p-3 border border-dark-border/80 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-dark-muted uppercase font-semibold">
                  <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                  <span>Freezes</span>
                </div>
                <div className="text-2xl font-black font-mono text-sky-400 mt-1">
                  {activeGameData.freezeBalance}
                  <span className="text-xs font-normal text-dark-muted ml-1">shield</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Layout: Game-Specific Independent Leaderboard + Recent History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dedicated Game Leaderboard (2 Cols) */}
            <div className="lg:col-span-2 bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      {activeGameData.name} Leaderboard
                    </h4>
                    <p className="text-[11px] text-dark-muted">
                      Ranked by current game streak among accepted group members
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-dark-muted">
                  {leaderboard.length} Members
                </span>
              </div>

              {leaderboard.length === 0 ? (
                <div className="py-12 text-center text-xs text-dark-muted bg-dark-surface/40 rounded-xl border border-dashed border-dark-border">
                  No member check-ins recorded yet for {activeGameData.name}. Be the first to play!
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((m) => {
                    const isCurrentUser = m.userId === user?.id;

                    return (
                      <div
                        key={m.userId}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 sm:gap-3 text-xs ${
                          isCurrentUser
                            ? 'bg-dark-surface border-zinc-600 text-zinc-100 ring-1 ring-white/10'
                            : 'bg-dark-surface/80 border-dark-border hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          {getRankBadge(m.rank)}

                          <InitialsAvatar
                            name={m.name}
                            image={m.profileImage}
                            size="sm"
                            className="shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="font-bold text-zinc-100 truncate">
                                {m.name}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-flame-500/15 text-flame-400 font-bold shrink-0 border border-flame-500/20">
                                  YOU
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 font-mono truncate">
                                @{m.username}
                              </span>
                            </div>
                            {m.todayNote && (
                              <p className="text-[11px] text-zinc-400 italic truncate mt-0.5">
                                "{m.todayNote}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 font-mono font-bold text-sm text-flame-400 justify-end">
                              <Flame className="w-3.5 h-3.5 fill-flame-400 shrink-0" />
                              <span>{m.currentStreak}d</span>
                            </div>
                            <div className="text-[10px] text-dark-muted font-mono whitespace-nowrap">
                              <span className="hidden sm:inline">Best: {m.longestStreak}d • </span>Total: {m.totalCompletions}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Completion History for Current User (1 Col) */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <h4 className="text-sm font-bold text-zinc-100">
                    Your {activeGameData.name} History
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-dark-muted">
                  Last 30 Days
                </span>
              </div>

              {activeGameData.completionsHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-dark-muted bg-dark-surface/40 rounded-xl border border-dashed border-dark-border p-4">
                  No check-ins yet. Play {activeGameData.name} and mark completed today to start your streak!
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {activeGameData.completionsHistory.map((item) => (
                    <div
                      key={item.completionDate}
                      className="p-2.5 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-mono font-semibold text-zinc-200">
                            {item.completionDate}
                          </span>
                          {item.studyNote && (
                            <p className="text-[11px] text-zinc-400 italic line-clamp-1">
                              {item.studyNote}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(item.completedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
