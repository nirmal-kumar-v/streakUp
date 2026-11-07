import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../utils/scrollLock';
import {
  getStreakMilestones,
  getHighestUnlockedMilestone,
  getNextMilestone,
  isMilestoneUnlocked,
  OpenStreakModalDetail,
} from '../utils/streakMilestones';
import { PremiumStreakMedal } from './PremiumStreakMedal';
import { downloadStreakCardImage, shareStreakBadge } from '../utils/streakCardExporter';
import {
  Flame,
  Trophy,
  X,
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Lock,
} from 'lucide-react';

export const StreakMilestoneModal: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [modalDetail, setModalDetail] = useState<OpenStreakModalDetail | null>(null);
  const [selectedMilestoneDays, setSelectedMilestoneDays] = useState<number>(50);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useBodyScrollLock(isOpen);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<OpenStreakModalDetail>;
      const detail = customEvent.detail || {};
      setModalDetail(detail);

      const effectiveCurrent = detail.currentStreak !== undefined ? detail.currentStreak : (user?.currentStreak || 0);
      const effectiveLongest = detail.longestStreak !== undefined ? detail.longestStreak : (user?.longestStreak || 0);

      // Select target milestone if specified, else highest unlocked or first milestone (25)
      if (detail.targetMilestoneDays) {
        setSelectedMilestoneDays(detail.targetMilestoneDays);
      } else {
        const highest = getHighestUnlockedMilestone(effectiveCurrent, effectiveLongest);
        setSelectedMilestoneDays(highest ? highest.days : 50);
      }

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

  // Selected active milestone
  const selectedMilestone = useMemo(() => {
    return allMilestones.find((m) => m.days === selectedMilestoneDays) || allMilestones[0];
  }, [allMilestones, selectedMilestoneDays]);

  const isUnlocked = isMilestoneUnlocked(selectedMilestone.days, currentStreak, longestStreak);
  const isActiveStreak = currentStreak >= selectedMilestone.days;

  // Next milestone calculation
  const nextMilestoneInfo = useMemo(() => {
    return getNextMilestone(currentStreak, longestStreak);
  }, [currentStreak, longestStreak]);

  // Action handlers
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      await downloadStreakCardImage({
        milestone: selectedMilestone,
        currentStreak,
        userName,
        userHandle,
      });
      toast.success(`Downloaded ${selectedMilestone.title} card!`);
    } catch (err) {
      toast.error('Failed to generate badge card image.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      const res = await shareStreakBadge({
        milestone: selectedMilestone,
        currentStreak,
        userName,
        userHandle,
      });
      if (res.shared) {
        toast.success(res.message);
      } else if (res.copied) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success(res.message);
      }
    } catch {
      toast.error('Sharing failed.');
    }
  };

  const handleCopyLink = async () => {
    const profileUrl = `${window.location.origin}/profile/${encodeURIComponent(userHandle)}?badge=${selectedMilestone.days}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success('Badge profile link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      {/* Outer Card Container */}
      <div className="relative w-full max-w-lg bg-[#0c0c11] border border-amber-500/25 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden my-auto animate-scaleUp">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-amber-500/20 via-flame-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close modal"
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-900/80 border border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6 text-center">
          {/* 1. Official Header Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Official StreakUp Milestone Badge</span>
          </div>

          {/* 2. Congratulatory Headline (Matching Sample Image 1) */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-300">
              Congratulations! For maintaining
            </p>
            <h2
              id="streak-modal-title"
              className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-flame-400"
            >
              {selectedMilestone.tagline}
            </h2>
          </div>

          {/* 3. The Stage & Holographic Pedestal (Matching Sample Image 1) */}
          <div className="relative flex flex-col items-center justify-center py-4 my-2">
            {/* Upward Light Beam Projection */}
            <div className="absolute bottom-6 w-48 h-56 bg-gradient-to-t from-amber-400/25 via-amber-500/10 to-transparent clip-path-beam pointer-events-none" />

            {/* Glowing Ground Pedestal Ellipse */}
            <div className="absolute bottom-0 w-64 h-12 rounded-[100%] bg-gradient-to-r from-amber-500/30 via-amber-400/60 to-amber-500/30 blur-sm pointer-events-none shadow-[0_0_30px_rgba(255,200,0,0.6)]" />
            <div className="absolute bottom-1 w-44 h-8 rounded-[100%] border-2 border-amber-300/80 pointer-events-none" />

            {/* Floating 3D Medallion */}
            <div className="relative z-10 transition-transform duration-300 hover:scale-105 animate-float">
              <PremiumStreakMedal
                days={selectedMilestone.days}
                tier={selectedMilestone.tier}
                size="custom"
                customSize={180}
                isLocked={!isUnlocked}
                animated={isUnlocked}
              />
            </div>

            {/* Ambient Sparkles */}
            {isUnlocked && (
              <>
                <div className="absolute top-4 left-10 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00e5ff] animate-ping" />
                <div className="absolute top-12 right-12 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#ffd700] animate-pulse" />
                <div className="absolute bottom-16 left-14 w-1.5 h-1.5 rounded-full bg-purple-300 shadow-[0_0_6px_#d1c4e9] animate-bounce" />
              </>
            )}
          </div>

          {/* 4. Badge Title & Status */}
          <div className="space-y-1.5 pt-1">
            <h3 className="text-xl font-black text-zinc-100 flex items-center justify-center gap-2">
              <span>{selectedMilestone.title}</span>
            </h3>

            <p className="text-xs text-zinc-400 max-w-sm mx-auto line-clamp-2">
              {selectedMilestone.description}
            </p>

            {/* Status Pill */}
            <div className="pt-2 flex items-center justify-center">
              {isActiveStreak ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <Flame className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500 animate-pulse" />
                  <span>Active Burning Streak Badge</span>
                </span>
              ) : isUnlocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Milestone Conquered (Best: {longestStreak}d)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Unlocks at {selectedMilestone.days} consecutive days</span>
                </span>
              )}
            </div>
          </div>

          {/* 5. User Streak Stats & Next Milestone Bar */}
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3 text-left">
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
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Next: <strong className="text-amber-300">{nextMilestoneInfo.nextMilestone.name}</strong></span>
                  <span className="font-mono text-amber-400">{nextMilestoneInfo.daysRemaining} days to go</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-flame-500 rounded-full transition-all duration-500"
                    style={{ width: `${nextMilestoneInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. Milestone Showcase Carousel / Selector */}
          <div className="space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                All Streak Milestones
              </span>
              <span className="text-[11px] text-dark-muted font-mono">
                {allMilestones.filter((m) => isMilestoneUnlocked(m.days, currentStreak, longestStreak)).length} / {allMilestones.length} Unlocked
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {allMilestones.map((m) => {
                const unlocked = isMilestoneUnlocked(m.days, currentStreak, longestStreak);
                const isSelected = m.days === selectedMilestone.days;

                return (
                  <button
                    key={m.days}
                    type="button"
                    onClick={() => setSelectedMilestoneDays(m.days)}
                    className={`shrink-0 flex items-center gap-2 p-2 rounded-xl border transition-all text-xs font-bold ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-2 ring-amber-500/30'
                        : unlocked
                        ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200 hover:border-amber-500/50'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <PremiumStreakMedal
                      days={m.days}
                      tier={m.tier}
                      size="sm"
                      customSize={28}
                      isLocked={!unlocked}
                    />
                    <span>{m.days}d</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Action Buttons (Share, Download, Copy Link) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
            {/* Share Badge Button */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-flame-500 hover:from-amber-600 hover:to-flame-600 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer col-span-2 sm:col-span-1"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Badge</span>
            </button>

            {/* Download Card Graphic */}
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-zinc-200 hover:text-white font-semibold text-xs rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-amber-400" />
              )}
              <span>Download Card</span>
            </button>

            {/* Copy Profile Badge Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500/40 text-zinc-200 hover:text-white font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Brand Logo */}
          <div className="pt-2 text-center">
            <span className="font-black text-xs tracking-widest text-dark-muted font-mono uppercase">
              StreakUp • Unbroken Consistency
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
