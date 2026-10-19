import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

// Normalize base URL (strip trailing slash)
const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export interface SuperAdminData {
  id: string;
  username: string;
  role: string;
  hasSensitivePin: boolean;
  lastLoginAt: string | null;
  createdAt?: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token: string;
  admin: SuperAdminData;
  error?: string;
  message?: string;
}

export interface AdminLoginProps {
  /**
   * Callback invoked immediately following successful credentials verification,
   * after DOM input nodes and React states have been strictly sanitized.
   */
  onSuccess?: (admin: SuperAdminData) => void;
  /**
   * Optional route to navigate to after successful authentication.
   */
  redirectPath?: string;
}

/**
 * Dedicated, highly-secure Super Admin Login Component.
 *
 * Security Architecture & Browser Password Bypass Measures:
 * 1. Strict Form Elimination: Wraps all inputs and actions in standard <div> elements.
 *    No <form> tag is present in the DOM tree, neutralizing browser FormSubmissionObservers.
 * 2. Button Type: Uses standard button with type="button" to prevent implicit form triggers.
 * 3. Autocomplete Hardening: Applies `autocomplete="off"` to the username field and
 *    `autocomplete="new-password"` to the password input to prevent browser credential engines
 *    from offering "Save Password" prompts.
 * 4. DOM Sanitation Before Transition: Immediately upon successful server verification,
 *    physical DOM input nodes are wiped synchronously (ref.current.value = '') along with
 *    React state variables before triggering callback or routing mechanisms.
 */
export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, redirectPath }) => {
  const navigate = useNavigate();

  // State Management Hooks
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Direct DOM Input Node References for Security Sanitation
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Standalone asynchronous handler for Super Admin Authentication.
   * Completely bypasses browser credential capture engines.
   */
  const handleAdminSubmit = async (): Promise<void> => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setErrorMessage('Admin username and password are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Modern Native Fetch API Request
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      const data: AdminLoginResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Admin authentication failed.');
      }

      // =========================================================================
      // CRUCIAL SECURITY STEP:
      // Immediately clear physical input nodes in the DOM and React states
      // BEFORE executing any page redirect or routing mechanism.
      // This wipes credentials from memory and prevents browser password managers
      // from scraping filled inputs upon DOM re-render or component unmount.
      // =========================================================================
      if (usernameInputRef.current) {
        usernameInputRef.current.value = '';
      }
      if (passwordInputRef.current) {
        passwordInputRef.current.value = '';
      }

      setUsername('');
      setPassword('');
      setErrorMessage(null);

      // Persist Admin Session Tokens
      localStorage.setItem('streakup_admin_token', data.token);
      localStorage.setItem('streakup_admin_last_activity', String(Date.now()));

      // Trigger success callback
      if (onSuccess) {
        onSuccess(data.admin);
      }

      // Execute navigation redirect if path specified
      if (redirectPath) {
        navigate(redirectPath);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Admin authentication failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Enter key press to submit without needing a <form> submit trigger.
   */
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleAdminSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Flame Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-flame-500 to-rose-500" />

        {/* Header Header & Branding */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-zinc-100 tracking-tight">StreakUp Super Admin</h1>
            <p className="text-xs text-dark-muted font-medium">Privileged Management & Override Control</p>
          </div>
        </div>

        {/* Inline Error Notification */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fadeIn"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Security Hardened Formless Container */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Username</label>
            <input
              ref={usernameInputRef}
              type="text"
              name="super_admin_user_identifier"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter admin username"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Admin Password</label>
            <input
              ref={passwordInputRef}
              type="password"
              name="super_admin_secret_key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="••••••••"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleAdminSubmit}
            disabled={isLoading}
            className="w-full py-3 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg transition-all mt-3 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Authenticate Super Admin</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
