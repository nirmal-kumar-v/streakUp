import { useEffect } from 'react';

const FORM_ZOOM_SELECTOR = [
  'form',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
  '[data-allow-browser-zoom="true"]',
].join(', ');

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[data-allow-double-tap-zoom="true"]',
].join(', ');

function getElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function isFormArea(target: EventTarget | null): boolean {
  return Boolean(getElement(target)?.closest(FORM_ZOOM_SELECTOR));
}

function isInteractiveArea(target: EventTarget | null): boolean {
  const element = getElement(target);

  return Boolean(
    element &&
      (element.closest(FORM_ZOOM_SELECTOR) ||
        element.closest(INTERACTIVE_SELECTOR))
  );
}

export function useAllDevicesDisableZoom(): void {
  useEffect(() => {
    let lastTap:
      | {
          time: number;
          x: number;
          y: number;
          region: Element;
        }
      | null = null;

    // Desktop: block Ctrl/Cmd + wheel zoom outside form areas.
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (isFormArea(event.target)) return;

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    // Desktop: block common browser zoom shortcuts (Ctrl/Cmd +, -, =, _, 0, NumpadAdd, NumpadSubtract).
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey || isFormArea(event.target)) return;

      const zoomKeys = ['+', '-', '=', '_', '0', 'NumpadAdd', 'NumpadSubtract'];

      if (zoomKeys.includes(event.key) && event.cancelable) {
        event.preventDefault();
      }
    };

    // iOS Safari: best-effort prevention of native gesture zoom outside form areas.
    const handleGesture = (event: Event) => {
      if (isFormArea(event.target)) return;

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    // Mobile: block multi-finger pinch outside form areas.
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length <= 1) return;
      if (isFormArea(event.target)) return;

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    // Mobile: prevent rapid double-tap zoom on non-interactive content.
    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length !== 0) return;
      if (event.changedTouches.length !== 1) return;

      const element = getElement(event.target);

      if (!element || isInteractiveArea(event.target)) {
        lastTap = null;
        return;
      }

      const touch = event.changedTouches[0];
      const now = performance.now();

      const region =
        element.closest(
          'p, h1, h2, h3, h4, h5, h6, li, article, section, main, [data-double-tap-region]'
        ) ?? element;

      if (
        lastTap &&
        now - lastTap.time <= 300 &&
        lastTap.region === region &&
        Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 24
      ) {
        if (event.cancelable) {
          event.preventDefault();
        }

        lastTap = null;
        return;
      }

      lastTap = {
        time: now,
        x: touch.clientX,
        y: touch.clientY,
        region,
      };
    };

    const nonPassive: AddEventListenerOptions = {
      passive: false,
    };

    window.addEventListener('wheel', handleWheel, nonPassive);
    window.addEventListener('keydown', handleKeyDown);

    document.addEventListener('gesturestart', handleGesture, nonPassive);
    document.addEventListener('gesturechange', handleGesture, nonPassive);
    document.addEventListener('gestureend', handleGesture, nonPassive);
    document.addEventListener('touchmove', handleTouchMove, nonPassive);
    document.addEventListener('touchend', handleTouchEnd, nonPassive);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);

      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      lastTap = null;
    };
  }, []);
}

export default useAllDevicesDisableZoom;
