import { useEffect, useLayoutEffect } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

let activeScrollLocks = 0;
let scrollYPosition = 0;

const preventDefaultTouchMove = (e: TouchEvent) => {
  if (activeScrollLocks <= 0) return;
  const target = e.target as HTMLElement | null;
  // If target or any ancestor is an element explicitly designated to scroll internally, permit it
  const isScrollable = target?.closest('.overflow-y-auto, .overflow-auto, [data-scrollable="true"]');
  if (!isScrollable) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }
};

const preventDefaultWheel = (e: WheelEvent) => {
  if (activeScrollLocks <= 0) return;
  const target = e.target as HTMLElement | null;
  const isScrollable = target?.closest('.overflow-y-auto, .overflow-auto, [data-scrollable="true"]');
  if (!isScrollable) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }
};

/**
 * Universally lock scrolling on document.body and documentElement when modals are open.
 * Uses the bulletproof iOS/Android/Desktop position: fixed technique plus global event prevention
 * to completely eliminate background scrolling under all conditions.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  activeScrollLocks++;
  if (activeScrollLocks === 1) {
    scrollYPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    // Check if scrollbar takes space to avoid layout shift
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYPosition}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    window.addEventListener('touchmove', preventDefaultTouchMove, { passive: false });
    window.addEventListener('wheel', preventDefaultWheel, { passive: false });
  }
}

/**
 * Restore scrolling on document.body and html, returning user to their exact scroll position.
 */
export function unlockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  activeScrollLocks = Math.max(0, activeScrollLocks - 1);

  if (activeScrollLocks === 0) {
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('left');
    document.body.style.removeProperty('right');
    document.body.style.removeProperty('width');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('touch-action');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overscroll-behavior');

    window.removeEventListener('touchmove', preventDefaultTouchMove);
    window.removeEventListener('wheel', preventDefaultWheel);

    window.scrollTo({
      top: scrollYPosition,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });
  }
}

/**
 * Hard reset to guarantee no lingering scroll locks remain on navigation or errors
 */
export function resetAllScrollLocks() {
  if (typeof document === 'undefined') return;
  activeScrollLocks = 0;
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('left');
  document.body.style.removeProperty('right');
  document.body.style.removeProperty('width');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('touch-action');
  document.body.style.removeProperty('padding-right');
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overscroll-behavior');

  if (typeof window !== 'undefined') {
    window.removeEventListener('touchmove', preventDefaultTouchMove);
    window.removeEventListener('wheel', preventDefaultWheel);
  }
}

/**
 * React hook to automatically lock body scroll while a modal is mounted/open.
 * Uses layout effect to guarantee synchronization before paint.
 */
export function useBodyScrollLock(isOpen: boolean = true) {
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);
}
