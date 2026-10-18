import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

export const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-6 border-b border-dark-border">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-flame-400 py-2 px-3 rounded-xl hover:bg-dark-card border border-transparent hover:border-dark-border transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-dark-muted">
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-semibold">
              Version 1.0
            </span>
            <span>Effective: October 2026</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-flame-500 bg-flame-500/10 px-3 py-1 rounded-full border border-flame-500/20">
            <FileText className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-100 tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-sm text-dark-muted leading-relaxed">
            Please read these Terms & Conditions carefully before using the StreakUp platform, application, or services.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-panel space-y-8 text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">01.</span> Acceptance of Terms
            </h2>
            <p>
              By accessing, registering for, or using StreakUp (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;), you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree, you must not access or use the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">02.</span> Eligibility & Account Registration
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Account Accuracy:</strong> You agree to provide a valid email address, display name, and unique username. Account activation requires completing 6-digit email OTP verification.
              </li>
              <li>
                <strong className="text-zinc-200">Credential Security:</strong> You are solely responsible for safeguarding your login password and your local 4-digit App Lock PIN. You must notify us immediately of any unauthorized access.
              </li>
              <li>
                <strong className="text-zinc-200">Email Changes:</strong> To maintain security and prevent takeover attempts, registered email updates are subject to verification and a mandatory 14-day cooldown between changes.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">03.</span> Tasks, Streaks, Points & Freeze Mechanics
            </h2>
            <p>
              StreakUp provides habit tracking tools subject to the following operating rules:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Timezone-Based Calculation:</strong> Calendar days and midnight boundaries are calculated strictly according to your selected IANA timezone (e.g., <code className="text-zinc-300 font-mono bg-dark-surface px-1.5 py-0.5 rounded">Asia/Kolkata</code>).
              </li>
              <li>
                <strong className="text-zinc-200">Points System:</strong> Users earn points for completing scheduled daily habits (+5 points per completion) and lose points for uncompleted scheduled daily habits (-5 points). Points power leaderboard standings and cannot be redeemed for monetary value.
              </li>
              <li>
                <strong className="text-zinc-200">Streak Freezes:</strong> Freeze tokens automatically protect qualifying broken streaks when available. Freeze tokens recharge only after completing 7 consecutive qualifying days following use.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">04.</span> Social Features, Groups & Acceptable Conduct
            </h2>
            <p>
              StreakUp offers peer-to-peer social connections, shared group challenges, study notes, and emoji reactions:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Public Visibility:</strong> When you accept friend requests or join groups, other members may see your habit completion status, study notes, streaks, points, and leaderboard rank.
              </li>
              <li>
                <strong className="text-zinc-200">In-App Notifications & Archive:</strong> To optimize system resources, read in-app notifications are automatically deleted 15 days following receipt, unless saved to your Starred archive (maximum 15 starred notifications per account).
              </li>
              <li>
                <strong className="text-zinc-200">Acceptable Content:</strong> You may not use offensive, vulgar, defamatory, threatening, or illegal text in display names, usernames, habit titles, study notes, or group descriptions.
              </li>
              <li>
                <strong className="text-zinc-200">Platform Abuse:</strong> Automated scraping, botting completions to manipulate leaderboards, exploiting bugs, or attempting denial-of-service attacks is strictly prohibited and grounds for immediate account termination.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">05.</span> Client-Side App Lock Feature
            </h2>
            <p>
              The optional 4-digit App Lock PIN feature is a client-side convenience security mechanism executed locally within your device browser. Plaintext PINs and security answers are hashed using SHA-256 with cryptographic salting and stored strictly in your device&apos;s local storage. While it protects against casual on-device snooping, you acknowledge that it does not replace backend server authorization or strong login passwords.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">06.</span> Account Termination & Permanent Data Deletion
            </h2>
            <p>
              You have the right to permanently delete your account at any time through <strong className="text-zinc-200">Settings &gt; Danger Zone</strong>. Deletion permanently erases your user profile, habit history, streaks, points, study notes, and friend links. Any active groups you own will transfer ownership to the next earliest member. StreakUp reserves the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">07.</span> Disclaimers & Limitation of Liability
            </h2>
            <p>
              StreakUp is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind. We do not warrant that the service will be uninterrupted, error-free, or that email reminders will be delivered without delay by third-party mail servers. StreakUp is a productivity and habit tracking tool, not a medical, psychiatric, or fitness advisory service.
            </p>
          </section>

          {/* Section 8: Legal Notices & Pending Confirmation */}
          <section className="space-y-3 p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 text-xs">
            <h3 className="font-bold text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Entity & Jurisdiction Information</span>
            </h3>
            <p className="text-dark-muted leading-relaxed">
              StreakUp is operated as an independent software application. The legal entity, operating jurisdiction, and primary contact address are subject to formal confirmation:
            </p>
            <div className="font-mono text-[11px] text-zinc-400 space-y-1 pt-1">
              <div>&bull; Operating Entity: <span className="text-amber-300/90">[Developer / Entity Legal Name - Pending Confirmation]</span></div>
              <div>&bull; Contact Email: <span className="text-amber-300/90">[support@streakup.app - Pending Confirmation]</span></div>
              <div>&bull; Governing Law: <span className="text-amber-300/90">[Operating Jurisdiction - Pending Confirmation]</span></div>
            </div>
          </section>
        </div>

        {/* Footer Link to Privacy Policy */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-dark-muted pt-4 border-t border-dark-border gap-3">
          <p>&copy; {new Date().getFullYear()} StreakUp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-flame-400 hover:text-flame-300 font-semibold hover:underline">
              Privacy Policy
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
