import { useEffect } from 'react';

let activeScrollLocks = 0;
let scrollYPosition = 0;

/**
 * Universally lock scrolling on document.body and documentElement when modals are open.
 * Uses the bulletproof iOS/Android/Desktop position: fixed technique to prevent any background scroll.
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
}

/**
 * React hook to automatically lock body scroll while a modal is mounted/open
 */
export function useBodyScrollLock(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);
}
