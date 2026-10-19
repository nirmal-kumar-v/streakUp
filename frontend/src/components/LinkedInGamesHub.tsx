import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLinkedInGames,
  fetchSingleLinkedInGame,
  completeLinkedInGame,
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

  const [studyNote, setStudyNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Load summary for all 8 games
  const loadAllGames = useCallback(async () => {
    try {
      setIsLoadingAll(true);
      const res = await fetchLinkedInGames(groupId);
      if (res.success && res.games) {
        setGames(res.games);
      }
    } catch (err: any) {
      toastRef.current.error(extractErrorMessage(err, 'Failed to load LinkedIn games.'));
    } finally {
      setIsLoadingAll(false);
    }
  }, [groupId]);

  // Load detailed game data + independent leaderboard for the selected game
  const loadGameDetails = useCallback(
    async (gameId: string) => {
      try {
        setIsLoadingDetails(true);
        const res = await fetchSingleLinkedInGame(groupId, gameId);
        if (res.success && res.game) {
          setActiveGameData(res.game);
          setLeaderboard(res.leaderboard || []);
          if (res.game.todayNote) {
            setStudyNote(res.game.todayNote);
          } else {
            setStudyNote('');
          }
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

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setShowNoteInput(false);
  };

  const handleCompleteGame = async () => {
    if (isSubmitting || !selectedGameId) return;
    setIsSubmitting(true);
    try {
      const res = await completeLinkedInGame(groupId, selectedGameId, {
        studyNote: studyNote.trim() || undefined,
      });
      if (res.success && res.game) {
        setActiveGameData(res.game);
        setLeaderboard(res.leaderboard || []);
        // Update games list locally so streak badge updates immediately
        setGames((prev) =>
          prev.map((g) => (g.gameId === selectedGameId ? res.game : g))
        );
        toast.success(`${res.game.name} completed! Current streak: ${res.game.currentStreak} days 🔥`);
        setShowNoteInput(false);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to complete game.'));
    } finally {
      setIsSubmitting(false);
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
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                  LinkedIn Games Hub
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 font-bold">
                  {groupName} • 8 Games
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                Play daily games, maintain separate streaks, and climb independent leaderboards with your group.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              loadAllGames();
              if (selectedGameId) loadGameDetails(selectedGameId);
            }}
            disabled={isLoadingAll || isLoadingDetails}
            className="self-start sm:self-center px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5"
            title="Refresh game streaks and leaderboards"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoadingAll || isLoadingDetails ? 'animate-spin text-flame-400' : ''
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 8 Games Navigation Tabs (Horizontal Scroll / Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {games.map((g) => {
          const Icon = GAME_ICONS[g.gameId] || Gamepad2;
          const isSelected = g.gameId === selectedGameId;

          return (
            <button
              key={g.gameId}
              type="button"
              onClick={() => handleSelectGame(g.gameId)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[78px] ${
                isSelected
                  ? 'bg-sky-500/10 border-sky-500/40 text-zinc-100 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/30'
                  : 'bg-dark-card border-dark-border hover:border-zinc-700 text-zinc-300 hover:bg-dark-surface'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-sky-400' : 'text-zinc-400'
                  }`}
                />
                {g.completedToday ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" title="Completed Today" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" title="Pending Today" />
                )}
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
          <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading {selectedGameId} details...</span>
        </div>
      ) : activeGameData ? (
        <div className="space-y-6">
          {/* Active Game Banner & Action */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
                    <ActiveIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-xl font-black text-zinc-100 tracking-tight">
                        {activeGameData.name}
                      </h3>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-dark-surface border border-dark-border text-zinc-300 font-medium">
                        {activeGameData.tagline}
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted mt-0.5">
                      {activeGameData.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Completion Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                {activeGameData.completedToday ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Completed Today</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompleteGame}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 active:scale-95 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    )}
                    <span>Mark {activeGameData.name} Completed</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNoteInput((prev) => !prev)}
                  className="px-3.5 py-2.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 text-xs font-semibold rounded-xl transition-colors text-center"
                >
                  {showNoteInput ? 'Close Note' : activeGameData.todayNote ? 'Edit Note' : '+ Note'}
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
                    className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleCompleteGame}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {/* Display existing todayNote if available */}
            {activeGameData.todayNote && !showNoteInput && (
              <div className="mt-4 pt-3 border-t border-dark-border/60 text-xs text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-dark-muted font-medium">Today's Note:</span>
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
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                          isCurrentUser
                            ? 'bg-sky-500/10 border-sky-500/40 text-zinc-100 ring-1 ring-sky-500/20'
                            : 'bg-dark-surface/80 border-dark-border hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getRankBadge(m.rank)}

                          <InitialsAvatar
                            name={m.name}
                            image={m.profileImage}
                            size="sm"
                            className="shrink-0"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-100 truncate">
                                {m.name}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">
                                  YOU
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 font-mono">
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

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 font-mono font-bold text-sm text-flame-400 justify-end">
                              <Flame className="w-3.5 h-3.5 fill-flame-400 shrink-0" />
                              <span>{m.currentStreak}d</span>
                            </div>
                            <div className="text-[10px] text-dark-muted font-mono">
                              Best: {m.longestStreak}d • Total: {m.totalCompletions}
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
