import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchDuolingoCourses,
  completeDuolingoCourse,
  uncompleteDuolingoCourse,
  completeAllDuolingoCourses,
  DuolingoCourseItem,
} from '../api/groups';
import { useToast } from '../context/ToastContext';
import {
  Flame,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  FileText,
  X,
  Plus,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

interface DuolingoGroupCardProps {
  groupId: string;
  groupName: string;
  onRefreshDashboard?: () => void;
}

export const DuolingoGroupCard: React.FC<DuolingoGroupCardProps> = ({
  groupId,
  groupName,
  onRefreshDashboard,
}) => {
  const navigate = useNavigate();
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

  // Study note prompt modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { type: 'single'; courseId: string } | { type: 'all' } | null
  >(null);
  const [studyNoteInput, setStudyNoteInput] = useState('');

  // Track in-flight requests
  const inFlightRef = useRef<Set<string>>(new Set());

  // Committed courses
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

  const areAllCompleted = useMemo(() => {
    return committedCourses.length > 0 && committedCourses.every((c) => c.completedToday);
  }, [committedCourses]);

  // Load courses
  const loadCourses = useCallback(async () => {
    try {
      const res = await fetchDuolingoCourses(groupId);
      if (res.success && res.courses) {
        setCourses(res.courses);
        if (res.courseLimit) setCourseLimit(res.courseLimit);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.courses));
        } catch {}
      }
    } catch (err: any) {
      console.warn('[DuolingoGroupCard] Failed to load courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, cacheKey]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Check if clicking this course completes the LAST uncompleted course
  const isLastCourseToComplete = (courseId: string) => {
    const uncompleted = committedCourses.filter((c) => !c.completedToday);
    return uncompleted.length === 1 && uncompleted[0].courseId === courseId;
  };

  // Handle single course checkbox click
  const handleCourseCheck = (course: DuolingoCourseItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inFlightRef.current.has(course.courseId)) return;

    if (course.completedToday) {
      // Untick course
      performUncompleteCourse(course.courseId);
      return;
    }

    // If it's the LAST one to complete, ask for note FIRST
    if (isLastCourseToComplete(course.courseId)) {
      setPendingAction({ type: 'single', courseId: course.courseId });
      setStudyNoteInput(course.todayNote || '');
      setIsNoteModalOpen(true);
      return;
    }

    // Otherwise, complete immediately
    performCompleteCourse(course.courseId, undefined);
  };

  const performCompleteCourse = async (courseId: string, note?: string) => {
    if (inFlightRef.current.has(courseId)) return;
    inFlightRef.current.add(courseId);

    // Optimistic state
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
        toastRef.current.success(`${res.course.name} streak blazed! 🔥`);
      }
      onRefreshDashboard?.();
    } catch (err: any) {
      loadCourses();
      toastRef.current.error(extractErrorMessage(err, 'Failed to complete course.'));
    } finally {
      inFlightRef.current.delete(courseId);
    }
  };

  const performUncompleteCourse = async (courseId: string) => {
    if (inFlightRef.current.has(courseId)) return;
    inFlightRef.current.add(courseId);

    // Optimistic state
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
        toastRef.current.info(`${res.course.name} undone.`);
      }
      onRefreshDashboard?.();
    } catch (err: any) {
      loadCourses();
      toastRef.current.error(extractErrorMessage(err, 'Failed to undo course completion.'));
    } finally {
      inFlightRef.current.delete(courseId);
    }
  };

  // Complete All in One Click
  const handleCompleteAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const uncompleted = committedCourses.filter((c) => !c.completedToday);
    if (uncompleted.length === 0) return;

    setPendingAction({ type: 'all' });
    setStudyNoteInput('');
    setIsNoteModalOpen(true);
  };

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
        toastRef.current.success(`All ${committedCourses.length} Duolingo courses completed! 🎉`);
        loadCourses();
      }
      onRefreshDashboard?.();
    } catch (err: any) {
      loadCourses();
      toastRef.current.error(extractErrorMessage(err, 'Failed to complete all courses.'));
    }
  };

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

  const cardBorderStyle = areAllCompleted
    ? 'border-emerald-500/30 bg-dark-card/90'
    : 'border-dark-border hover:border-zinc-700 shadow-panel bg-dark-card';

  return (
    <>
      <div className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden ${cardBorderStyle}`}>
        {/* Top Banner: Group Name & Duolingo Badge */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-dark-surface/60 border-b border-dark-border/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-[#58CC02]/10 text-[#58CC02] border-[#58CC02]/30 shadow-sm">
              <span className="text-base">🦉</span>
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/groups/${groupId}`)}
                className="text-xs sm:text-sm font-bold text-zinc-100 hover:text-[#58CC02] truncate text-left block transition-colors group-hover:text-zinc-50"
              >
                {groupName}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {overallStreak > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-flame-400 bg-flame-500/10 px-2 py-0.5 rounded-full border border-flame-500/20">
                <Flame className="w-3 h-3 text-flame-400" />
                <span>{overallStreak}d</span>
              </span>
            )}
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-[#58CC02]/10 text-[#58CC02] border-[#58CC02]/30">
              Duolingo Special
            </span>
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}`)}
              title="View Duolingo course details and rankings"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-dark-hover transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtasks Box */}
        <div className="p-3.5 sm:p-4 space-y-2.5">
          {isLoading && courses.length === 0 ? (
            <div className="py-4 text-center text-xs text-dark-muted flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#58CC02]" />
              <span>Loading Duolingo courses...</span>
            </div>
          ) : committedCourses.length === 0 ? (
            <div className="py-4 text-center px-3 rounded-xl border border-dashed border-dark-border bg-dark-surface/40">
              <p className="text-xs text-dark-muted mb-2">
                No Duolingo courses chosen yet. Commit to up to {courseLimit} courses to track your daily progress.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/groups/${groupId}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Choose Courses (Max {courseLimit})</span>
              </button>
            </div>
          ) : (
            <>
              {/* Course Subtask Rows */}
              {committedCourses.map((course) => {
                const isProcessing = inFlightRef.current.has(course.courseId);
                return (
                  <div
                    key={course.courseId}
                    className={`flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition-all ${
                      course.completedToday
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-dark-surface/50 border-dark-border hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox Tick */}
                      <button
                        type="button"
                        onClick={handleCourseCheck(course)}
                        disabled={isProcessing}
                        aria-label={course.completedToday ? `${course.name} completed` : `Mark ${course.name} completed`}
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-150 ${
                          isProcessing
                            ? 'opacity-60 cursor-not-allowed pointer-events-none'
                            : 'active:scale-90 cursor-pointer'
                        } ${
                          course.completedToday
                            ? 'bg-[#58CC02] border-[#58CC02] text-zinc-950 shadow-sm shadow-[#58CC02]/25'
                            : 'border-zinc-600 hover:border-[#58CC02] hover:bg-[#58CC02]/10 text-transparent'
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 text-zinc-300 animate-spin" />
                        ) : (
                          <Check
                            className={`w-3.5 h-3.5 stroke-[3] transition-transform duration-150 ${
                              course.completedToday ? 'scale-100' : 'scale-50'
                            }`}
                          />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base shrink-0">{course.emoji}</span>
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              course.completedToday
                                ? 'text-zinc-400 line-through'
                                : 'text-zinc-100'
                            }`}
                          >
                            {course.name}
                          </span>
                          {course.todayNote && (
                            <span
                              title={`Note: ${course.todayNote}`}
                              className="text-[10px] text-[#58CC02] bg-[#58CC02]/10 px-1.5 py-0.2 rounded border border-[#58CC02]/20 font-mono"
                            >
                              Note saved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Streak Count */}
                    <div className="flex items-center gap-1 shrink-0 font-mono text-xs">
                      <Flame
                        className={`w-3.5 h-3.5 ${
                          course.currentStreak > 0 ? 'text-flame-400' : 'text-zinc-600'
                        }`}
                      />
                      <span className="font-bold text-zinc-100">{course.currentStreak}</span>
                    </div>
                  </div>
                );
              })}

              {/* Bottom Quick-Action Bar */}
              <div className="pt-2 flex items-center justify-between gap-3 text-xs border-t border-dark-border/40">
                <div className="text-dark-muted font-mono text-[11px] flex items-center gap-1.5">
                  <span className="text-zinc-200 font-bold">{completedTodayCount} of {committedCourses.length}</span>
                  <span>completed</span>
                  {areAllCompleted && (
                    <span className="text-emerald-400 font-bold inline-flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!areAllCompleted && (
                    <button
                      type="button"
                      onClick={handleCompleteAll}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#58CC02] hover:bg-[#46A302] text-zinc-950 font-extrabold text-[11px] rounded-lg shadow-sm transition-all active:scale-95"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Tick All</span>
                    </button>
                  )}
                  {committedCourses.length < courseLimit && (
                    <button
                      type="button"
                      onClick={() => navigate(`/groups/${groupId}`)}
                      className="text-[11px] text-zinc-400 hover:text-[#58CC02] transition-colors"
                    >
                      + Add Course
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
                type="button"
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
    </>
  );
};
