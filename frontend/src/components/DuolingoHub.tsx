import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchDuolingoCourses,
  commitDuolingoCourse,
  uncommitDuolingoCourse,
  completeDuolingoCourse,
  uncompleteDuolingoCourse,
  completeAllDuolingoCourses,
  fetchDuolingoCourseLeaderboard,
  DuolingoCourseItem,
  DuolingoLeaderboardEntry,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { InitialsAvatar } from './InitialsAvatar';
import {
  Flame,
  Trophy,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  BookOpen,
  Plus,
  X,
  FileText,
  Lock,
  Loader2,
  Layers,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

interface DuolingoHubProps {
  groupId: string;
  groupName: string;
  onRefreshGroup?: () => void;
}

export const DuolingoHub: React.FC<DuolingoHubProps> = ({
  groupId,
  groupName,
  onRefreshGroup,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const cacheKey = `streakup_duolingo_courses_${groupId}`;
  const [cachedCourses] = useState<DuolingoCourseItem[] | null>(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [courses, setCourses] = useState<DuolingoCourseItem[]>(() => cachedCourses || []);
  const [courseLimit, setCourseLimit] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(() => !cachedCourses || cachedCourses.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_courses' | 'all_courses' | 'leaderboards'>('my_courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'language' | 'other'>('all');

  // Study note modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { type: 'single'; courseId: string } | { type: 'all' } | null
  >(null);
  const [studyNoteInput, setStudyNoteInput] = useState('');

  // Selected course for leaderboard
  const [selectedLeaderboardCourseId, setSelectedLeaderboardCourseId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<DuolingoLeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // In-flight completions tracker to prevent double-clicks
  const inFlightRef = useRef<Set<string>>(new Set());

  // Committed courses derived from state
  const committedCourses = useMemo(() => courses.filter((c) => c.isCommitted), [courses]);
  const completedTodayCount = useMemo(
    () => committedCourses.filter((c) => c.completedToday).length,
    [committedCourses]
  );

  // Overall Duolingo streak = MAX streak of committed courses
  const overallStreak = useMemo(() => {
    if (committedCourses.length === 0) return 0;
    return Math.max(0, ...committedCourses.map((c) => c.currentStreak));
  }, [committedCourses]);

  const areAllCommittedCompleted = useMemo(() => {
    return committedCourses.length > 0 && committedCourses.every((c) => c.completedToday);
  }, [committedCourses]);

  // Load all 45 courses from backend
  const loadCourses = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      try {
        const res = await fetchDuolingoCourses(groupId);
        if (res.success && res.courses) {
          setCourses(res.courses);
          if (res.courseLimit) setCourseLimit(res.courseLimit);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(res.courses));
          } catch {}

          // Auto-select first committed course for leaderboard if not selected
          const committed = res.courses.filter((c) => c.isCommitted);
          if (committed.length > 0 && !selectedLeaderboardCourseId) {
            setSelectedLeaderboardCourseId(committed[0].courseId);
          }
        }
      } catch (err: any) {
        toastRef.current.error(extractErrorMessage(err, 'Failed to load Duolingo courses.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [groupId, cacheKey, selectedLeaderboardCourseId]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Load leaderboard when selected leaderboard course changes
  const loadLeaderboard = useCallback(
    async (courseId: string) => {
      if (!courseId) return;
      setIsLoadingLeaderboard(true);
      try {
        const res = await fetchDuolingoCourseLeaderboard(groupId, courseId);
        if (res.success && res.leaderboard) {
          setLeaderboard(res.leaderboard);
        }
      } catch (err: any) {
        console.warn('[DuolingoHub] Leaderboard load error:', err);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    if (selectedLeaderboardCourseId && activeTab === 'leaderboards') {
      loadLeaderboard(selectedLeaderboardCourseId);
    }
  }, [selectedLeaderboardCourseId, activeTab, loadLeaderboard]);

  // Handle Commit / Uncommit toggle
  const handleToggleCommit = async (course: DuolingoCourseItem) => {
    const isCurrentlyCommitted = course.isCommitted;

    if (!isCurrentlyCommitted && committedCourses.length >= courseLimit) {
      toast.error(`You can commit to at most ${courseLimit} courses. Uncommit a course first to add this one.`);
      return;
    }

    // Optimistic update
    const nextCommitted = !isCurrentlyCommitted;
    setCourses((prev) =>
      prev.map((c) => (c.courseId === course.courseId ? { ...c, isCommitted: nextCommitted } : c))
    );

    try {
      if (nextCommitted) {
        const res = await commitDuolingoCourse(groupId, course.courseId);
        if (res.success && res.course) {
          setCourses((prev) =>
            prev.map((c) => (c.courseId === course.courseId ? { ...c, ...res.course } : c))
          );
          toast.success(`Committed to ${course.name}!`);
          if (!selectedLeaderboardCourseId) {
            setSelectedLeaderboardCourseId(course.courseId);
          }
        }
      } else {
        const res = await uncommitDuolingoCourse(groupId, course.courseId);
        if (res.success && res.course) {
          setCourses((prev) =>
            prev.map((c) => (c.courseId === course.courseId ? { ...c, ...res.course } : c))
          );
          toast.info(`Uncommitted from ${course.name}.`);
          if (selectedLeaderboardCourseId === course.courseId) {
            const remaining = committedCourses.filter((c) => c.courseId !== course.courseId);
            setSelectedLeaderboardCourseId(remaining[0]?.courseId || '');
          }
        }
      }
      onRefreshGroup?.();
    } catch (err: any) {
      // Revert optimistic update
      setCourses((prev) =>
        prev.map((c) => (c.courseId === course.courseId ? { ...c, isCommitted: isCurrentlyCommitted } : c))
      );
      toast.error(extractErrorMessage(err, 'Failed to update course commitment.'));
    }
  };

  // Check if ticking this course is the LAST uncompleted committed course today
  const isLastCourseToComplete = (courseId: string) => {
    const uncompleted = committedCourses.filter((c) => !c.completedToday);
    return uncompleted.length === 1 && uncompleted[0].courseId === courseId;
  };

  // Handle single course tick / untick click
  const handleCourseCheck = (course: DuolingoCourseItem) => {
    if (inFlightRef.current.has(course.courseId)) return;

    if (course.completedToday) {
      // Untick immediately
      performUncompleteCourse(course.courseId);
      return;
    }

    // If this is the LAST course to complete, prompt for note FIRST
    if (isLastCourseToComplete(course.courseId)) {
      setPendingAction({ type: 'single', courseId: course.courseId });
      setStudyNoteInput(course.todayNote || '');
      setIsNoteModalOpen(true);
      return;
    }

    // Otherwise, complete silently without study note prompt
    performCompleteCourse(course.courseId, undefined);
  };

  // Perform single course completion API call
  const performCompleteCourse = async (courseId: string, note?: string) => {
    if (inFlightRef.current.has(courseId)) return;
    inFlightRef.current.add(courseId);

    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => {
        if (c.courseId === courseId) {
          const nextStreak = (c.currentStreak || 0) + 1;
          return {
            ...c,
            completedToday: true,
            currentStreak: nextStreak,
            longestStreak: Math.max(c.longestStreak || 0, nextStreak),
            todayNote: note || c.todayNote,
            totalCompletions: c.totalCompletions + 1,
          };
        }
        return c;
      })
    );

    try {
      const res = await completeDuolingoCourse(groupId, courseId, note);
      if (res.success && res.course) {
        setCourses((prev) =>
          prev.map((c) => (c.courseId === courseId ? { ...c, ...res.course } : c))
        );
        toast.success(`${res.course.name} streak blazed! 🔥`);
        if (selectedLeaderboardCourseId === courseId) {
          loadLeaderboard(courseId);
        }
      }
      onRefreshGroup?.();
    } catch (err: any) {
      // Revert
      loadCourses();
      toast.error(extractErrorMessage(err, 'Failed to complete course.'));
    } finally {
      inFlightRef.current.delete(courseId);
    }
  };

  // Perform single course uncomplete API call
  const performUncompleteCourse = async (courseId: string) => {
    if (inFlightRef.current.has(courseId)) return;
    inFlightRef.current.add(courseId);

    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => {
        if (c.courseId === courseId) {
          const nextStreak = Math.max(0, (c.currentStreak || 0) - 1);
          return {
            ...c,
            completedToday: false,
            currentStreak: nextStreak,
            todayNote: null,
            totalCompletions: Math.max(0, c.totalCompletions - 1),
          };
        }
        return c;
      })
    );

    try {
      const res = await uncompleteDuolingoCourse(groupId, courseId);
      if (res.success && res.course) {
        setCourses((prev) =>
          prev.map((c) => (c.courseId === courseId ? { ...c, ...res.course } : c))
        );
        toast.info(`${res.course.name} completion undone.`);
        if (selectedLeaderboardCourseId === courseId) {
          loadLeaderboard(courseId);
        }
      }
      onRefreshGroup?.();
    } catch (err: any) {
      loadCourses();
      toast.error(extractErrorMessage(err, 'Failed to undo course completion.'));
    } finally {
      inFlightRef.current.delete(courseId);
    }
  };

  // Handle "Complete All" button
  const handleCompleteAllClick = () => {
    const uncompleted = committedCourses.filter((c) => !c.completedToday);
    if (uncompleted.length === 0) return;

    // Ask for study note once before completing all
    setPendingAction({ type: 'all' });
    setStudyNoteInput('');
    setIsNoteModalOpen(true);
  };

  // Perform Complete All API call
  const performCompleteAll = async (note?: string) => {
    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => {
        if (c.isCommitted && !c.completedToday) {
          const nextStreak = (c.currentStreak || 0) + 1;
          return {
            ...c,
            completedToday: true,
            currentStreak: nextStreak,
            longestStreak: Math.max(c.longestStreak || 0, nextStreak),
            todayNote: note || null,
            totalCompletions: c.totalCompletions + 1,
          };
        }
        return c;
      })
    );

    try {
      const res = await completeAllDuolingoCourses(groupId, note);
      if (res.success) {
        toast.success(`All ${committedCourses.length} Duolingo courses completed! 🎉`);
        loadCourses();
        if (selectedLeaderboardCourseId) {
          loadLeaderboard(selectedLeaderboardCourseId);
        }
      }
      onRefreshGroup?.();
    } catch (err: any) {
      loadCourses();
      toast.error(extractErrorMessage(err, 'Failed to complete all courses.'));
    }
  };

  // Handle Note Modal Submission
  const handleNoteModalSubmit = () => {
    setIsNoteModalOpen(false);
    const note = studyNoteInput.trim() || undefined;

    if (!pendingAction) return;

    if (pendingAction.type === 'single') {
      performCompleteCourse(pendingAction.courseId, note);
    } else if (pendingAction.type === 'all') {
      performCompleteAll(note);
    }
    setPendingAction(null);
  };

  // Filtered courses for catalogue
  const filteredCourses = useMemo(() => {
    let list = courses;
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.courseId.includes(q));
    }
    return list;
  }, [courses, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ─── Hero Overview Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#58CC02]/15 via-dark-card to-dark-card border border-[#58CC02]/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#58CC02]/20 border border-[#58CC02]/40 flex items-center justify-center shrink-0 shadow-md shadow-[#58CC02]/20">
              <span className="text-2xl">🦉</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-zinc-100 tracking-tight">
                  Duolingo Special Group
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-[#58CC02]/20 text-[#58CC02] border border-[#58CC02]/40">
                  45 Courses
                </span>
              </div>
              <p className="text-xs text-dark-muted mt-0.5">
                {groupName} • Commit to up to {courseLimit} courses. Maintain separate streaks, combined study notes, and independent leaderboards.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Complete All */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Overall Streak Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-surface/90 border border-dark-border">
              <Flame className="w-5 h-5 text-flame-400 stroke-[2.5]" />
              <div className="text-left">
                <div className="text-xs font-mono font-black text-zinc-100">
                  {overallStreak} <span className="text-[10px] text-dark-muted font-normal">days</span>
                </div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-dark-muted">
                  Best Streak
                </div>
              </div>
            </div>

            {/* Committed Count Pill */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-surface/90 border border-dark-border text-xs font-mono font-bold text-zinc-300">
              <BookOpen className="w-3.5 h-3.5 text-[#58CC02]" />
              <span>{committedCourses.length}/{courseLimit}</span>
            </div>

            <button
              onClick={() => loadCourses(true)}
              disabled={isRefreshing}
              title="Refresh Duolingo data"
              className="p-2 rounded-xl bg-dark-surface/90 border border-dark-border hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#58CC02]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action Bar for Committed Courses */}
        {committedCourses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dark-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-300 flex items-center gap-2">
              <span className="font-semibold text-zinc-100">{completedTodayCount} of {committedCourses.length}</span>
              <span>completed today</span>
              {areAllCommittedCompleted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> All Done!
                </span>
              )}
            </div>

            {!areAllCommittedCompleted && (
              <button
                onClick={handleCompleteAllClick}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 font-black text-xs rounded-xl shadow-md shadow-[#58CC02]/25 active:scale-95 transition-all"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Complete All in One Click</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('my_courses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'my_courses'
              ? 'bg-[#58CC02]/20 text-[#58CC02] border border-[#58CC02]/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>My Committed Courses ({committedCourses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('all_courses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'all_courses'
              ? 'bg-[#58CC02]/20 text-[#58CC02] border border-[#58CC02]/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Course Directory (45)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('leaderboards');
            if (!selectedLeaderboardCourseId && committedCourses[0]) {
              setSelectedLeaderboardCourseId(committedCourses[0].courseId);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'leaderboards'
              ? 'bg-[#58CC02]/20 text-[#58CC02] border border-[#58CC02]/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Course Leaderboards</span>
        </button>
      </div>

      {/* ─── TAB 1: MY COMMITTED COURSES ──────────────────────────────────── */}
      {activeTab === 'my_courses' && (
        <div className="space-y-4">
          {isLoading && courses.length === 0 ? (
            <div className="text-center py-12 text-xs text-dark-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#58CC02]" />
              <span>Loading Duolingo courses...</span>
            </div>
          ) : committedCourses.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-dark-border bg-dark-card/50">
              <span className="text-4xl block mb-2">🦉</span>
              <h3 className="text-sm font-bold text-zinc-100">No courses committed yet</h3>
              <p className="text-xs text-dark-muted max-w-sm mx-auto mt-1 mb-4">
                Choose up to {courseLimit} languages or subjects from Duolingo to track streaks, view leaderboards, and display on your dashboard.
              </p>
              <button
                onClick={() => setActiveTab('all_courses')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Browse All 45 Courses</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {committedCourses.map((course) => {
                const isProcessing = inFlightRef.current.has(course.courseId);
                return (
                  <div
                    key={course.courseId}
                    className={`rounded-2xl border p-4 transition-all duration-200 ${
                      course.completedToday
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-dark-card border-dark-border hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{course.emoji}</span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-zinc-100 truncate">{course.name}</h4>
                          <span className="text-[10px] text-dark-muted uppercase font-mono tracking-wider">
                            {course.category}
                          </span>
                        </div>
                      </div>

                      {/* Checkbox Button */}
                      <button
                        type="button"
                        onClick={() => handleCourseCheck(course)}
                        disabled={isProcessing}
                        title={course.completedToday ? 'Mark incomplete' : 'Complete lesson'}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-150 shrink-0 ${
                          isProcessing
                            ? 'opacity-60 cursor-not-allowed'
                            : 'active:scale-90 cursor-pointer'
                        } ${
                          course.completedToday
                            ? 'bg-[#58CC02] border-[#58CC02] text-zinc-950 shadow-md shadow-[#58CC02]/25'
                            : 'border-zinc-600 hover:border-[#58CC02] hover:bg-[#58CC02]/10 text-transparent'
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
                        ) : (
                          <Check
                            className={`w-4 h-4 stroke-[3] transition-transform ${
                              course.completedToday ? 'scale-100' : 'scale-50'
                            }`}
                          />
                        )}
                      </button>
                    </div>

                    {/* Streak & Info Row */}
                    <div className="mt-4 pt-3 border-t border-dark-border/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Flame className={`w-4 h-4 ${course.currentStreak > 0 ? 'text-flame-400' : 'text-zinc-600'}`} />
                        <span className="font-mono font-bold text-zinc-100">{course.currentStreak}</span>
                        <span className="text-[10px] text-dark-muted">streak</span>
                        {course.longestStreak > 0 && (
                          <span className="text-[10px] text-dark-muted font-mono ml-1">
                            (Best: {course.longestStreak})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {course.todayNote && (
                          <span
                            title={`Today's Note: ${course.todayNote}`}
                            className="inline-flex items-center gap-1 text-[10px] text-[#58CC02] bg-[#58CC02]/10 px-2 py-0.5 rounded-md border border-[#58CC02]/20"
                          >
                            <FileText className="w-3 h-3" /> Note
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleCommit(course)}
                          title="Uncommit course"
                          className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {committedCourses.length < courseLimit && (
            <div className="text-center pt-2">
              <button
                onClick={() => setActiveTab('all_courses')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-dark-border hover:border-[#58CC02]/50 text-xs font-bold text-zinc-300 hover:text-[#58CC02] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Courses ({committedCourses.length}/{courseLimit})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: COURSE DIRECTORY (ALL 45 COURSES) ────────────────────── */}
      {activeTab === 'all_courses' && (
        <div className="space-y-4">
          {/* Search and Category Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-dark-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 45 languages & subjects (e.g. Spanish, Chess, Japanese)..."
                className="w-full pl-9 pr-4 py-2 bg-dark-card border border-dark-border focus:border-[#58CC02] focus:ring-1 focus:ring-[#58CC02] rounded-xl text-xs text-zinc-100 placeholder-dark-muted outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-dark-muted hover:text-zinc-300'
                }`}
              >
                All (45)
              </button>
              <button
                onClick={() => setCategoryFilter('language')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === 'language'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-dark-muted hover:text-zinc-300'
                }`}
              >
                Languages (42)
              </button>
              <button
                onClick={() => setCategoryFilter('other')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === 'other'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-dark-muted hover:text-zinc-300'
                }`}
              >
                Chess / Math / Music (3)
              </button>
            </div>
          </div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {filteredCourses.map((course) => (
              <div
                key={course.courseId}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                  course.isCommitted
                    ? 'bg-[#58CC02]/10 border-[#58CC02]/30'
                    : 'bg-dark-card border-dark-border hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{course.emoji}</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-zinc-100 truncate block">{course.name}</span>
                    <span className="text-[10px] text-dark-muted font-mono">{course.currentStreak}d streak</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleCommit(course)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                    course.isCommitted
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                      : committedCourses.length >= courseLimit
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 shadow-sm'
                  }`}
                >
                  {course.isCommitted ? 'Uncommit' : 'Commit'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: LEADERBOARDS (PER-COURSE) ─────────────────────────────── */}
      {activeTab === 'leaderboards' && (
        <div className="space-y-4">
          {committedCourses.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-dark-border bg-dark-card/50">
              <Lock className="w-8 h-8 text-dark-muted mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-zinc-100">Leaderboards are locked</h3>
              <p className="text-xs text-dark-muted max-w-sm mx-auto mt-1">
                You can only view the leaderboard for courses you are actively committed to. Commit to a course to unlock its rankings!
              </p>
            </div>
          ) : (
            <>
              {/* Course Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {committedCourses.map((c) => (
                  <button
                    key={c.courseId}
                    onClick={() => setSelectedLeaderboardCourseId(c.courseId)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedLeaderboardCourseId === c.courseId
                        ? 'bg-[#58CC02] text-zinc-950 font-black shadow-md shadow-[#58CC02]/20'
                        : 'bg-dark-card border border-dark-border text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>{c.emoji}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>

              {/* Leaderboard Table */}
              <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
                <div className="px-4 py-3 bg-dark-surface/60 border-b border-dark-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-flame-400" />
                    <h3 className="text-xs font-bold text-zinc-100">
                      {courses.find((c) => c.courseId === selectedLeaderboardCourseId)?.name || 'Course'} Leaderboard
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-dark-muted">
                    {leaderboard.length} member{leaderboard.length === 1 ? '' : 's'} committed
                  </span>
                </div>

                {isLoadingLeaderboard ? (
                  <div className="py-12 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#58CC02]" />
                    <span>Loading leaderboard...</span>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="py-10 text-center text-xs text-dark-muted">
                    No members currently committed to this course.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] sm:min-w-full text-left text-xs">
                      <thead className="bg-dark-surface/40 text-[10px] font-mono uppercase text-dark-muted border-b border-dark-border">
                        <tr>
                          <th className="py-2.5 px-4 w-12">#</th>
                          <th className="py-2.5 px-4">Member</th>
                          <th className="py-2.5 px-4 text-center">Current</th>
                          <th className="py-2.5 px-4 text-center">Best</th>
                          <th className="py-2.5 px-4 text-center">Total</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-border/40 font-mono">
                        {leaderboard.map((entry) => {
                          const isSelf = entry.userId === user?.id;
                          return (
                            <tr
                              key={entry.userId}
                              className={`transition-colors ${
                                isSelf
                                  ? 'bg-[#58CC02]/5 hover:bg-[#58CC02]/10'
                                  : 'hover:bg-dark-surface/50'
                              }`}
                            >
                              <td className="py-3 px-4 font-bold">
                                {entry.rank === 1 ? (
                                  <span className="text-amber-400">🥇</span>
                                ) : entry.rank === 2 ? (
                                  <span className="text-zinc-300">🥈</span>
                                ) : entry.rank === 3 ? (
                                  <span className="text-amber-600">🥉</span>
                                ) : (
                                  <span className="text-dark-muted font-normal">#{entry.rank}</span>
                                )}
                              </td>

                              <td className="py-3 px-4 font-sans">
                                <div className="flex items-center gap-2.5">
                                  <InitialsAvatar
                                    name={entry.name}
                                    image={entry.profileImage}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-zinc-100 truncate">
                                        {entry.name}
                                      </span>
                                      {isSelf && (
                                        <span className="text-[9px] bg-[#58CC02]/20 text-[#58CC02] px-1.5 py-0.2 rounded-full font-mono font-bold">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-dark-muted block">
                                      @{entry.username}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center font-bold text-zinc-100">
                                <div className="inline-flex items-center gap-1">
                                  <Flame
                                    className={`w-3.5 h-3.5 ${
                                      entry.currentStreak > 0 ? 'text-flame-400' : 'text-zinc-600'
                                    }`}
                                  />
                                  <span>{entry.currentStreak}</span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center text-dark-muted">
                                {entry.longestStreak}
                              </td>

                              <td className="py-3 px-4 text-center text-dark-muted">
                                {entry.totalCompletions}
                              </td>

                              <td className="py-3 px-4 text-right">
                                {entry.completedToday ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <Check className="w-3 h-3 stroke-[3]" /> Done
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-dark-muted font-sans">
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── STUDY NOTE PROMPT MODAL ─────────────────────────────────────── */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#58CC02]/20 border border-[#58CC02]/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#58CC02]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Study Note</h3>
                  <p className="text-[11px] text-dark-muted">
                    Final course completed today! Add a combined study note for all your committed Duolingo courses.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNoteModalOpen(false);
                  setPendingAction(null);
                }}
                className="text-dark-muted hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <textarea
                value={studyNoteInput}
                onChange={(e) => setStudyNoteInput(e.target.value)}
                placeholder="What did you learn or practice in Duolingo today? (Optional)"
                rows={3}
                className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border focus:border-[#58CC02] focus:ring-1 focus:ring-[#58CC02] rounded-xl text-xs text-zinc-100 placeholder-dark-muted outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleNoteModalSubmit}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 font-bold text-xs rounded-xl transition-colors"
              >
                Skip Note
              </button>
              <button
                type="button"
                onClick={handleNoteModalSubmit}
                className="px-4 py-2 bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Complete & Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
