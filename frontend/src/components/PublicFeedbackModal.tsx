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

const CATEGORIES: {
  id: UserRequestCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ACCOUNT_RECOVERY', label: 'Recover Account', icon: ShieldAlert },
  { id: 'BUG_REPORT', label: 'Report a Bug', icon: Bug },
  { id: 'FEATURE_REQUEST', label: 'Feature Request', icon: Lightbulb },
  { id: 'ACCOUNT_SUPPORT', label: 'General Help', icon: MessageSquare },
];

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
      setError('Please provide a valid email address.');
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setError('Message must be at least 5 characters.');
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
        toast.success('Your message has been sent.');
      } else {
        setError(res.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send message. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto space-y-4 animate-scaleUp text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dark-border/60">
          <div>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight">
              Feedback & Requests
            </h3>
            <p className="text-xs text-dark-muted mt-0.5">
              Send a message to our team. No login required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-100">Message Sent!</h4>
              <p className="text-xs text-dark-muted max-w-xs mx-auto">
                Thank you. Our team will review your message and reply via email.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Select Pills - Clean unified styling */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-dark-muted">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-flame-500/15 border-flame-500/60 text-flame-400 font-semibold shadow-sm'
                          : 'bg-dark-surface/60 border-dark-border hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtle contextual hint for account recovery */}
            {category === 'ACCOUNT_RECOVERY' && (
              <div className="p-2.5 bg-dark-surface/80 border border-flame-500/20 rounded-xl text-[11px] text-zinc-300 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-flame-400 shrink-0" />
                <span>Accounts deleted within the past 10 days can be recovered.</span>
              </div>
            )}

            {/* Email & Username Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Email <span className="text-flame-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-8 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Username <span className="text-zinc-500 text-[10px]">(optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. nirmal"
                    className="w-full pl-8 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Message Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-zinc-300">
                  Message <span className="text-flame-400">*</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {message.length}/3000
                </span>
              </div>
              <textarea
                rows={3}
                required
                maxLength={3000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === 'ACCOUNT_RECOVERY'
                    ? 'State your registered email or username to restore your account...'
                    : category === 'BUG_REPORT'
                    ? 'Describe what happened and how to reproduce it...'
                    : category === 'FEATURE_REQUEST'
                    ? 'What feature would you like to see on StreakUp?'
                    : 'How can we help you?'
                }
                className="w-full p-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-dark-border/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || message.trim().length < 5}
                className="px-4 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send Message</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
