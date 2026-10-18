import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgeContext';
import {
  Flame,
  LayoutDashboard,
  Users2,
  Users,
  UserPlus,
  LogOut,
  Menu,
  X,
  Trophy,
  Bell,
} from 'lucide-react';
import { InitialsAvatar } from './InitialsAvatar';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { pendingRequestsCount, unreadNotificationsCount } = useBadges();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Streak celebration animation highlight listener
  const [isStreakHighlighted, setIsStreakHighlighted] = useState(false);

  useEffect(() => {
    const handleHighlight = () => {
      setIsStreakHighlighted(true);
      const timer = setTimeout(() => setIsStreakHighlighted(false), 1600);
      return () => clearTimeout(timer);
    };

    window.addEventListener('streak-highlight', handleHighlight);
    return () => window.removeEventListener('streak-highlight', handleHighlight);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /**
   * Route-aware active matching.
   * Ensures sibling routes like '/friends' and '/friends/tasks' do not cross-highlight.
   */
  const isActive = (path: string) => {
    const current = location.pathname;

    // Home / Landing
    if (path === '/') return current === '/';

    // Exact match or exact match with trailing slash
    if (current === path || current === `${path}/`) return true;

    // '/friends' must NEVER match '/friends/tasks' or '/friends-tasks'
    if (path === '/friends') {
      return current === '/friends' || current === '/friends/';
    }

    // '/friends/tasks' matches '/friends/tasks' or alternate route '/friends-tasks'
    if (path === '/friends/tasks') {
      return (
        current === '/friends/tasks' ||
        current.startsWith('/friends/tasks/') ||
        current === '/friends-tasks'
      );
    }

    // '/groups' matches '/groups' and sub-routes like '/groups/:id'
    if (path === '/groups') {
      return current === '/groups' || current.startsWith('/groups/');
    }

    // '/dashboard' matches '/dashboard' and sub-routes if any
    if (path === '/dashboard') {
      return current === '/dashboard' || current.startsWith('/dashboard/');
    }

    // Trophy icon for Friends Leaderboard
    if (path === '/leaderboard/friends') {
      return (
        current === '/leaderboard/friends' ||
        current.startsWith('/leaderboard/friends') ||
        current === '/leaderboard'
      );
    }

    // Notifications
    if (path === '/notifications') {
      return current === '/notifications' || current.startsWith('/notifications/');
    }

    return false;
  };

  // Primary navigation links: Dashboard, Groups, Friends' Tasks, Friends
  // Leaderboard is accessed via the dedicated Trophy icon (no duplicate leaderboard links)
  const navLinks = isAuthenticated
    ? [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Groups', path: '/groups', icon: Users },
        { label: "Friends' Tasks", path: '/friends/tasks', icon: Users2 },
        {
          label: 'Friends',
          path: '/friends',
          icon: UserPlus,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
        },
      ]
    : [
        { label: 'Home', path: '/', icon: LayoutDashboard },
      ];

  return (
    <>
      <nav
        className={`sticky top-0 z-50 border-b border-dark-border h-16 transition-colors ${
          mobileMenuOpen ? 'bg-[#09090b]' : 'bg-dark-bg/95 backdrop-blur-md'
        }`}
      >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo / Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950 flex items-center justify-center group-hover:scale-105 transition-all shadow-sm">
              <img src="/icons/logo.png" alt="StreakUp Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-zinc-100 flex items-center">
                Streak<span className="text-flame-500">Up</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    active
                      ? 'bg-dark-surface text-flame-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-flame-500' : 'text-zinc-400'}`} />
                  <span>{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="ml-1 bg-flame-500 text-zinc-950 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Action Area */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                {/* Friends Leaderboard Trophy - Default Leaderboard View */}
                <Link
                  to="/leaderboard/friends"
                  aria-label="Friends Leaderboard"
                  title="Friends Leaderboard"
                  className={`p-2 rounded-xl transition-colors relative flex items-center justify-center ${
                    isActive('/leaderboard/friends')
                      ? 'bg-dark-surface text-amber-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-amber-400 hover:bg-dark-hover'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                </Link>

                {/* Notifications - Icon-Only */}
                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  title="Notifications"
                  className={`p-2 rounded-xl transition-colors relative flex items-center justify-center ${
                    isActive('/notifications')
                      ? 'bg-dark-surface text-flame-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flame-500 ring-2 ring-dark-bg" />
                  )}
                </Link>

                {/* Current Streak Indicator: Flame Vector + Numeric Value Only */}
                <div
                  data-streak-indicator="true"
                  title={`${user.currentStreak}-day streak`}
                  aria-label={`${user.currentStreak} day streak`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all duration-300 ${
                    isStreakHighlighted
                      ? 'bg-flame-500/25 border-flame-500 text-amber-300 ring-2 ring-flame-500/40 shadow-lg shadow-flame-500/30 scale-110'
                      : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-100'
                  }`}
                >
                  <Flame
                    className={`w-4 h-4 text-flame-500 fill-flame-500 shrink-0 transition-transform duration-300 ${
                      isStreakHighlighted ? 'scale-125 rotate-6' : ''
                    }`}
                  />
                  <span>{user.currentStreak}</span>
                </div>

                {/* Profile Pill */}
                <Link
                  to={`/profile/${user.username}`}
                  title="Profile & Settings"
                  aria-label="Profile & Settings"
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-dark-surface border border-dark-border rounded-xl hover:border-zinc-700 transition-colors group"
                >
                  <InitialsAvatar
                    name={user.name}
                    image={user.profileImage}
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-flame-400 transition-colors">
                    {user.name.split(' ')[0]}
                  </span>
                </Link>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-dark-hover rounded-xl transition-colors flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-zinc-100 hover:bg-dark-hover rounded-xl transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-bold bg-flame-500 hover:bg-flame-600 text-zinc-950 rounded-xl transition-all shadow-md shadow-flame-500/20 active:scale-95"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="flex md:hidden items-center gap-1.5">
            {isAuthenticated && user && (
              <>
                {/* Mobile Friends Leaderboard Trophy */}
                <Link
                  to="/leaderboard/friends"
                  aria-label="Friends Leaderboard"
                  title="Friends Leaderboard"
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                    isActive('/leaderboard/friends')
                      ? 'bg-dark-surface text-amber-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-amber-400 hover:bg-dark-hover'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                </Link>

                {/* Mobile Notifications Bell */}
                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  title="Notifications"
                  className={`p-2 rounded-lg relative flex items-center justify-center transition-colors ${
                    isActive('/notifications')
                      ? 'bg-dark-surface text-flame-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flame-500 ring-2 ring-dark-bg" />
                  )}
                </Link>

                {/* Mobile Streak Display: Flame Vector + Numeric Value Only */}
                <div
                  data-streak-indicator="true"
                  aria-label={`${user.currentStreak} day streak`}
                  className={`flex items-center gap-1 text-xs font-bold font-mono px-2 py-1 rounded-lg border transition-all duration-300 ${
                    isStreakHighlighted
                      ? 'bg-flame-500/25 border-flame-500 text-amber-300 ring-2 ring-flame-500/40 shadow-lg shadow-flame-500/30 scale-110'
                      : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-100'
                  }`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 text-flame-500 fill-flame-500 transition-transform duration-300 ${
                      isStreakHighlighted ? 'scale-125 rotate-6' : ''
                    }`}
                  />
                  <span>{user.currentStreak}</span>
                </div>
              </>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile Drawer Backdrop & Solid Menu Panel (Rendered outside <nav> to prevent backdrop-filter clipping) */}
    {mobileMenuOpen && (
      <div className="md:hidden">
        {/* Backdrop Scrim */}
        <div
          className="fixed inset-0 top-16 bg-black/80 z-[90] animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Solid Drawer Panel (100% Opaque, Full Width, Below Nav) */}
        <div
          id="mobile-drawer-menu"
          className="fixed top-16 inset-x-0 bottom-0 z-[100] border-t border-dark-border px-4 pt-4 pb-8 flex flex-col justify-between shadow-2xl overflow-y-auto animate-fadeIn"
          style={{ backgroundColor: '#09090b' }}
        >
          <div className="space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-dark-surface text-flame-400 border border-dark-border shadow-sm'
                      : 'text-zinc-300 hover:text-zinc-100 hover:bg-dark-hover active:bg-dark-hover'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-flame-500' : 'text-zinc-400'}`} />
                    <span>{link.label}</span>
                  </div>
                  {link.badge !== undefined && (
                    <span className="bg-flame-500 text-zinc-950 text-xs font-black px-2 py-0.5 rounded-full">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {isAuthenticated && user ? (
            <div className="pt-4 mt-4 border-t border-dark-border space-y-2">
              <Link
                to={`/profile/${user.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-200 hover:text-flame-400 hover:bg-dark-hover rounded-xl transition-colors bg-dark-surface/50 border border-dark-border"
              >
                <InitialsAvatar name={user.name} image={user.profileImage} size="xs" />
                <div className="flex flex-col">
                  <span className="font-semibold text-zinc-100">{user.name}</span>
                  <span className="text-[11px] text-dark-muted font-mono">@{user.username}</span>
                </div>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-4 mt-4 border-t border-dark-border flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-semibold text-zinc-200 bg-dark-surface border border-dark-border rounded-xl"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-bold text-zinc-950 bg-flame-500 rounded-xl"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    )}
  </>
  );
};
