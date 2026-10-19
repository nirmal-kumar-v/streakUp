import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  ShieldAlert,
  Bug,
  Lightbulb,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { submitUserRequest, UserRequestCategory } from '../api/userRequests';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/error';

interface PublicFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: UserRequestCategory;
  initialEmail?: string;
  initialUsername?: string;
}

export const PublicFeedbackModal: React.FC<PublicFeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'ACCOUNT_RECOVERY',
  initialEmail = '',
  initialUsername = '',
}) => {
  const toast = useToast();
  const [category, setCategory] = useState<UserRequestCategory>(defaultCategory);
  const [email, setEmail] = useState(initialEmail);
  const [username, setUsername] = useState(initialUsername);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      if (initialEmail) setEmail(initialEmail);
      if (initialUsername) setUsername(initialUsername);
      setSubmittedSuccess(false);
      setError('');
    }
  }, [isOpen, defaultCategory, initialEmail, initialUsername]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address so we can reply.');
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setError('Please enter a message of at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await submitUserRequest({
        category,
        message: message.trim(),
        email: email.trim(),
        username: username.trim() || undefined,
        name: username.trim() || undefined,
      });

      if (res.success) {
        setSubmittedSuccess(true);
        toast.success('Your message has been sent to our team.');
      } else {
        setError(res.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send request. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: {
    id: UserRequestCategory;
    title: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'ACCOUNT_RECOVERY',
      title: 'Recover Account',
      desc: 'Request restoration within 10-day deletion grace period',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
      color: 'border-rose-500/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/15',
    },
    {
      id: 'BUG_REPORT',
      title: 'Report a Bug',
      desc: 'Found an issue or unexpected behavior? Help us fix it',
      icon: <Bug className="w-4 h-4 text-amber-400" />,
      color: 'border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15',
    },
    {
      id: 'FEATURE_REQUEST',
      title: 'Feature Request',
      desc: 'Suggest improvements, new tools, or ideas for StreakUp',
      icon: <Lightbulb className="w-4 h-4 text-emerald-400" />,
      color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15',
    },
    {
      id: 'ACCOUNT_SUPPORT',
      title: 'Support & Help',
      desc: 'General inquiry, help, or message for the management team',
      icon: <MessageSquare className="w-4 h-4 text-sky-400" />,
      color: 'border-sky-500/40 text-sky-300 bg-sky-500/10 hover:bg-sky-500/15',
    },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain">
      <div
        className="w-full max-w-lg bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-7 shadow-2xl relative my-auto space-y-5 animate-scaleUp text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-flame-500/20 to-amber-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shadow-inner">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-100 flex items-center gap-2">
                <span>Support & User Requests</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-flame-500/15 text-flame-400 border border-flame-500/30 uppercase tracking-wider">
                  Direct to Admin & Manager
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                No login required. Submit account recovery, bug reports, or feature suggestions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-extrabold text-zinc-100">Request Sent Successfully!</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Thank you for reaching out. Our administrators and managers have been notified and will review your message promptly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Select Pills */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                Select Request Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((c) => {
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? `${c.color} ring-1 ring-white/20 shadow-sm`
                          : 'bg-dark-surface/60 border-dark-border hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{c.icon}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight text-zinc-100">{c.title}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight truncate mt-0.5">
                          {c.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {category === 'ACCOUNT_RECOVERY' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  10-Day Account Recovery Grace Period
                </p>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  If you deleted your account within the past 10 days, enter the email address or username registered to your account. Super Admins will review your request and authorize restoration of your streaks, study notes, and groups.
                </p>
              </div>
            )}

            {/* Contact Email & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Your Email Address <span className="text-flame-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  StreakUp Username / Name <span className="text-zinc-500 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. nirmal or Your Name"
                    className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500"
                  />
                </div>
              </div>
            </div>

            {/* Message Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-300">
                  {category === 'ACCOUNT_RECOVERY'
                    ? 'Recovery Reason / Details'
                    : category === 'BUG_REPORT'
                    ? 'Bug Description & Steps to Reproduce'
                    : category === 'FEATURE_REQUEST'
                    ? 'Feature Idea & Use Case'
                    : 'Your Message'} <span className="text-flame-400">*</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {message.length}/3000
                </span>
              </div>
              <textarea
                rows={4}
                required
                maxLength={3000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === 'ACCOUNT_RECOVERY'
                    ? 'Explain that you would like to restore your deleted account...'
                    : category === 'BUG_REPORT'
                    ? 'Describe what happened, what device/browser you were using, and how to trigger it...'
                    : 'Provide as much detail as possible to help us help you...'
                }
                className="w-full p-3 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 leading-relaxed resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-dark-border flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || message.trim().length < 5}
                className="px-5 py-2.5 bg-gradient-to-r from-flame-500 to-amber-500 hover:from-flame-600 hover:to-amber-600 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send to Admin & Managers</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
