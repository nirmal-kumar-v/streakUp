import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button by default to prevent accidental trigger
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      btn: 'bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-rose-500/20',
      iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      icon: <Trash2 className="w-5 h-5" />,
    },
    warning: {
      btn: 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 font-black shadow-amber-500/20',
      iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    primary: {
      btn: 'bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-black shadow-flame-500/20',
      iconBg: 'bg-flame-500/15 border-flame-500/30 text-flame-400',
      icon: <AlertTriangle className="w-5 h-5" />,
    },
  }[confirmVariant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl shadow-black/80 space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${variantStyles.iconBg}`}>
              {variantStyles.icon}
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-zinc-100">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message body */}
        <div id="confirm-modal-desc" className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {message}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-semibold text-xs rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${variantStyles.btn} disabled:opacity-50`}
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
