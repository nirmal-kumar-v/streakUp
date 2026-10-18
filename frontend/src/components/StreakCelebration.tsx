import React, { useState, useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';

export interface StreakCelebrationDetail {
  newStreak?: number;
  sourceX?: number;
  sourceY?: number;
}

export function triggerStreakCelebration(detail?: StreakCelebrationDetail) {
  window.dispatchEvent(new CustomEvent('streak-celebration', { detail }));
}

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  color: string;
}

export const StreakCelebration: React.FC = () => {
  const [activeFlyingFlame, setActiveFlyingFlame] = useState<{
    id: number;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    newStreak?: number;
  } | null>(null);

  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);
  const [reducedMotionToast, setReducedMotionToast] = useState<string | null>(null);

  const flameRef = useRef<HTMLDivElement | null>(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const handleCelebration = (e: Event) => {
      const customEvent = e as CustomEvent<StreakCelebrationDetail>;
      const detail = customEvent.detail || {};

      // Guard against rapid duplicate trigger
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      // Check user's reduced-motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        // Reduced motion: Trigger gentle highlight on navbar streak and show simple visual confirmation
        window.dispatchEvent(new CustomEvent('streak-highlight'));
        setReducedMotionToast(
          detail.newStreak ? `Streak extended to ${detail.newStreak} days! 🔥` : 'Streak confirmed! 🔥'
        );
        setTimeout(() => {
          setReducedMotionToast(null);
          isAnimatingRef.current = false;
        }, 2200);
        return;
      }

      // Find the active navbar streak indicator element
      // Query all elements with data-streak-indicator="true" and pick the one that is currently visible
      const indicators = Array.from(document.querySelectorAll<HTMLElement>('[data-streak-indicator="true"]'));
      let targetRect: DOMRect | null = null;

      for (const el of indicators) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < 120) {
          targetRect = rect;
          break;
        }
      }

      const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 60;
      const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 28;

      // Start coordinates: provided source or viewport center
      const startX = detail.sourceX !== undefined ? detail.sourceX : window.innerWidth / 2;
      const startY = detail.sourceY !== undefined ? detail.sourceY : window.innerHeight * 0.55;

      const animationId = Date.now();
      setActiveFlyingFlame({
        id: animationId,
        startX,
        startY,
        targetX,
        targetY,
        newStreak: detail.newStreak,
      });
    };

    window.addEventListener('streak-celebration', handleCelebration);
    return () => {
      window.removeEventListener('streak-celebration', handleCelebration);
    };
  }, []);

  // Run the flying flame animation
  useEffect(() => {
    if (!activeFlyingFlame || !flameRef.current) return;

    const el = flameRef.current;
    const { startX, startY, targetX, targetY } = activeFlyingFlame;

    // Control point for a smooth bezier arc
    const midX = (startX + targetX) / 2 + (targetX > startX ? -40 : 40);
    const midY = Math.min(startY, targetY) - 50;

    const duration = 750; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease-in-out quadratic progress
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // Quadratic Bezier interpolation: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
      const curX = Math.pow(1 - ease, 2) * startX + 2 * (1 - ease) * ease * midX + Math.pow(ease, 2) * targetX;
      const curY = Math.pow(1 - ease, 2) * startY + 2 * (1 - ease) * ease * midY + Math.pow(ease, 2) * targetY;

      // Scale up at start then shrink as it merges into navbar
      const scale = t < 0.3 ? 0.6 + t * 2 : Math.max(0.7, 1.2 - (t - 0.3) * 0.7);
      const opacity = t > 0.9 ? 1 - (t - 0.9) * 10 : 1;

      if (el) {
        el.style.transform = `translate3d(${curX - 24}px, ${curY - 24}px, 0) scale(${scale})`;
        el.style.opacity = `${opacity}`;
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Flame arrived at target!
        setActiveFlyingFlame(null);

        // 1. Dispatch highlight event to navbar
        window.dispatchEvent(new CustomEvent('streak-highlight'));

        // 2. Create sparkle burst at target
        const newSparkles: SparkleParticle[] = [];
        const colors = ['#f59e0b', '#fbbf24', '#f97316', '#ffffff', '#fb923c'];

        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * 2 * Math.PI;
          const speed = 2 + Math.random() * 3.5;
          newSparkles.push({
            id: i,
            x: targetX,
            y: targetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            scale: 0.8 + Math.random() * 0.6,
            color: colors[i % colors.length],
          });
        }
        setSparkles(newSparkles);

        setTimeout(() => {
          setSparkles([]);
          isAnimatingRef.current = false;
        }, 550);
      }
    };

    requestAnimationFrame(animate);
  }, [activeFlyingFlame]);

  return (
    <>
      {/* Reduced-Motion Accessible Visual Confirmation */}
      {reducedMotionToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-18 right-4 z-50 px-4 py-2 bg-dark-card border border-flame-500/40 text-flame-300 rounded-xl shadow-lg shadow-flame-500/20 text-xs font-bold flex items-center gap-2 pointer-events-none transition-all"
        >
          <Flame className="w-4 h-4 text-flame-500 fill-flame-500 shrink-0" />
          <span>{reducedMotionToast}</span>
        </div>
      )}

      {/* Flying Flame Animation Container (Pointer events disabled to prevent blocking interactions) */}
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {activeFlyingFlame && (
          <div
            ref={flameRef}
            className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center will-change-transform"
          >
            {/* Radiant glowing halo */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-flame-600 to-amber-400 blur-md opacity-80 animate-pulse" />
            <div className="relative w-10 h-10 rounded-full bg-zinc-950/90 border border-flame-400/80 flex items-center justify-center shadow-lg shadow-flame-500/50">
              <Flame className="w-6 h-6 text-flame-400 fill-flame-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-bounce" />
            </div>
          </div>
        )}

        {/* Sparkle burst at arrival */}
        {sparkles.length > 0 &&
          sparkles.map((s) => (
            <div
              key={s.id}
              className="absolute w-2 h-2 rounded-full pointer-events-none animate-ping"
              style={{
                left: `${s.x + s.vx * 10}px`,
                top: `${s.y + s.vy * 10}px`,
                backgroundColor: s.color,
                boxShadow: `0 0 6px ${s.color}`,
                transform: `scale(${s.scale})`,
                transition: 'all 0.5s ease-out',
              }}
            />
          ))}
      </div>
    </>
  );
};
