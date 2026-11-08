import React, { useState } from 'react';
import { X, FileText, Shield, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBodyScrollLock } from '../utils/scrollLock';

interface PolicyModalProps {
  isOpen: boolean;
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-hidden touch-none overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-dark-card border border-dark-border rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto touch-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between shrink-0 bg-dark-card">
          <div className="flex items-center gap-1.5 p-1 bg-dark-surface rounded-xl border border-dark-border">
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'terms'
                  ? 'bg-flame-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms & Conditions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'privacy'
                  ? 'bg-flame-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover transition-colors"
            title="Close policy viewer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-300 leading-relaxed">
          {activeTab === 'terms' ? (
            /* TERMS CONTENT */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-dark-border/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Terms & Conditions</h3>
                  <p className="text-[11px] text-dark-muted">Version 2.0 (Authoritative) &bull; Effective November 2026</p>
                </div>
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-flame-400 hover:text-flame-300 inline-flex items-center gap-1 font-semibold"
                >
                  <span>Open in full tab</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">1. Acceptance of Terms</h4>
                <p>
                  By creating an account, browsing the website, or using the StreakUp Android app and widget, you agree to comply with and be legally bound by these Terms & Conditions.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">2. Account Responsibility & Verification</h4>
                <p>
                  You must provide an authentic email address and complete 6-digit email OTP verification. You are solely responsible for safeguarding your credentials and your on-device 4-digit App Lock PIN.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">3. Tasks, Streaks, Points & Milestone Badges</h4>
                <p>
                  Streak boundaries and countdowns are calculated strictly based on your configured timezone. Completing scheduled daily habits awards +5 points; uncompleted habits incur a -5 point penalty. Freezes automatically protect broken streaks when available and recharge after 7 consecutive completed days. Milestone badges unlock at 25d, 50d, 75d, 100d, 150d, 200d, 250d, 300d, 365d (1 Year), 730d (2 Year), and 1095d (3 Year).
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">4. Community Conduct & Social Rules</h4>
                <p>
                  StreakUp offers peer friendships, shared groups, and study notes. You may not publish vulgar, abusive, threatening, or infringing content in usernames, task titles, or notes. Automated scraping, script botting, or exploiting bugs to spoof leaderboards is strictly barred.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">5. Permanent Account Deletion & 10-Day Grace Period</h4>
                <p>
                  You can initiate account deletion at any time via Settings &gt; Danger Zone. Deletion enters a 10-day recovery grace period, after which your account, habits, completion logs, streaks, points, notes, and friendships are permanently purged from database tables.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">6. Disclaimers</h4>
                <p>
                  StreakUp is provided on an &ldquo;AS IS&rdquo; basis for productivity habit tracking. It does not provide medical, clinical, or psychological advice.
                </p>
              </section>
            </div>
          ) : (
            /* PRIVACY CONTENT */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-dark-border/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Privacy Policy</h3>
                  <p className="text-[11px] text-dark-muted">Version 2.0 (Authoritative) &bull; Effective November 2026</p>
                </div>
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold"
                >
                  <span>Open in full tab</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">1. Data We Collect</h4>
                <p>
                  We collect your display name, username, email address, timezone, profile image (Base64 data URI), and habit data (titles, subtasks, schedules, notes, streaks, points, friend requests, group memberships).
                </p>
                <p className="text-zinc-400">
                  <strong className="text-zinc-200">Passwords and App Lock PINs are NEVER stored in plaintext.</strong> Login passwords are salted and hashed with bcrypt. App Lock PINs and security answers are salted and hashed using SHA-256 via Web Crypto API and stored strictly on your local device.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">2. How We Use Data</h4>
                <p>
                  Data is used solely to authenticate your account, compute your streaks according to your timezone, send verification and reminder emails via SMTP, and display friend leaderboards. We do not sell your personal data or run advertising trackers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">3. Retention & Automatic Pruning</h4>
                <p>
                  In-app notifications are automatically pruned after 15 days, except user-starred notifications (up to 15) which are kept indefinitely. Habit heatmap and completion history are retained for 365 days minimum to preserve annual achievements.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">4. Your Rights & Deletion</h4>
                <p>
                  You can update your profile, change your email (with a 14-day security cooldown), or permanently delete your account anytime via Settings &gt; Danger Zone.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-zinc-100">5. Support & Security Contact</h4>
                <p>
                  For support inquiries, security notifications, or data protection questions, reach our team at{' '}
                  <a href="mailto:streakup.web@gmail.com" className="text-flame-400 hover:underline">
                    streakup.web@gmail.com
                  </a>.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-dark-border bg-dark-surface/40 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-dark-muted font-mono">
            {activeTab === 'terms' ? 'StreakUp Terms v2.0' : 'StreakUp Privacy v2.0'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 text-xs font-bold rounded-xl transition-all"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
};
