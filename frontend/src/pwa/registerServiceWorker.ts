// PWA Service Worker Registration & Lifecycle Management

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Register on window load to prioritize primary page render
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates on page reload
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content available, but don't force reload mid-task
                console.info('[StreakUp PWA] New version available. It will take effect on next launch.');
              } else {
                console.info('[StreakUp PWA] Content cached for offline use.');
              }
            }
          });
        });
      })
      .catch((err) => {
        // Non-fatal service worker error (e.g. self-signed dev certificates or privacy extensions)
        console.warn('[StreakUp PWA] Service worker registration notice:', err);
      });
  });
}
