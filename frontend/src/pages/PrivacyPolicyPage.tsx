import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  Trash2,
  Database,
  Smartphone,
  CheckCircle2,
  UserCheck,
  RefreshCw,
  Mail,
  Award,
  Bell,
} from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
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
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold">
              Version 2.0 (Authoritative)
            </span>
            <span>Last Updated: November 2026</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy & Data Protection Policy</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-100 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            This comprehensive Privacy Policy governs the collection, processing, storage, and protection of personal data across the StreakUp web application, progressive web app (PWA), Android application, home-screen widget, and related administrative systems.
          </p>
        </div>

        {/* Summary Guarantee Callout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <Eye className="w-5 h-5 text-flame-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">Zero Data Brokerage</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                We never sell, rent, license, or monetize your personal information or habit data to third parties.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">Airtight Encryption</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                Passwords are salted and hashed using bcrypt. Network traffic is encrypted with TLS 1.3 in transit.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-dark-card border border-dark-border/80 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">On-Device PIN Vault</h4>
              <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                App Lock 4-digit PINs are hashed locally via Web Crypto API and never uploaded to our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-panel space-y-10 text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                01
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Scope & Agreement</h2>
            </div>
            <p>
              By accessing, registering with, or utilizing StreakUp (the &ldquo;Service&rdquo;, &ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), you expressly acknowledge and consent to the data practices described herein. This policy applies uniformly to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>The responsive web portal hosted across StreakUp domains.</li>
              <li>The native Android application built with modern Capacitor runtimes.</li>
              <li>The StreakUp Android Home Screen Widget (2x2 compact and flexible sizes).</li>
              <li>Our secured REST API servers and PostgreSQL database clusters.</li>
            </ul>
            <p>
              If you do not agree with any provision of this Privacy Policy, you must refrain from creating an account or accessing the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                02
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Information We Collect</h2>
            </div>
            <p>
              StreakUp collects only the categories of information strictly required to deliver accurate habit tracking, streak verification, community competition, and account integrity:
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-flame-400" />
                  <span>A. Direct Account Identity & Authentication Credentials</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  During account registration, we collect your display name, unique username (along with a normalized, lowercase representation for case-insensitive resolution), and email address. <strong className="text-zinc-200">Plaintext passwords are never stored, logged, or visible to system administrators.</strong> Passwords are cryptographically salted and hashed using bcrypt (10 rounds) prior to database persistence. Account activation requires completing 6-digit email OTP verification.
                </p>
              </div>

              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>B. Habit Definitions, Subtasks & Completion Records</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  To provide daily tracking, we store habit titles, descriptions, custom subtasks, urgency/priority tiers, scheduling recurrences (Daily, Weekdays, Weekends, or Custom Days), and completion timestamps. When you complete a task, you may optionally attach personal study reflections or completion notes, which are stored securely and visible to you and members of mutual accountability groups.
                </p>
              </div>

              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>C. Streak Calculations, Badges & Gamification Ledger</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  StreakUp maintains algorithmic streak metrics: current unbroken consecutive streak count, all-time record longest streak, milestone badges unlocked (25d, 50d, 75d, 100d, 150d, 200d, 250d, 300d, 365d / 1 Year, 730d / 2 Year, 1095d / 3 Year), streak freeze token balance, freeze cooldown logs (7 consecutive active days to recharge), and an audited points ledger (+5 points earned per scheduled completion, -5 points deducted for uncompleted habits) powering global and friends leaderboards.
                </p>
              </div>

              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  <span>D. Timezone & Temporal Configuration</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  We store your configured IANA timezone (e.g. <code className="font-mono text-zinc-200">Asia/Kolkata</code>, <code className="font-mono text-zinc-200">America/New_York</code>). This is essential for calculating local calendar day transitions, reverse midnight countdowns, daily task resets, and scheduled notification dispatches accurately according to your local wall-clock time.
                </p>
              </div>

              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>E. Client-Side App Lock PIN & Security Recovery</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  If you enable the optional 4-digit App Lock security PIN, your PIN and recovery security answer are salted with a 16-byte cryptographically random salt and hashed using SHA-256 via the browser&apos;s Web Crypto API. <strong className="text-emerald-300">These cryptographic hashes reside exclusively inside your device&apos;s local storage and are never transmitted to our servers or network logs.</strong>
                </p>
              </div>

              <div className="p-4 bg-dark-surface/50 rounded-2xl border border-dark-border">
                <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-400" />
                  <span>F. Android Native Widget & Device Permissions</span>
                </h3>
                <p className="text-xs text-dark-muted mt-2 leading-relaxed">
                  The Android home-screen widget reads your non-sensitive aggregate statistics (current streak number, today&apos;s completed vs. total task ratio, and contextual motivational message) via local Android SharedPreferences updated through authenticated background workers. StreakUp does not access your physical location, contacts, camera, or SMS messages. Storage permissions are requested exclusively when you explicitly choose to download celebratory streak badges or cards to your device&apos;s photo gallery.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                03
              </span>
              <h2 className="text-xl font-bold text-zinc-100">How We Use Your Information</h2>
            </div>
            <p>We process collected data under the following legitimate and contractual purposes:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Authentication & Session Security:</strong> Validating login credentials, managing signed JSON Web Tokens (JWT), and preventing unauthorized credential stuffing.
                </span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Streak Engine & Time Calculations:</strong> Ensuring accurate daily tracking based on local calendar midnight boundaries without timezone distortion.
                </span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Critical Transactional Emails:</strong> Delivering one-time passwords (OTP) for account verification, password resets, email change verifications, and optional daily streak reminders.
                </span>
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-zinc-200">Social Motivation & Group Accountability:</strong> Displaying friend streaks, joint group challenges, study reflections, and interactive emoji reactions.
                </span>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                04
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Third-Party Infrastructure & Sub-processors</h2>
            </div>
            <p>
              We partner exclusively with reputable infrastructure providers who maintain enterprise security standards:
            </p>
            <div className="divide-y divide-dark-border/60 border border-dark-border rounded-2xl bg-dark-surface/30 overflow-hidden text-xs">
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-zinc-200">Frontend Application Hosting</strong>
                  <p className="text-dark-muted">Vercel Inc. &bull; Global edge delivery of static assets and client web bundles.</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">Encrypted HTTPS CDN</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-zinc-200">API Server Runtime</strong>
                  <p className="text-dark-muted">Render Services Inc. &bull; Isolated containerized Node.js backend execution.</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">Isolated VPC</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-zinc-200">Relational Database Storage</strong>
                  <p className="text-dark-muted">PostgreSQL Database Clusters &bull; Managed cloud persistence with automated backups.</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">SSL / TLS at Rest</span>
              </div>
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-zinc-200">Transactional Email Dispatches</strong>
                  <p className="text-dark-muted">SMTP Mail Servers (Nodemailer) &bull; Verification codes, password links, reminders.</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">STARTTLS Encrypted</span>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                05
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Data Retention & Automatic Pruning Policy</h2>
            </div>
            <p>
              To maintain optimal database performance, reduce storage overhead, and uphold privacy by design, StreakUp enforces strict data lifecycle rules:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">In-App Notifications (15-Day Pruning):</strong> Standard in-app notifications are automatically pruned 15 days following creation. Users may preserve up to 15 important notifications indefinitely by clicking the star icon to archive them in their Starred Notifications vault.
              </li>
              <li>
                <strong className="text-zinc-200">Heatmap & Activity Records (365-Day Minimum):</strong> Activity logs and daily habit ticks are preserved for a minimum of 365 rolling calendar days to guarantee unbroken yearly habit visualization, milestone verification, and annual badge entitlement.
              </li>
              <li>
                <strong className="text-zinc-200">Administrative Audit Logs (15-Day Pruning):</strong> All privileged administrative actions recorded in the audit ledger are automatically purged after 15 days.
              </li>
              <li>
                <strong className="text-zinc-200">Soft-Deleted Accounts (10-Day Grace Period):</strong> When a user initiates account deletion, the account enters a 10-day recovery grace period to prevent accidental loss or malicious takeovers. During this window, habits are deactivated and hidden from public leaderboards. After 10 days, records are permanently purged from database tables.
              </li>
            </ul>

            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs text-rose-300 flex items-start gap-3 mt-4">
              <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-200 text-sm">Right to Erasure (Permanent Account Deletion)</strong>
                <p className="mt-1 leading-relaxed text-rose-300/90">
                  You have the unequivocal right to delete your account at any time by navigating to <span className="font-semibold text-rose-100">Settings &gt; Danger Zone &gt; Delete Account</span>. Deletion permanently erases your account record, habits, subtasks, completion logs, streaks, point tallies, study notes, friend connections, and notification preferences. If you own active groups, ownership is automatically transferred to the next earliest member.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                06
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Security Architecture & Technical Safeguards</h2>
            </div>
            <p>We deploy robust multi-layered security controls to protect your data:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border">
                <strong className="text-zinc-200">Bcrypt Password Hashing:</strong> Passwords are cryptographically hashed using salted bcrypt with 10 cost iterations. Plaintext passwords never enter database queries.
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border">
                <strong className="text-zinc-200">TLS 1.3 Encryption:</strong> All HTTP transactions between your browser/app and our API endpoints are encrypted with modern TLS ciphers.
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border">
                <strong className="text-zinc-200">Strict RBAC & Audit Trails:</strong> Platform operations enforce rigorous role-based access control with secondary sensitive PIN verification for high-impact actions.
              </div>
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border">
                <strong className="text-zinc-200">Rate Limiting & Cooldowns:</strong> Authentication endpoints, OTP generation, and profile changes enforce strict cooldowns (e.g. 14 days for username changes) to prevent brute-force attacks.
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                07
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Children&apos;s Privacy</h2>
            </div>
            <p>
              StreakUp is not targeted toward or designed for use by individuals under the age of 13 (or under 16 where required by local applicable jurisdiction). We do not knowingly collect, store, or solicit personal data from children. If we become aware that a child under the requisite age has registered an account, we will immediately take steps to permanently delete the account and associated records.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                08
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Your Legal Rights & Choices</h2>
            </div>
            <p>Depending on your jurisdiction, you possess the following rights regarding your data:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-zinc-200">Right of Access:</strong> You can review your profile, tasks, completions, and account metrics at any time inside the app.</li>
              <li><strong className="text-zinc-200">Right to Rectification:</strong> You can update your display name, avatar, timezone, and username directly within Account Settings.</li>
              <li><strong className="text-zinc-200">Right to Erasure:</strong> You can permanently purge individual tasks, unstar notifications, or delete your entire account.</li>
              <li><strong className="text-zinc-200">Right to Opt-Out of Communications:</strong> You can configure notification preferences to disable optional email reminders at any time.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-flame-500/10 border border-flame-500/30 text-flame-400 font-mono text-xs font-bold">
                09
              </span>
              <h2 className="text-xl font-bold text-zinc-100">Updates to This Policy</h2>
            </div>
            <p>
              We may revise this Privacy Policy periodically to reflect changes in our legal obligations or application features. Material modifications will be announced prominently via platform announcements or direct email notices. Continued use of StreakUp following such notices constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4 p-5 bg-zinc-900/70 rounded-2xl border border-zinc-800 text-xs">
            <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-flame-400" />
              <span>Contact & Data Protection Inquiries</span>
            </h3>
            <p className="text-dark-muted leading-relaxed">
              For questions, privacy requests, or data protection concerns regarding StreakUp, please reach out to our team:
            </p>
            <div className="font-mono text-xs text-zinc-300 space-y-1.5 pt-2">
              <div>&bull; Electronic Mail: <a href="mailto:streakup.web@gmail.com" className="text-flame-400 hover:underline">streakup.web@gmail.com</a></div>
              <div>&bull; In-App Feedback: Accessible via Settings &gt; Feedback &amp; Requests</div>
              <div>&bull; Platform Operator: StreakUp Habit &amp; Productivity Systems</div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-dark-muted pt-4 border-t border-dark-border gap-3">
          <p>&copy; {new Date().getFullYear()} StreakUp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-flame-400 hover:text-flame-300 font-semibold hover:underline">
              Terms &amp; Conditions
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

export default PrivacyPolicyPage;
