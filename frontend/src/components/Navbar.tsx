import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchFriendRequests } from '../api/friends';
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
import { fetchNotifications } from '../api/notifications';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFetchingRef = useRef(false);

  // Poll pending friend requests and unread notifications periodically (every 45s)
  // Decoupled from location.pathname to eliminate layout shifts, duplicate fetches, and navigation flicker
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingRequestsCount(0);
      setUnreadNotificationsCount(0);
      return;
    }

    const loadBadgeCounts = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        const [friendsRes, notifsRes] = await Promise.all([
          fetchFriendRequests(),
          fetchNotifications({ status: 'unread', limit: 1 }),
        ]);

        if (friendsRes.success) {
          setPendingRequestsCount(friendsRes.pendingCount || 0);
        }
        if (notifsRes.success) {
          setUnreadNotificationsCount(notifsRes.unreadCount || 0);
        }
      } catch {
        // Silent fail for background badge poll
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadBadgeCounts();
    const interval = setInterval(loadBadgeCounts, 45000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Focused primary navigation links
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
    <nav className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border h-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo / Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-flame-500/10 border border-flame-500/25 flex items-center justify-center text-flame-400 group-hover:scale-105 transition-all shadow-sm">
              <Flame className="w-5 h-5 text-flame-500 fill-flame-500" />
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
                {/* Friends Leaderboard Trophy - Icon-Only */}
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
                  title={`${user.currentStreak}-day streak`}
                  aria-label={`${user.currentStreak} day streak`}
                  className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1.5 rounded-xl font-mono text-xs font-bold text-zinc-100"
                >
                  <Flame className="w-4 h-4 text-flame-500 fill-flame-500 shrink-0" />
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
                  className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg flex items-center justify-center"
                >
                  <Trophy className="w-4 h-4" />
                </Link>

                {/* Mobile Notifications Bell */}
                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  title="Notifications"
                  className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg relative flex items-center justify-center"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flame-500 ring-2 ring-dark-bg" />
                  )}
                </Link>

                {/* Mobile Streak Display: Flame Vector + Numeric Value Only */}
                <div
                  aria-label={`${user.currentStreak} day streak`}
                  className="flex items-center gap-1 text-xs font-bold text-zinc-100 font-mono bg-zinc-800/60 px-2 py-1 rounded-lg border border-zinc-700/40"
                >
                  <Flame className="w-3.5 h-3.5 text-flame-500 fill-flame-500" />
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-dark-border bg-dark-bg/98 backdrop-blur-lg px-4 pt-2 pb-6 space-y-1 shadow-2xl">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-dark-surface text-flame-400 border border-dark-border'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-flame-500" />
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

          {isAuthenticated ? (
            <div className="pt-2 border-t border-dark-border space-y-1">
              <Link
                to="/leaderboard/friends"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive('/leaderboard/friends')
                    ? 'bg-dark-surface text-amber-400 border border-dark-border'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Friends Leaderboard</span>
              </Link>
              <Link
                to="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive('/notifications')
                    ? 'bg-dark-surface text-flame-400 border border-dark-border'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-flame-400" />
                  <span>Notifications</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="bg-flame-500 text-zinc-950 text-xs font-black px-2 py-0.5 rounded-full">
                    {unreadNotificationsCount}
                  </span>
                )}
              </Link>
              <Link
                to={`/profile/${user?.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-zinc-300 hover:text-flame-400"
              >
                <InitialsAvatar name={user?.name || ''} image={user?.profileImage} size="xs" />
                <span>Profile & Settings</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-dark-border flex flex-col gap-2">
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
      )}
    </nav>
  );
};
