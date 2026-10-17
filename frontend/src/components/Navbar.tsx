import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchFriendRequests } from '../api/friends';
import {
  Flame,
  LayoutDashboard,
  CheckSquare,
  Globe2,
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

  // Poll or fetch pending friend requests and unread notifications for badge
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingRequestsCount(0);
      setUnreadNotificationsCount(0);
      return;
    }

    const loadBadgeCounts = async () => {
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
        // Ignore background badge error
      }
    };

    loadBadgeCounts();
    const interval = setInterval(loadBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navLinks = isAuthenticated
    ? [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'My Tasks', path: '/tasks', icon: CheckSquare },
        { label: 'Groups', path: '/groups', icon: Users },
        { label: "Friends' Tasks", path: '/friends/tasks', icon: Users2 },
        {
          label: 'Notifications',
          path: '/notifications',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
        { label: 'Global', path: '/leaderboard/global', icon: Globe2 },
        { label: 'Friends Rank', path: '/leaderboard/friends', icon: Trophy },
        {
          label: 'Friends',
          path: '/friends',
          icon: UserPlus,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
        },
      ]
    : [
        { label: 'Home', path: '/', icon: LayoutDashboard },
        { label: 'Leaderboard', path: '/leaderboard/global', icon: Globe2 },
      ];

  return (
    <nav className="sticky top-0 z-40 bg-dark-bg/90 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-flame-500/15 border border-flame-500/30 flex items-center justify-center text-flame-400 group-hover:scale-105 transition-all shadow-sm shadow-flame-500/20">
              <Flame className="w-5 h-5 fill-flame-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-zinc-100 flex items-center">
                Streak<span className="text-flame-500">Up</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    active
                      ? 'bg-dark-surface text-flame-400 border border-dark-border shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-flame-500' : 'text-zinc-500'}`} />
                  <span>{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="ml-1 bg-flame-500 text-zinc-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Action Area */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                {/* Current Streak Indicator */}
                <div className="flex items-center gap-1.5 bg-flame-500/10 border border-flame-500/25 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-flame-400">
                  <Flame className="w-4 h-4 fill-flame-500 animate-pulse" />
                  <span>{user.currentStreak}d streak</span>
                </div>

                {/* Profile Pill */}
                <Link
                  to={`/profile/${user.username}`}
                  title="Profile & Settings"
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1 bg-dark-surface border border-dark-border rounded-xl hover:border-zinc-700 transition-colors group"
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
                  className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-dark-hover rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-bold text-zinc-300 hover:text-zinc-100 hover:bg-dark-hover rounded-xl transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold bg-flame-500 hover:bg-flame-600 text-zinc-950 rounded-xl transition-all shadow-md shadow-flame-500/20 active:scale-95"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated && user && (
              <div className="flex items-center gap-1 text-xs font-bold text-flame-400 font-mono bg-flame-500/10 px-2.5 py-1 rounded-lg border border-flame-500/20">
                <Flame className="w-3.5 h-3.5 fill-flame-500" />
                <span>{user.currentStreak}d</span>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-dark-border bg-dark-bg/95 px-4 pt-2 pb-6 space-y-2">
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
            <div className="pt-3 border-t border-dark-border space-y-2">
              <Link
                to={`/profile/${user?.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-flame-400"
              >
                <InitialsAvatar name={user?.name || ''} image={user?.profileImage} size="xs" />
                <span>Profile & Settings</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl"
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
