import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Trash2, ShieldAlert } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
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
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy & Data Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-100 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-dark-muted leading-relaxed">
            This Privacy Policy explains how StreakUp collects, uses, stores, and protects your personal information in accordance with our actual technical architecture.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-panel space-y-8 text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">01.</span> Overview & Core Principles
            </h2>
            <p>
              StreakUp (&ldquo;we&rdquo;, &ldquo;our&rdquo;) is built on the principle of transparency. We collect only the data necessary to provide habit tracking, streak calculations, social motivation, and secure account access.
            </p>
            <div className="p-3.5 bg-dark-surface/60 rounded-xl border border-dark-border text-xs text-zinc-300 flex items-start gap-2.5">
              <Eye className="w-4 h-4 text-flame-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-zinc-100">Zero Data Brokerage:</strong> We do not sell your personal data, rent user lists, or embed third-party advertising trackers (such as Google AdSense or Meta Pixel).
              </span>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">02.</span> Information We Collect
            </h2>
            <p>When you register and use StreakUp, we collect the following categories of information:</p>

            <div className="space-y-3">
              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border/80">
                <h3 className="font-bold text-zinc-200 text-xs">A. Account Credentials</h3>
                <p className="text-xs text-dark-muted mt-1">
                  Display name, unique username (and normalized lowercase username), email address, and your password. <strong className="text-zinc-300">Passwords are never stored in plaintext</strong>; they are cryptographically salted and hashed using bcrypt before storage.
                </p>
              </div>

              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border/80">
                <h3 className="font-bold text-zinc-200 text-xs">B. Profile & Timezone Settings</h3>
                <p className="text-xs text-dark-muted mt-1">
                  Your configured IANA timezone (e.g. <code className="text-zinc-300 font-mono">Asia/Kolkata</code>), used to calculate local calendar day transitions and reverse midnight countdowns, and an optional profile picture (stored as an optimized Base64 data URI).
                </p>
              </div>

              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border/80">
                <h3 className="font-bold text-zinc-200 text-xs">C. Habit, Completion & Milestone Data</h3>
                <p className="text-xs text-dark-muted mt-1">
                  Task titles, descriptions, categories, priorities, recurrence schedules, completion dates, study notes, streak counters, streak freeze logs, and point ledger entries (+5/-5 point events).
                </p>
              </div>

              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border/80">
                <h3 className="font-bold text-zinc-200 text-xs">D. Social Interactions & Groups</h3>
                <p className="text-xs text-dark-muted mt-1">
                  Friend requests, friendships, group memberships, and emoji reactions (&apos;FIRE&apos;, &apos;STRONG&apos;, &apos;CLAP&apos;, &apos;CELEBRATE&apos;) on completions.
                </p>
              </div>

              <div className="p-3 bg-dark-surface/40 rounded-xl border border-dark-border/80">
                <h3 className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-flame-400" />
                  <span>E. Client-Side App Lock PIN & Recovery Data</span>
                </h3>
                <p className="text-xs text-dark-muted mt-1">
                  If you enable the optional App Lock, your 4-digit PIN and security answer are salted with a 16-byte cryptographically secure random salt and hashed using SHA-256 via the Web Crypto API. <strong className="text-zinc-300">These hashes are stored strictly in your device&apos;s browser local storage and are never sent to our servers.</strong>
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">03.</span> How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>To authenticate your sessions, maintain persistent device login, and prevent unauthorized access.</li>
              <li>To accurately determine habit streaks and midnight reset times using your local timezone.</li>
              <li>To send critical transactional emails: 6-digit signup OTPs, password reset links, email change confirmations, and optional scheduled streak reminders.</li>
              <li>To display community and friend leaderboards and calculate streak freeze recharges.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">04.</span> Hosting & Third-Party Service Providers
            </h2>
            <p>
              We rely on trusted cloud infrastructure to securely run StreakUp:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Frontend Hosting:</strong> Vercel (serves the static web application and PWA assets).
              </li>
              <li>
                <strong className="text-zinc-200">Backend Server:</strong> Render (hosts our Node.js/Express API server).
              </li>
              <li>
                <strong className="text-zinc-200">Database Hosting:</strong> PostgreSQL hosted on cloud database infrastructure (Supabase / Render) with encrypted connections.
              </li>
              <li>
                <strong className="text-zinc-200">Email Delivery:</strong> SMTP mail servers (via Nodemailer) for dispatching verification codes and streak notifications.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">05.</span> Data Retention & Permanent Deletion
            </h2>
            <p>
              We retain your account data for as long as your account remains active. Operational data is retained according to the following policies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">In-App Notifications:</strong> To ensure high system performance and prevent unnecessary data accumulation, read in-app notifications are automatically pruned 15 days after creation. Users may star up to 15 key notifications to retain them indefinitely in their Starred Notifications archive.
              </li>
              <li>
                <strong className="text-zinc-200">Habit & Streak History:</strong> Your active tasks, streak records, completion logs, and leaderboard points are preserved until manually edited or deleted by you.
              </li>
            </ul>
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-200">One-Click Permanent Deletion:</strong> You can permanently delete your account at any time by navigating to <span className="font-semibold text-rose-100">Settings &gt; Danger Zone &gt; Delete Account</span>. This permanently deletes your user record, habits, completion logs, streaks, points, study notes, friend associations, and notification schedules from our database.
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-flame-500 font-mono text-sm">06.</span> Security Practices
            </h2>
            <p>
              We implement industry-standard safeguards including HTTPS encryption in transit, bcrypt password hashing with salt, cryptographically salted SHA-256 for local PINs, JWT authentication tokens with signature verification, and database-level cascading deletes.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 text-xs">
            <h3 className="font-bold text-zinc-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Contact & Supervisory Details</span>
            </h3>
            <p className="text-dark-muted leading-relaxed">
              If you have any questions or data requests regarding this Privacy Policy, please contact:
            </p>
            <div className="font-mono text-[11px] text-zinc-400 space-y-1 pt-1">
              <div>&bull; Privacy Officer / Developer: <span className="text-amber-300/90">[Developer / Legal Entity Name - Pending Confirmation]</span></div>
              <div>&bull; Privacy Inquiries: <span className="text-amber-300/90">[privacy@streakup.app - Pending Confirmation]</span></div>
              <div>&bull; Operating Jurisdiction: <span className="text-amber-300/90">[Jurisdiction - Pending Confirmation]</span></div>
            </div>
          </section>
        </div>

        {/* Footer Link to Terms */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-dark-muted pt-4 border-t border-dark-border gap-3">
          <p>&copy; {new Date().getFullYear()} StreakUp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-flame-400 hover:text-flame-300 font-semibold hover:underline">
              Terms & Conditions
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
