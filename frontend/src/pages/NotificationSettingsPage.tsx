import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  fetchReminderSchedules,
  createReminderSchedule,
  deleteReminderSchedule,
  sendTestEmail,
  fetchSmtpStatus,
  requestNotificationEmailOtp,
  verifyNotificationEmailOtp,
  removeNotificationEmail,
  NotificationPreference,
  ReminderScheduleItem,
} from '../api/notifications';
import { fetchTasks, Task } from '../api/tasks';
import {
  Bell,
  Mail,
  Clock,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Zap,
  Users2,
  Trophy,
  ShieldCheck,
  RotateCw,
  Check,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const NotificationSettingsPage: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [defaultEmail, setDefaultEmail] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [isSmtpConfigured, setIsSmtpConfigured] = useState<boolean>(false);
  const [smtpStatusMsg, setSmtpStatusMsg] = useState<string>('');

  const [schedules, setSchedules] = useState<ReminderScheduleItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [overallNewTime, setOverallNewTime] = useState<string>('08:00');
  const [taskSelectedId, setTaskSelectedId] = useState<string>('');
  const [taskNewTime, setTaskNewTime] = useState<string>('19:00');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [prefRes, schedRes, tasksRes, smtpRes] = await Promise.all([
        fetchNotificationPreferences(),
        fetchReminderSchedules(),
        fetchTasks({ status: 'ACTIVE' }),
        fetchSmtpStatus(),
      ]);

      if (prefRes.success) {
        setPreferences(prefRes.preferences);
        setDefaultEmail(prefRes.defaultEmail);
        setTimezone(prefRes.timezone || 'Asia/Kolkata');
      }

      if (schedRes.success) {
        setSchedules(schedRes.schedules);
      }

      if (tasksRes.success) {
        const recurring = (tasksRes.tasks || []).filter((t) => t.recurrence === 'DAILY');
        setTasks(recurring);
        if (recurring.length > 0 && !taskSelectedId) {
          setTaskSelectedId(recurring[0].id);
        }
      }

      if (smtpRes.success) {
        setIsSmtpConfigured(smtpRes.isConfigured);
        setSmtpStatusMsg(smtpRes.message || (smtpRes.isConfigured ? 'Ready to deliver' : 'Not configured'));
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleTogglePreference = async (key: keyof NotificationPreference) => {
    if (!preferences) return;
    const newValue = !preferences[key];
    const updated = { ...preferences, [key]: newValue };
    setPreferences(updated);

    try {
      await updateNotificationPreferences({ [key]: newValue });
      showFeedback('Preferences updated.');
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to update preferences'), 'error');
      // Revert on error
      setPreferences(preferences);
    }
  };

  const [notifEmailStep, setNotifEmailStep] = useState<'idle' | 'input' | 'verify'>('idle');
  const [notifEmailInput, setNotifEmailInput] = useState<string>('');
  const [notifEmailOtp, setNotifEmailOtp] = useState<string>('');
  const [notifOtpCooldown, setNotifOtpCooldown] = useState<number>(0);
  const [isVerifyingNotifEmail, setIsVerifyingNotifEmail] = useState<boolean>(false);

  useEffect(() => {
    if (notifOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setNotifOtpCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [notifOtpCooldown]);

  const handleRequestNotifEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifEmailInput.trim()) return;
    setIsVerifyingNotifEmail(true);

    try {
      const res = await requestNotificationEmailOtp(notifEmailInput.trim());
      if (res.success) {
        setNotifEmailStep('verify');
        setNotifOtpCooldown(60);
        showFeedback(res.message);
      } else {
        showFeedback(res.error || 'Failed to send code.', 'error');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to send verification code'), 'error');
    } finally {
      setIsVerifyingNotifEmail(false);
    }
  };

  const handleVerifyNotifEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (notifEmailOtp.trim().length !== 6) {
      showFeedback('Please enter the 6-digit verification code.', 'error');
      return;
    }
    setIsVerifyingNotifEmail(true);

    try {
      const res = await verifyNotificationEmailOtp(notifEmailInput.trim(), notifEmailOtp.trim());
      if (res.success) {
        setPreferences(res.preferences);
        setNotifEmailStep('idle');
        setNotifEmailInput('');
        setNotifEmailOtp('');
        showFeedback('Notification email verified and activated!');
      } else {
        showFeedback(res.error || 'Verification failed.', 'error');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to verify code'), 'error');
    } finally {
      setIsVerifyingNotifEmail(false);
    }
  };

  const handleResendNotifOtp = async () => {
    if (notifOtpCooldown > 0 || isVerifyingNotifEmail) return;
    setIsVerifyingNotifEmail(true);

    try {
      const res = await requestNotificationEmailOtp(notifEmailInput.trim());
      if (res.success) {
        setNotifOtpCooldown(60);
        showFeedback(`A new verification code was sent to ${notifEmailInput.trim()}`);
      } else {
        showFeedback(res.error || 'Failed to resend code.', 'error');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to resend code'), 'error');
    } finally {
      setIsVerifyingNotifEmail(false);
    }
  };

  const handleRemoveNotifEmail = async () => {
    setIsVerifyingNotifEmail(true);
    try {
      const res = await removeNotificationEmail();
      if (res.success) {
        setPreferences(res.preferences);
        setNotifEmailStep('idle');
        showFeedback('Custom notification email removed. Reminders will go to your registered email.');
      } else {
        showFeedback(res.error || 'Failed to remove custom email.', 'error');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to remove custom notification email'), 'error');
    } finally {
      setIsVerifyingNotifEmail(false);
    }
  };

  const handleAddOverallReminder = async () => {
    if (!overallNewTime) return;
    try {
      const res = await createReminderSchedule({
        scope: 'OVERALL',
        time: overallNewTime,
      });
      if (res.success) {
        setSchedules((prev) => [...prev, res.schedule]);
        showFeedback(`Added overall streak reminder at ${res.schedule.time}`);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to add reminder time'), 'error');
    }
  };

  const handleAddTaskReminder = async () => {
    if (!taskSelectedId || !taskNewTime) return;
    try {
      const res = await createReminderSchedule({
        scope: 'TASK',
        taskId: taskSelectedId,
        time: taskNewTime,
      });
      if (res.success) {
        setSchedules((prev) => [...prev, res.schedule]);
        showFeedback(`Added task reminder at ${res.schedule.time}`);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to add task reminder time'), 'error');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await deleteReminderSchedule(id);
      if (res.success) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        showFeedback('Reminder time removed.');
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to remove reminder time'), 'error');
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const res = await sendTestEmail();
      if (res.success) {
        showFeedback(res.message);
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to send test email'), 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const overallSchedules = schedules.filter((s) => s.scope === 'OVERALL');

  if (isLoading || !preferences) {
    return (
      <div className="py-24 text-center text-xs text-dark-muted">
        <div className="inline-flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          Loading notification preferences...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div>
        <Link
          to="/notifications"
          className="inline-flex items-center gap-1.5 text-xs text-dark-muted hover:text-zinc-200 font-mono transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Notification Center
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
          <Bell className="w-7 h-7 text-flame-500" />
          Notification Preferences & Reminders
        </h1>
        <p className="text-xs sm:text-sm text-dark-muted mt-1">
          Customize your daily email reminder schedules, friend activity alerts, and milestone updates
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* SECTION 1: Delivery Channels & Email Destination */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-6">
        <div className="flex items-center justify-between border-b border-dark-border pb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-flame-500" />
              Delivery Channels & Destination
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-dark-muted">
                Timezone: <span className="font-mono text-zinc-200 font-semibold">{timezone}</span>
              </span>
              <span className="text-zinc-600 hidden sm:inline">•</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isSmtpConfigured
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {isSmtpConfigured ? 'SMTP Configured' : 'SMTP Off'}
                {smtpStatusMsg && ` (${smtpStatusMsg})`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
              className="px-3.5 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs font-bold text-zinc-300 rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-flame-400" />
              {isSendingTest ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {/* Master Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-100">Email Notifications</div>
              <div className="text-[11px] text-dark-muted">Receive reminder emails in your inbox</div>
            </div>
            <button
              onClick={() => handleTogglePreference('emailNotificationsEnabled')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.emailNotificationsEnabled ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.emailNotificationsEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-100">In-App Notifications</div>
              <div className="text-[11px] text-dark-muted">Show updates in your Notification Center</div>
            </div>
            <button
              onClick={() => handleTogglePreference('inAppNotificationsEnabled')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.inAppNotificationsEnabled ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.inAppNotificationsEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Destination Email Section */}
        <div className="pt-2 border-t border-dark-border space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <label className="block text-xs font-bold text-zinc-200">
                Notification Destination Email
              </label>
              <p className="text-[11px] text-dark-muted mt-0.5">
                Route habit reminders and friend updates to a specific inbox without changing your registered login email.
              </p>
            </div>
            {preferences.customNotificationEmail && preferences.isCustomEmailVerified ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3" />
                Verified Custom Inbox
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                Default Account Email
              </span>
            )}
          </div>

          {notifEmailStep === 'idle' ? (
            <div className="flex items-center justify-between p-3.5 bg-dark-surface/60 rounded-xl border border-dark-border gap-3 flex-wrap">
              <div className="text-xs text-zinc-300">
                Current destination:{' '}
                <strong className="font-mono text-zinc-100">
                  {preferences.customNotificationEmail && preferences.isCustomEmailVerified
                    ? preferences.customNotificationEmail
                    : defaultEmail}
                </strong>
                {!(preferences.customNotificationEmail && preferences.isCustomEmailVerified) && (
                  <span className="text-[11px] text-zinc-500 ml-1.5">(Registered email)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {preferences.customNotificationEmail && preferences.isCustomEmailVerified && (
                  <button
                    type="button"
                    onClick={handleRemoveNotifEmail}
                    disabled={isVerifyingNotifEmail}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors font-medium"
                  >
                    Revert to Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNotifEmailStep('input');
                    setNotifEmailInput('');
                    setNotifEmailOtp('');
                  }}
                  className="px-3.5 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs font-bold text-zinc-200 hover:text-flame-400 rounded-lg transition-colors"
                >
                  {preferences.customNotificationEmail && preferences.isCustomEmailVerified
                    ? 'Change Custom Email'
                    : 'Set Custom Notification Email'}
                </button>
              </div>
            </div>
          ) : notifEmailStep === 'input' ? (
            <form onSubmit={handleRequestNotifEmailOtp} className="p-4 bg-dark-surface/40 rounded-2xl border border-dark-border space-y-3 max-w-lg">
              <label className="block text-xs font-semibold text-zinc-300">
                Enter New Notification Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="alerts@example.com"
                  value={notifEmailInput}
                  onChange={(e) => setNotifEmailInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500"
                />
              </div>
              <p className="text-[11px] text-dark-muted">
                An OTP will be sent to this email. You can change this anytime without the 14-day login restriction.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNotifEmailStep('idle')}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingNotifEmail || !notifEmailInput.trim()}
                  className="px-4 py-1.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isVerifyingNotifEmail ? 'Sending code...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyNotifEmailOtp} className="p-4 bg-dark-surface/40 rounded-2xl border border-dark-border space-y-3 max-w-lg">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Enter 6-digit code sent to <strong className="font-mono text-zinc-100">{notifEmailInput}</strong>:</span>
                <button
                  type="button"
                  onClick={() => setNotifEmailStep('input')}
                  className="text-flame-400 hover:text-flame-300 text-xs font-semibold"
                >
                  Change
                </button>
              </div>

              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                autoFocus
                value={notifEmailOtp}
                onChange={(e) => setNotifEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full py-2.5 text-center text-xl font-mono tracking-[0.4em] bg-dark-surface border border-dark-border rounded-xl text-zinc-100 font-bold focus:outline-none focus:border-flame-500"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={notifOtpCooldown > 0 || isVerifyingNotifEmail}
                  onClick={handleResendNotifOtp}
                  className="text-xs text-zinc-400 hover:text-flame-400 disabled:opacity-40 inline-flex items-center gap-1 font-medium"
                >
                  <RotateCw className="w-3 h-3" />
                  {notifOtpCooldown > 0 ? `Resend in ${notifOtpCooldown}s` : 'Resend code'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotifEmailStep('idle')}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingNotifEmail || notifEmailOtp.length !== 6}
                    className="px-4 py-1.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {isVerifyingNotifEmail ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* SECTION 2: Daily Overall Streak Reminders (Max 3) */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-5">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Flame className="w-5 h-5 text-flame-500" />
              Overall Streak Reminders (Max 3 Times)
            </h3>
            <span className="text-xs font-mono font-bold text-flame-400 bg-flame-500/10 px-2.5 py-0.5 rounded-full border border-flame-500/20">
              {overallSchedules.length} / 3 configured
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-1">
            At each time, StreakUp checks if you completed at least 1 task on your local day. If you already completed any task, the reminder is automatically skipped!
          </p>
        </div>

        {/* Current Configured Times */}
        <div className="flex flex-wrap gap-2.5">
          {overallSchedules.length === 0 ? (
            <p className="text-xs text-dark-muted italic py-2">
              No reminder times configured. Add a daily time below.
            </p>
          ) : (
            overallSchedules.map((item) => (
              <div
                key={item.id}
                className="px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-zinc-100 shadow-sm"
              >
                <Clock className="w-3.5 h-3.5 text-flame-400" />
                <span>{item.time}</span>
                <button
                  onClick={() => handleDeleteReminder(item.id)}
                  title="Remove reminder time"
                  className="p-1 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Overall Reminder Time Form */}
        {overallSchedules.length < 3 && (
          <div className="flex items-center gap-2 pt-2 max-w-sm">
            <input
              type="time"
              value={overallNewTime}
              onChange={(e) => setOverallNewTime(e.target.value)}
              className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-flame-500"
            />
            <button
              onClick={handleAddOverallReminder}
              className="px-3.5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs font-bold text-flame-400 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Time
            </button>
          </div>
        )}
      </div>

      {/* SECTION 3: Independent Recurring Task Reminders (Max 3 per task) */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-5">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Individual Task Reminders (Max 3 per Task)
          </h3>
          <p className="text-xs text-dark-muted mt-1">
            Configure independent reminder schedules for specific recurring habits (e.g. GATE Prep at 7:00 PM, Daily LeetCode at 9:00 PM).
          </p>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-dark-muted italic">
            You don't have any active daily recurring habits yet. Create a daily task to set independent reminders.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Task selector and add form */}
            <div className="p-4 bg-dark-surface rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Select Recurring Habit
                </label>
                <select
                  value={taskSelectedId}
                  onChange={(e) => setTaskSelectedId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Reminder Time (HH:mm)
                </label>
                <input
                  type="time"
                  value={taskNewTime}
                  onChange={(e) => setTaskNewTime(e.target.value)}
                  className="px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-flame-500"
                />
              </div>

              <div className="sm:self-end">
                <button
                  onClick={handleAddTaskReminder}
                  className="w-full sm:w-auto px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task Reminder
                </button>
              </div>
            </div>

            {/* List of configured task reminder schedules */}
            <div className="space-y-2">
              {tasks.map((task) => {
                const taskScheds = schedules.filter(
                  (s) => s.scope === 'TASK' && s.taskId === task.id
                );
                if (taskScheds.length === 0) return null;

                return (
                  <div
                    key={task.id}
                    className="p-3 bg-dark-surface rounded-xl border border-dark-border flex items-center justify-between flex-wrap gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-100">{task.title}</div>
                      <div className="text-[10px] text-dark-muted font-mono">
                        {taskScheds.length} / 3 scheduled
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {taskScheds.map((sched) => (
                        <div
                          key={sched.id}
                          className="px-2.5 py-1 bg-dark-card border border-dark-border rounded-lg flex items-center gap-1.5 text-xs font-mono text-zinc-200"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{sched.time}</span>
                          <button
                            onClick={() => handleDeleteReminder(sched.id)}
                            className="p-0.5 text-zinc-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: Category Notification Toggles */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-panel space-y-4">
        <h3 className="text-base font-bold text-zinc-100">Notification Types & Triggers</h3>
        <p className="text-xs text-dark-muted">
          Control which events trigger in-app updates and emails.
        </p>

        <div className="divide-y divide-dark-border">
          {/* Friend Overall Activity */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Users2 className="w-3.5 h-3.5 text-blue-400" />
                Friend Overall Activity Alerts
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Notify me when an accepted friend finishes today's overall activity and I haven't completed any task yet
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('friendOverallActivityAlerts')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.friendOverallActivityAlerts ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.friendOverallActivityAlerts ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Friend Task Activity */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Friend Matching Task Alerts
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Notify me when an accepted friend finishes a matching habit and I haven't finished mine today
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('friendTaskActivityAlerts')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.friendTaskActivityAlerts ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.friendTaskActivityAlerts ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Friend Overall Milestones */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-purple-400" />
                Friend Overall Streak Milestones
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Notify me when a friend hits 5, 10, 25, 50, 100+ day overall milestones
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('friendOverallMilestones')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.friendOverallMilestones ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.friendOverallMilestones ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Friend Task Milestones */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-purple-400" />
                Friend Task Streak Milestones
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Notify me when a friend reaches a streak milestone on a matching task
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('friendTaskMilestones')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.friendTaskMilestones ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.friendTaskMilestones ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* My Own Milestones */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-flame-500" />
                My Own Streak Milestone Emails
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Send me a celebratory email whenever I unlock an overall or habit streak milestone
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('myMilestonesEmail')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.myMilestonesEmail ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.myMilestonesEmail ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Freeze and Streak Status Alerts */}
          <div className="py-3.5 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Streak Freeze & Status Alerts
              </div>
              <div className="text-[11px] text-dark-muted mt-0.5">
                Receive notifications when an available freeze protects your streak after a missed day
              </div>
            </div>
            <button
              onClick={() => handleTogglePreference('freezeStatusNotifications')}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                preferences.freezeStatusNotifications ? 'bg-flame-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-zinc-950 absolute top-1 transition-transform ${
                  preferences.freezeStatusNotifications ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
