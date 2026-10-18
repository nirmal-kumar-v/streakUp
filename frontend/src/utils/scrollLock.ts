import { useEffect } from 'react';

let activeScrollLocks = 0;
let savedScrollY = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalPosition = '';
let originalTop = '';
let originalWidth = '';
let originalTouchAction = '';

/**
 * Universally lock scrolling on document.body and html when modals or overlays are open
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (activeScrollLocks === 0) {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    originalPosition = document.body.style.position;
    originalTop = document.body.style.top;
    originalWidth = document.body.style.width;
    originalTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
  }
  activeScrollLocks++;
}

/**
 * Restore scrolling on document.body and html
 */
export function unlockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  activeScrollLocks = Math.max(0, activeScrollLocks - 1);

  if (activeScrollLocks === 0) {
    document.documentElement.style.overflow = originalHtmlOverflow || '';
    document.body.style.overflow = originalBodyOverflow || '';
    document.body.style.position = originalPosition || '';
    document.body.style.top = originalTop || '';
    document.body.style.width = originalWidth || '';
    document.body.style.touchAction = originalTouchAction || '';

    window.scrollTo(0, savedScrollY);
  }
}

/**
 * React hook to automatically lock body & html scroll while a modal is mounted/open
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
