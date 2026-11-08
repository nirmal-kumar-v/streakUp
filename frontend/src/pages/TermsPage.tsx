import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Flame,
  Award,
  Users,
  Ban,
  Mail,
  Trash2,
} from 'lucide-react';

export const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-dark-border gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-flame-400 py-2 px-3 rounded-xl hover:bg-dark-card border border-transparent hover:border-dark-border transition-all w-fit cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-dark-muted">
            <span className="px-2.5 py-0.5 rounded-full bg-flame-500/10 text-flame-400 border border-flame-500/25 font-semibold">
              Version 2.0 (Authoritative)
            </span>
            <span>Effective Date: November 2026</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-flame-500 bg-flame-500/10 px-3 py-1 rounded-full border border-flame-500/20">
            <FileText className="w-3.5 h-3.5" />
            <span>User Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-100 tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            Please read these Terms &amp; Conditions carefully before accessing or using the StreakUp platform, web application, mobile applications, home-screen widgets, and associated services.
          </p>
        </div>

        {/* Summary Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">Honest Consistency</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                Streaks represent genuine daily discipline. Automated bots and completion spoofing are strictly barred.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <Users className="w-5 h-5 text-flame-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">Community Respect</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                Zero tolerance for harassment, offensive display names, defamatory notes, or malicious group conduct.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">User Data Control</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                You maintain complete rights over your account and may initiate permanent deletion at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Main Terms Sections */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-panel space-y-10 text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                01
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Acceptance of Terms</h2>
            </div>
            <p>
              By accessing, browsing, registering for, downloading, or using StreakUp (&ldquo;StreakUp&rdquo;, &ldquo;Service&rdquo;, &ldquo;Application&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you enter into a legally binding contract with StreakUp and agree to adhere to these Terms &amp; Conditions and our Privacy Policy. If you do not agree to these terms in their entirety, you are strictly prohibited from accessing the Service and must immediately discontinue all usage.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                02
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Eligibility &amp; Account Registration</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Minimum Age Requirement:</strong> You must be at least 13 years of age (or 16 where required by local statute) to create an account or utilize the Service.
              </li>
              <li>
                <strong className="text-zinc-200">Authentic Registration Details:</strong> You agree to provide a valid email address, authentic display name, and unique alphanumeric username. Account activation strictly requires verifying your identity through a 6-digit email One-Time Password (OTP).
              </li>
              <li>
                <strong className="text-zinc-200">One Account Per Person:</strong> Each account must correspond to an individual user. Creating duplicate accounts, bot-managed profiles, or shared credentials to manipulate leaderboards is prohibited.
              </li>
              <li>
                <strong className="text-zinc-200">Credential Confidentiality:</strong> You are solely responsible for safeguarding your login password and your local 4-digit App Lock PIN. You must notify StreakUp immediately at <a href="mailto:support@streakup.app" className="text-flame-400 hover:underline">support@streakup.app</a> if you discover unauthorized access.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                03
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Streak Mechanics, Milestone Badges &amp; Points</h2>
            </div>
            <p>
              StreakUp provides deterministic habit tracking governed by the following mathematical and algorithmic rules:
            </p>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 bg-dark-surface/50 rounded-xl border border-dark-border">
                <strong className="text-zinc-100 text-xs flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-flame-400" />
                  <span>Timezone Calculation &amp; Daily Midnight Boundaries</span>
                </strong>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                  All habit schedule evaluations, daily completions, and reverse midnight countdowns are computed strictly relative to your selected IANA timezone (e.g. <code className="font-mono text-zinc-200">Asia/Kolkata</code>). If you alter your timezone, your streaks are automatically recalculated according to new local day boundaries.
                </p>
              </div>

              <div className="p-3.5 bg-dark-surface/50 rounded-xl border border-dark-border">
                <strong className="text-zinc-100 text-xs flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Official Milestone Badges &amp; Achievements</span>
                </strong>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                  Official StreakUp 3D badges unlock strictly upon reaching verified consecutive milestones: <strong>25 days (Bronze Flame), 50 days (Silver Ember), 75 days (Golden Core), 100 days (Century Blaze), 150 days (Master Flame), 200 days (Inferno Elite), 250 days (Obsidian Fire), 300 days (Immortal Spark), 365 days (1 Year Sovereign Titan), 730 days (2 Year Legend), and 1095 days (3 Year Mythic)</strong>. Badges cannot be unlocked arbitrarily and are only viewable, downloadable, and shareable once legitimately earned.
                </p>
              </div>

              <div className="p-3.5 bg-dark-surface/50 rounded-xl border border-dark-border">
                <strong className="text-zinc-100 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Streak Freezes &amp; Mandatory 7-Day Recharge Cooldown</span>
                </strong>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                  When a streak freeze is available in your account balance, it will automatically shield your streak against a missed day. Once a freeze is consumed, it recharges only after you complete <strong>7 consecutive qualifying calendar days</strong> without missing tasks.
                </p>
              </div>

              <div className="p-3.5 bg-dark-surface/50 rounded-xl border border-dark-border">
                <strong className="text-zinc-100 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Points Gamification &amp; Zero Monetary Value</span>
                </strong>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                  Users earn +5 points for each scheduled habit completed on time and forfeit -5 points for missed scheduled daily habits. StreakUp points exist solely for motivational gamification and leaderboard rank. Points possess <strong>zero cash value</strong>, are non-transferable, and cannot be redeemed for legal currency or merchandise.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                04
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Social Features, Mutual Groups &amp; Public Visibility</h2>
            </div>
            <p>
              StreakUp includes peer-to-peer friend connections, public profiles, and group accountability spaces:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Public Profiles &amp; Friend Insights:</strong> When other users visit your public profile or mutual friends view the Friends leaderboard, your display name, username, current streak, longest streak, unlocked milestone badges, and total completion count are visible.
              </li>
              <li>
                <strong className="text-zinc-200">Group Roles &amp; Transfer of Ownership:</strong> Group creators hold the role of Group Owner. Group Owners may promote members to Group Admin, approve join requests, or remove members. If a Group Owner permanently deletes their account, group ownership automatically transfers to the next earliest active member to ensure community continuity.
              </li>
              <li>
                <strong className="text-zinc-200">Community Respect:</strong> You agree not to post, submit, or transmit any content in habit titles, descriptions, study reflections, group chats, or usernames that is defamatory, harassing, sexually explicit, hateful, abusive, or in violation of applicable laws.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                05
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Client-Side App Lock PIN &amp; Device Integrity</h2>
            </div>
            <p>
              The optional 4-digit App Lock security screen is executed entirely within your client device using the Web Crypto API. Cryptographic hashes of your PIN and security answers reside strictly in local storage. While it protects your active session from casual physical snooping, you acknowledge that it does not replace backend credential security. Clearing your browser cookies or application data resets the local PIN without impacting your server account.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                06
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Android Home Screen Widget &amp; Native Capabilities</h2>
            </div>
            <p>
              StreakUp provides an Android home-screen widget displaying real-time task fractions and contextual motivational messages. Background updates are coordinated through Android WorkManager and AlarmManager, subject to Android battery optimization policies. Photo gallery access is invoked strictly when you explicitly tap to download streak cards or badge achievements.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                07
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Prohibited Conduct &amp; Abuse Prevention</h2>
            </div>
            <p>You agree not to engage in any of the following unauthorized activities:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-rose-500/20 text-rose-200 flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Automated botting, script executions, or simulated task completions to spoof streaks or leaderboards.</span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-rose-500/20 text-rose-200 flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Reverse engineering, decompiling, or attempting to extract source code from client applications or APIs.</span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-rose-500/20 text-rose-200 flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Attempting to probe, scan, or bypass authentication controls, rate limits, or administrative boundaries.</span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-rose-500/20 text-rose-200 flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Scraping user profiles, harvest email addresses, or flooding servers with denial-of-service traffic.</span>
              </div>
            </div>
            <p className="text-xs text-rose-400 pt-1">
              Violations will result in immediate forfeiture of streaks and points, temporary account suspension, or permanent termination without prior notice.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                08
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Intellectual Property Rights</h2>
            </div>
            <p>
              The StreakUp name, logo, graphic designs, 3D milestone badge graphics, user interface layouts, streak algorithms, and proprietary software code are the exclusive intellectual property of StreakUp. You retain ownership of your user-submitted text and study reflections, granting StreakUp a non-exclusive, worldwide, royalty-free license to host, display, and process your content solely for operating the Service.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                09
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Account Termination &amp; 10-Day Recovery Policy</h2>
            </div>
            <p>
              You may terminate your account at any time via <strong className="text-zinc-200">Settings &gt; Danger Zone &gt; Delete Account</strong>. When initiated, your account enters a 10-day recovery grace period, during which it is deactivated and hidden from public leaderboards. If unrecovered after 10 days, your account and all associated habit data, completion logs, streaks, and friendships are permanently purged from database tables.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                10
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Disclaimers &amp; Limitation of Liability</h2>
            </div>
            <p>
              StreakUp is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express, implied, or statutory. StreakUp is a productivity habit-tracking utility. It is <strong>not a medical, psychological, psychiatric, or health advisory service</strong>.
            </p>
            <p className="text-xs text-dark-muted">
              To the fullest extent permitted by law, StreakUp and its contributors shall not be liable for any indirect, punitive, incidental, special, or consequential damages resulting from your use of or inability to access the Service, including but not limited to missed notifications, lost streaks, or third-party mail server latency.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                11
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Governing Law &amp; Dispute Resolution</h2>
            </div>
            <p>
              These Terms shall be interpreted and governed in accordance with applicable laws. In the event of any disagreement or dispute, you agree to first contact StreakUp support to pursue an informal resolution before initiating formal proceedings.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-4 p-5 bg-zinc-900/70 rounded-2xl border border-zinc-800 text-xs">
            <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-flame-400" />
              <span>Contact for Legal Inquiries</span>
            </h3>
            <p className="text-dark-muted leading-relaxed">
              For legal inquiries, formal notices, or questions regarding these Terms &amp; Conditions, please contact:
            </p>
            <div className="font-mono text-xs text-zinc-300 space-y-1.5 pt-2">
              <div>&bull; Electronic Mail: <a href="mailto:support@streakup.app" className="text-flame-400 hover:underline">support@streakup.app</a></div>
              <div>&bull; In-App Feedback: Settings &gt; Feedback &amp; Requests</div>
              <div>&bull; Platform Operator: StreakUp Habit &amp; Productivity Systems</div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-dark-muted pt-4 border-t border-dark-border gap-3">
          <p>&copy; {new Date().getFullYear()} StreakUp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/dashboard" className="text-zinc-400 hover:text-zinc-200">
              Dashboard
            </Link>
            <span>&bull;</span>
            <Link to="/settings" className="text-zinc-400 hover:text-zinc-200">
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
