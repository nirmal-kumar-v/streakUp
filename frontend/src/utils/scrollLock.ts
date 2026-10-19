import { useEffect } from 'react';

let activeScrollLocks = 0;

/**
 * Universally lock scrolling on document.body when modals or overlays are open.
 * Uses clean overflow styling without destructive position:fixed or touch-action:none.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  activeScrollLocks++;
  if (activeScrollLocks === 1) {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
}

/**
 * Restore scrolling on document.body and html
 */
export function unlockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  activeScrollLocks = Math.max(0, activeScrollLocks - 1);

  if (activeScrollLocks === 0) {
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('width');
    document.body.style.removeProperty('touch-action');
  }
}

/**
 * Hard reset to guarantee no lingering scroll locks remain on navigation or errors
 */
export function resetAllScrollLocks() {
  if (typeof document === 'undefined') return;
  activeScrollLocks = 0;
  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('width');
  document.body.style.removeProperty('touch-action');
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
