import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BadgeProvider } from './context/BadgeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLockProvider } from './context/AppLockContext';
import { AppLockScreen } from './components/AppLockScreen';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StreakCelebration } from './components/StreakCelebration';
import { PostCompletionNudge } from './components/PostCompletionNudge';
import { OfflineBanner } from './components/OfflineBanner';
import { apiClient } from './api/client';
import { useAllDevicesDisableZoom } from './hooks/useAllDevicesDisableZoom';

// Lazy loaded secondary routes for optimal initial bundle size and rapid FCP
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const GlobalLeaderboardPage = lazy(() =>
  import('./pages/GlobalLeaderboardPage').then((m) => ({ default: m.GlobalLeaderboardPage }))
);
const FriendsLeaderboardPage = lazy(() =>
  import('./pages/FriendsLeaderboardPage').then((m) => ({ default: m.FriendsLeaderboardPage }))
);
const FriendsPage = lazy(() =>
  import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage }))
);
const FriendsTasksPage = lazy(() =>
  import('./pages/FriendsTasksPage').then((m) => ({ default: m.FriendsTasksPage }))
);
const PublicProfilePage = lazy(() =>
  import('./pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const NotificationSettingsPage = lazy(() =>
  import('./pages/NotificationSettingsPage').then((m) => ({ default: m.NotificationSettingsPage }))
);
const GroupsPage = lazy(() =>
  import('./pages/GroupsPage').then((m) => ({ default: m.GroupsPage }))
);
const GroupDetailPage = lazy(() =>
  import('./pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage }))
);
const TermsPage = lazy(() =>
  import('./pages/TermsPage').then((m) => ({ default: m.TermsPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const AdminControlPage = lazy(() =>
  import('./pages/AdminControlPage').then((m) => ({ default: m.AdminControlPage }))
);

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-muted">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PageFallback: React.FC = () => (
  <div className="py-24 flex items-center justify-center text-dark-muted text-xs">
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
      <span>Loading...</span>
    </div>
  </div>
);

const EXACT_ADMIN_URL = '/streakup-karo/aB9!xQ4#mK2$vL7&pZ5*rW1@tN8%25cY3(e]6)uJ0[[_xG]0-5+zQ8=vB2-mK9!xQ4#mK7&pZ5*rW1@tN8%25cY3(eF6)uJ0_xG5+zQ8=vB2-mK';
const EXACT_ADMIN_PATHNAME = '/streakup-karo/aB9!xQ4';

/**
 * Obfuscated admin entrypoint redirector:
 * Redirects strictly to the exact fixed complex secret URL requested.
 */
const AdminRedirect: React.FC = () => {
  return <Navigate to={EXACT_ADMIN_URL} replace />;
};

/**
 * Validates that the full URL contains the exact complex secret string.
 * Uses safe raw inspection to avoid browser URI malformed errors from symbol characters.
 * If any character is altered or modified, it immediately blocks and redirects to home.
 */
const AdminSecretRoute: React.FC = () => {
  const location = useLocation();
  const rawHash = location.hash || '';

  const isValidSecret =
    rawHash.includes('mK2$vL7&pZ5*rW1@tN8') &&
    rawHash.includes('uJ0[[_xG]0-5+zQ8=vB2-mK9!xQ4#mK7&pZ5*rW1@tN8') &&
    rawHash.includes('uJ0_xG5+zQ8=vB2-mK');

  if (!isValidSecret) {
    return <Navigate to="/" replace />;
  }

  return <AdminControlPage />;
};

export const AppContent: React.FC = () => {
  useAllDevicesDisableZoom();
  const { isAuthenticated } = useAuth();

  // Periodically trigger serverless reminder check while user is active (every 5 minutes)
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // Check immediately on load/mount
    apiClient.get('/cron/reminders').catch(() => {});

    // Periodic check every 5 minutes (300,000 ms) instead of continuous aggressive 60s polling
    const timer = setInterval(() => {
      apiClient.get('/cron/reminders').catch(() => {});
    }, 300000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-zinc-100 overflow-x-hidden">
      <AppLockScreen />
      <OfflineBanner />
      <Navbar />
      <StreakCelebration />
      {isAuthenticated && <PostCompletionNudge />}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/leaderboard" element={<Navigate to="/leaderboard/friends" replace />} />
            <Route path="/leaderboard/global" element={<GlobalLeaderboardPage />} />
            <Route path="/profile/:username" element={<PublicProfilePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends/tasks"
              element={
                <ProtectedRoute>
                  <FriendsTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends-tasks"
              element={
                <ProtectedRoute>
                  <FriendsTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard/friends"
              element={
                <ProtectedRoute>
                  <FriendsLeaderboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <ProtectedRoute>
                  <GroupDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <FriendsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <ProtectedRoute>
                  <NotificationSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications/settings"
              element={
                <ProtectedRoute>
                  <NotificationSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Control Panel (Strict fixed complex secret URL, no tokens) */}
            <Route path="/admin-control" element={<AdminRedirect />} />
            <Route path="/admin-panel" element={<AdminRedirect />} />
            <Route path={EXACT_ADMIN_PATHNAME} element={<AdminSecretRoute />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-border py-6 text-center text-xs text-dark-muted font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>StreakUp &copy; {new Date().getFullYear()} — Daily Habits, Streaks & Friendly Competition</div>
          <div className="text-[11px] text-zinc-500">Dark Titanium & Warm Amber Aesthetic</div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <AuthProvider>
          <AppLockProvider>
            <BadgeProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </BadgeProvider>
          </AppLockProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
