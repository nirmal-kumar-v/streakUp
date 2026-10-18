import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Globe } from 'lucide-react';

export const LeaderboardNav: React.FC = () => {
  return (
    <div className="flex items-center gap-2 border-b border-dark-border pb-4 mb-6">
      <NavLink
        to="/leaderboard/friends"
        className={({ isActive }) =>
          `flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            isActive
              ? 'bg-flame-500 text-zinc-950 shadow-md shadow-flame-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface'
          }`
        }
      >
        <Users className="w-4 h-4" />
        <span>Friends Leaderboard</span>
      </NavLink>

      <NavLink
        to="/leaderboard/global"
        className={({ isActive }) =>
          `flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            isActive
              ? 'bg-flame-500 text-zinc-950 shadow-md shadow-flame-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface'
          }`
        }
      >
        <Globe className="w-4 h-4" />
        <span>Global Top 10</span>
      </NavLink>
    </div>
  );
};
