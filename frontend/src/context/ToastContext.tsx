import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Check, AlertCircle, Sparkles, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutsRef.current.has(id)) {
      clearTimeout(timeoutsRef.current.get(id)!);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, message, type };

    setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 3 toasts visible

    const timeout = setTimeout(() => {
      removeToast(id);
    }, 2800);

    timeoutsRef.current.set(id, timeout);
  }, [removeToast]);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {/* Toast Render Container: Non-intrusive floating anchor */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-50 pointer-events-none flex flex-col gap-2"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-fadeIn ${
                isSuccess
                  ? 'bg-zinc-900/95 border-emerald-500/30 text-zinc-100 shadow-emerald-950/20'
                  : isError
                  ? 'bg-zinc-900/95 border-rose-500/30 text-rose-200 shadow-rose-950/20'
                  : 'bg-zinc-900/95 border-zinc-700/80 text-zinc-200 shadow-zinc-950/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
                ) : isError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-flame-400 shrink-0" />
                )}
                <span className="text-xs font-medium leading-tight truncate">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss toast"
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
