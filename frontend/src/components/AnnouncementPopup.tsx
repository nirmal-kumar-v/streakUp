import React, { useState, useEffect, useCallback } from 'react';
import { fetchPublicAnnouncement, PlatformAnnouncementData } from '../api/admin';
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SEEN_PREFIX = 'streakup_announcement_modal_seen_';

export const AnnouncementPopup: React.FC = () => {
  const [announcement, setAnnouncement] = useState<PlatformAnnouncementData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkAnnouncement = useCallback(async () => {
    try {
      const res = await fetchPublicAnnouncement();
      if (res && res.success && res.announcement && res.announcement.active) {
        const ann = res.announcement;
        const msg = (ann.message || '').trim();
        if (msg.length === 0) return;

        const versionKey = `${SEEN_PREFIX}${ann.id || ann.updatedAt || 'latest'}`;
        const isSeenLocally =
          localStorage.getItem(versionKey) === 'true' ||
          sessionStorage.getItem(versionKey) === 'true';

        // If not seen yet, trigger the popup
        if (!isSeenLocally) {
          setAnnouncement(ann);
          setIsOpen(true);
        }
      }
    } catch {
      // Silently ignore network failures
    }
  }, []);

  useEffect(() => {
    // Initial check on mount
    checkAnnouncement();

    // Check when user returns to the tab or dashboard
    const handleFocus = () => {
      checkAnnouncement();
    };
    window.addEventListener('focus', handleFocus);

    // Periodic check every 60 seconds for live updates
    const interval = setInterval(checkAnnouncement, 60000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkAnnouncement]);

  const handleDismiss = () => {
    if (!announcement) return;
    const versionKey = `${SEEN_PREFIX}${announcement.id || announcement.updatedAt || 'latest'}`;
    try {
      localStorage.setItem(versionKey, 'true');
      sessionStorage.setItem(versionKey, 'true');
    } catch {
      // ignore storage errors
    }
    setIsOpen(false);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && announcement?.dismissible !== false) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, announcement]);

  if (!isOpen || !announcement || !announcement.active) {
    return null;
  }

  // Visual Theme mapping based on Announcement Severity
  const theme = {
    info: {
      badge: 'Platform Announcement',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
      glow: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      borderColor: 'border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)]',
      iconBg: 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/40 text-cyan-400',
      iconRing: 'border-cyan-500/30',
      buttonBg: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-cyan-500/20',
      icon: <Radio className="w-7 h-7 text-cyan-400" />,
      accentColor: 'text-cyan-400',
    },
    warning: {
      badge: 'Attention / Important Notice',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      glow: 'from-amber-500/20 via-yellow-500/10 to-transparent',
      borderColor: 'border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)]',
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border-amber-500/40 text-amber-400',
      iconRing: 'border-amber-500/30',
      buttonBg: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/20',
      icon: <AlertTriangle className="w-7 h-7 text-amber-400" />,
      accentColor: 'text-amber-400',
    },
    success: {
      badge: 'Platform Update & Celebration',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      glow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      borderColor: 'border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]',
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border-emerald-500/40 text-emerald-400',
      iconRing: 'border-emerald-500/30',
      buttonBg: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20',
      icon: <CheckCircle2 className="w-7 h-7 text-emerald-400" />,
      accentColor: 'text-emerald-400',
    },
    alert: {
      badge: 'Urgent Platform Notice',
      badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      glow: 'from-rose-500/25 via-red-600/10 to-transparent',
      borderColor: 'border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.25)]',
      iconBg: 'bg-gradient-to-br from-rose-500/20 to-red-600/20 border-rose-500/40 text-rose-400',
      iconRing: 'border-rose-500/30',
      buttonBg: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/25',
      icon: <ShieldAlert className="w-7 h-7 text-rose-400" />,
      accentColor: 'text-rose-400',
    },
  }[announcement.type || 'info'];

  const isExternalLink = announcement.link?.startsWith('http://') || announcement.link?.startsWith('https://');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && announcement.dismissible !== false) {
          handleDismiss();
        }
      }}
    >
      {/* Outer Card with Ambient Glow */}
      <div
        className={`relative w-full max-w-lg bg-[#0e121a] border rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${theme.borderColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Radial Gradient Glow */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-b ${theme.glow} rounded-full blur-3xl pointer-events-none`}
        />

        {/* Decorative Grid Accent Lines */}
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 to-transparent pointer-events-none" />

        {/* Dismiss Close Icon (Top Right) */}
        {announcement.dismissible !== false && (
          <button
            onClick={handleDismiss}
            aria-label="Skip Announcement"
            className="absolute top-4 right-4 z-20 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/10 active:scale-95 rounded-full transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content Container */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col items-center text-center space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Glowing Hero Icon Graphic */}
          <div className="relative mt-2">
            <div
              className={`absolute -inset-2 rounded-2xl border ${theme.iconRing} animate-ping opacity-25`}
            />
            <div
              className={`relative flex items-center justify-center w-16 h-16 rounded-2xl border shadow-xl backdrop-blur-xl ${theme.iconBg}`}
            >
              {theme.icon}
            </div>
          </div>

          {/* Category Pill Tag */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border backdrop-blur-md ${theme.badgeBg}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{theme.badge}</span>
          </div>

          {/* Heading */}
          <h2
            id="announcement-title"
            className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-snug"
          >
            Broadcast Announcement
          </h2>

          {/* Body Message Container */}
          <div className="w-full p-4 sm:p-5 bg-dark-bg/70 border border-white/5 rounded-2xl text-left">
            <p className="text-zinc-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal select-text break-words">
              {announcement.message}
            </p>
          </div>

          {/* Optional Action Link / Button */}
          {announcement.link && (
            <div className="w-full pt-1">
              {isExternalLink ? (
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-100 text-xs sm:text-sm font-semibold transition group shadow-md"
                >
                  <span>{announcement.linkText || 'Explore More'}</span>
                  <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition" />
                </a>
              ) : (
                <Link
                  to={announcement.link}
                  onClick={handleDismiss}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-100 text-xs sm:text-sm font-semibold transition group shadow-md"
                >
                  <span>{announcement.linkText || 'View Details'}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition" />
                </Link>
              )}
            </div>
          )}

          {/* Primary Skip / Got It Button */}
          <div className="w-full pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleDismiss}
              className={`w-full py-3 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 shadow-lg active:scale-[0.98] ${theme.buttonBg}`}
            >
              Got it, Skip
            </button>
          </div>

          {/* Bottom subtle dismiss helper */}
          {announcement.dismissible !== false && (
            <p className="text-[11px] text-zinc-400 select-none">
              You can skip this announcement at any time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
