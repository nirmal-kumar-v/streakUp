import React, { useState, useEffect } from 'react';
import { fetchPublicAnnouncement, PlatformAnnouncementData } from '../api/admin';
import { Info, AlertTriangle, CheckCircle2, ShieldAlert, X, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AnnouncementBanner: React.FC = () => {
  const [announcement, setAnnouncement] = useState<PlatformAnnouncementData | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const checkAnnouncement = async () => {
      try {
        const res = await fetchPublicAnnouncement();
        if (!isCancelled && res.success && res.announcement && res.announcement.active) {
          const dismissKey = `streakup_dismissed_announcement_${res.announcement.updatedAt}`;
          const isLocallyDismissed = sessionStorage.getItem(dismissKey) === 'true';

          if (!isLocallyDismissed && res.announcement.message.trim().length > 0) {
            setAnnouncement(res.announcement);
            setIsDismissed(false);
          }
        }
      } catch (err) {
        // Silently ignore announcement network issues
      }
    };

    checkAnnouncement();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isDismissed || !announcement || !announcement.active) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      const dismissKey = `streakup_dismissed_announcement_${announcement.updatedAt}`;
      sessionStorage.setItem(dismissKey, 'true');
    } catch (e) {
      // ignore
    }
  };

  const getStyleClasses = () => {
    switch (announcement.type) {
      case 'alert':
        return 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-red-500/30 text-red-200';
      case 'warning':
        return 'bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-amber-500/30 text-amber-200';
      case 'success':
        return 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-emerald-500/30 text-emerald-200';
      case 'info':
      default:
        return 'bg-gradient-to-r from-cyan-950/80 via-blue-950/60 to-cyan-950/80 border-cyan-500/30 text-cyan-200';
    }
  };

  const renderIcon = () => {
    switch (announcement.type) {
      case 'alert':
        return <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <aside
      aria-label="Platform Announcement"
      className={`w-full border-b py-2 px-4 backdrop-blur-md relative z-40 transition-all duration-300 animate-fadeIn ${getStyleClasses()}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {renderIcon()}
          <span className="truncate">{announcement.message}</span>
          {announcement.link && (
            <Link
              to={announcement.link}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 shrink-0 ml-1"
            >
              <span>{announcement.linkText || 'View Details'}</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {announcement.dismissible && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-zinc-100 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
};
