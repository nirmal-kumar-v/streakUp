import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-8 sm:pt-24 sm:pb-16 text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-flame-500/10 border border-flame-500/25 text-flame-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-flame-500" />
          <span>The Modern Daily Task & Streak Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-zinc-100 tracking-tight leading-tight sm:leading-none">
          Turn your daily habits into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-flame-500 to-amber-300">
            unbreakable streaks.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-dark-muted max-w-2xl mx-auto leading-relaxed">
          StreakUp brings together daily task management, consecutive-day streak tracking, timezone-aware midnight countdowns, and friendly accountability.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-glow-flame flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Go to Your Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-3.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-glow-flame flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Start Tracking Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-7 py-3.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-zinc-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
