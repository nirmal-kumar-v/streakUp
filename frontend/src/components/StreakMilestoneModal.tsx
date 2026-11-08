import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../utils/scrollLock';
import {
  getStreakMilestones,
  getNextMilestone,
  isMilestoneUnlocked,
  OpenStreakModalDetail,
  StreakMilestone,
} from '../utils/streakMilestones';
import { PremiumStreakMedal } from './PremiumStreakMedal';
import { downloadStreakCardImage, shareStreakBadge } from '../utils/streakCardExporter';
import {
  Flame,
  Trophy,
  X,
  Share2,
  Download,
  Award,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

export const StreakMilestoneModal: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [modalDetail, setModalDetail] = useState<OpenStreakModalDetail | null>(null);
  // View mode: 'CURRENT_STREAK' | 'BADGE'
  const [viewMode, setViewMode] = useState<'CURRENT_STREAK' | 'BADGE'>('CURRENT_STREAK');
  const [selectedMilestone, setSelectedMilestone] = useState<StreakMilestone | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useBodyScrollLock(isOpen);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<OpenStreakModalDetail>;
      const detail = customEvent.detail || {};
      setModalDetail(detail);

      const effectiveCurrent = detail.currentStreak !== undefined ? detail.currentStreak : (user?.currentStreak || 0);
      const effectiveLongest = detail.longestStreak !== undefined ? detail.longestStreak : (user?.longestStreak || 0);
      const milestones = getStreakMilestones(Math.max(effectiveCurrent, effectiveLongest));

      // If a specific target milestone was requested AND is unlocked, display that badge
      if (detail.targetMilestoneDays) {
        const target = milestones.find((m) => m.days === detail.targetMilestoneDays);
        if (target && isMilestoneUnlocked(target.days, effectiveCurrent, effectiveLongest)) {
          setSelectedMilestone(target);
          setViewMode('BADGE');
          setIsOpen(true);
          return;
        }
      }

      // Default view is ALWAYS the Current Streak card
      setViewMode('CURRENT_STREAK');
      setSelectedMilestone(null);
      setIsOpen(true);
    };

    window.addEventListener('streakup_open_streak_modal', handleOpen);
    return () => window.removeEventListener('streakup_open_streak_modal', handleOpen);
  }, [user]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Derive current display streak numbers
  const currentStreak = modalDetail?.currentStreak !== undefined
    ? modalDetail.currentStreak
    : (user?.currentStreak || 0);

  const longestStreak = modalDetail?.longestStreak !== undefined
    ? modalDetail.longestStreak
    : (user?.longestStreak || 0);

  const userName = modalDetail?.userName || user?.name || 'StreakUp Achiever';
  const userHandle = modalDetail?.userHandle || user?.username || 'streakup';

  // All available milestones
  const allMilestones = useMemo(() => {
    return getStreakMilestones(Math.max(currentStreak, longestStreak));
  }, [currentStreak, longestStreak]);

  // Filter ONLY unlocked milestones
  const unlockedMilestones = useMemo(() => {
    return allMilestones.filter((m) => isMilestoneUnlocked(m.days, currentStreak, longestStreak));
  }, [allMilestones, currentStreak, longestStreak]);

  // Next milestone calculation
  const nextMilestoneInfo = useMemo(() => {
    return getNextMilestone(currentStreak, longestStreak);
  }, [currentStreak, longestStreak]);

  // Action handlers
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      if (viewMode === 'BADGE' && selectedMilestone) {
        await downloadStreakCardImage({
          milestone: selectedMilestone,
          currentStreak,
          userName,
          userHandle,
        });
        toast.success(`Downloaded ${selectedMilestone.title}!`);
      } else {
        await downloadStreakCardImage({
          milestone: null,
          currentStreak,
          userName,
          userHandle,
        });
        toast.success(`Downloaded ${currentStreak}-Day Streak Card!`);
      }
    } catch {
      toast.error('Failed to generate card image.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      const res = await shareStreakBadge({
        milestone: viewMode === 'BADGE' ? selectedMilestone : null,
        currentStreak,
        userName,
        userHandle,
      });
      if (res.shared || res.copied) {
        toast.success(res.message);
      }
    } catch {
      toast.error('Sharing failed.');
    }
  };

  const handleSelectUnlockedBadge = (milestone: StreakMilestone) => {
    setSelectedMilestone(milestone);
    setViewMode('BADGE');
  };

  const handleBackToCurrentStreak = () => {
    setViewMode('CURRENT_STREAK');
    setSelectedMilestone(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-modal-title"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-3 sm:p-4 overflow-hidden touch-none overscroll-none bg-black/85 backdrop-blur-md animate-fadeIn"
      onWheel={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      {/* Outer Card Container - Compact, Professional & Top-Safe */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#0c0c12] border border-amber-500/25 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden my-auto max-h-[90dvh] flex flex-col animate-scaleUp touch-auto">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 bg-gradient-to-b from-amber-500/20 via-flame-500/10 to-transparent blur-2xl pointer-events-none" />

        {/* Top Bar with Clean Navigation & Close Button */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-3.5 pb-1">
          {viewMode === 'BADGE' ? (
            <button
              type="button"
              onClick={handleBackToCurrentStreak}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-amber-300 hover:border-amber-500/50 text-xs font-semibold transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Current Streak</span>
            </button>
          ) : (
            <span className="text-[11px] font-mono font-bold tracking-wider text-amber-500/90 uppercase">
              StreakUp
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close modal"
            className="p-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 pt-1 space-y-3 sm:space-y-3.5 text-center overflow-y-auto overscroll-contain scrollbar-none">
          {/* Headline Section */}
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-zinc-400">
              Congratulations! For maintaining
            </p>
            <h2
              id="streak-modal-title"
              className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-flame-400"
            >
              {viewMode === 'BADGE' && selectedMilestone
                ? selectedMilestone.tagline
                : `${currentStreak} Day${currentStreak === 1 ? '' : 's'} Streak`}
            </h2>
          </div>

          {/* The Center Stage & Holographic Pedestal */}
          <div className="relative flex flex-col items-center justify-center py-1 h-32 sm:h-36">
            {/* Upward Light Beam */}
            <div className="absolute bottom-2 w-32 h-28 bg-gradient-to-t from-amber-400/20 via-amber-500/5 to-transparent clip-path-beam pointer-events-none" />

            {/* Glowing Ground Pedestal Ellipse */}
            <div className="absolute bottom-0 w-40 h-7 rounded-[100%] bg-gradient-to-r from-amber-500/25 via-amber-400/50 to-amber-500/25 blur-sm pointer-events-none shadow-[0_0_20px_rgba(255,200,0,0.5)]" />
            <div className="absolute bottom-1 w-28 h-4 rounded-[100%] border border-amber-300/60 pointer-events-none" />

            {/* Floating 3D Medallion */}
            <div className="relative z-10 transition-transform duration-300 hover:scale-105 animate-float">
              {viewMode === 'BADGE' && selectedMilestone ? (
                <PremiumStreakMedal
                  days={selectedMilestone.days}
                  tier={selectedMilestone.tier}
                  size="custom"
                  customSize={110}
                  ribbonText={selectedMilestone.ribbonText}
                  isLocked={false}
                  animated={true}
                />
              ) : (
                <PremiumStreakMedal
                  days={Math.max(1, currentStreak)}
                  tier={
                    currentStreak >= 365
                      ? 'mythic'
                      : currentStreak >= 250
                      ? 'titan'
                      : currentStreak >= 100
                      ? 'diamond'
                      : currentStreak >= 50
                      ? 'gold'
                      : 'bronze'
                  }
                  size="custom"
                  customSize={110}
                  ribbonText={currentStreak >= 365 ? `${Math.floor(currentStreak / 365)} YEAR STREAK` : 'DAY STREAK'}
                  isLocked={false}
                  animated={true}
                />
              )}
            </div>

            {/* Ambient Sparkles */}
            <div className="absolute top-1 left-12 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#00e5ff] animate-ping" />
            <div className="absolute top-5 right-12 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#ffd700] animate-pulse" />
          </div>

          {/* Badge / Streak Title & Status */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-zinc-100 flex items-center justify-center gap-1.5">
              <span>
                {viewMode === 'BADGE' && selectedMilestone
                  ? selectedMilestone.title
                  : (currentStreak === 1 ? '1-Day Habit Starter' : `${currentStreak} Days Active Streak`)}
              </span>
            </h3>

            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto line-clamp-2">
              {viewMode === 'BADGE' && selectedMilestone
                ? selectedMilestone.description
                : `Active daily habit maintained unbroken by ${userName}.`}
            </p>
          </div>

          {/* Stats Bar & Next Milestone Progress */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Flame className="w-3.5 h-3.5 text-flame-500 fill-flame-500" />
                <span>Current: <strong className="text-flame-400">{currentStreak}</strong> days</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Record: <strong className="text-zinc-200">{longestStreak}</strong> days</span>
              </div>
            </div>

            {nextMilestoneInfo && (
              <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate pr-1">Next: <strong className="text-amber-300">{nextMilestoneInfo.nextMilestone.name}</strong></span>
                  <span className="font-mono text-amber-400 shrink-0">{nextMilestoneInfo.daysRemaining}d to go</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-flame-500 rounded-full transition-all duration-500"
                    style={{ width: `${nextMilestoneInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Share & Download Only (No copy link feature) */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-flame-500 hover:from-amber-600 hover:to-flame-600 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{viewMode === 'BADGE' ? 'Share Badge' : 'Share Streak'}</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-zinc-200 hover:text-white font-semibold text-xs rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{viewMode === 'BADGE' ? 'Download Badge' : 'Download Card'}</span>
            </button>
          </div>

          {/* Earned Milestones Section: Badges only clickable when unlocked */}
          <div className="space-y-1.5 pt-0.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Earned Badges</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                {unlockedMilestones.length}/{allMilestones.length}
              </span>
            </div>

            {unlockedMilestones.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {/* Current Streak pill option */}
                <button
                  type="button"
                  onClick={handleBackToCurrentStreak}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'CURRENT_STREAK'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-flame-500 fill-flame-500" />
                  <span>Current ({currentStreak}d)</span>
                </button>

                {/* Only UNLOCKED milestones are clickable */}
                {unlockedMilestones.map((m) => {
                  const isSelected = viewMode === 'BADGE' && selectedMilestone?.days === m.days;

                  return (
                    <button
                      key={m.days}
                      type="button"
                      onClick={() => handleSelectUnlockedBadge(m)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40 shadow-sm shadow-amber-500/30'
                          : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-800/80'
                      }`}
                    >
                      <PremiumStreakMedal
                        days={m.days}
                        tier={m.tier}
                        size="sm"
                        customSize={22}
                        isLocked={false}
                      />
                      <span>{m.days}d</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center">
                <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
                  <span>First official badge unlocks at</span>
                  <strong className="text-amber-300">25 days</strong>
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                </p>
                <p className="text-[10px] text-zinc-500 pt-0.5">
                  Keep maintaining your daily streak to earn and collect 3D badges!
                </p>
              </div>
            )}
          </div>

          {/* Footer Brand Logo */}
          <div className="pt-0.5 text-center">
            <span className="font-black text-[10px] tracking-widest text-zinc-600 font-mono uppercase">
              StreakUp • Unbroken Consistency
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};