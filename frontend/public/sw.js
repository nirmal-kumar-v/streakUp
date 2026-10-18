/* ==========================================================================
   StreakUp Service Worker
   - Fast repeat loads for static assets (HTML shell, CSS, JS, fonts, icons)
   - Zero-caching of sensitive /api/* requests (Network-Only for all API routes)
   - Graceful offline navigation fallback to cached app shell
   - Seamless update lifecycle without mid-session disruption
   ========================================================================== */

const CACHE_NAME = 'streakup-v1-shell';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
];

// Install: Cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning (non-fatal):', err);
      });
    })
  );
  // Do not forcefully claim clients immediately to prevent interrupting active forms
});

// Activate: Clean up old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// 1. /api/* => STRICTLY Network-Only. Never cache sensitive user data.
// 2. Navigation (HTML) => Network-First, fallback to cached '/' if offline.
// 3. Static Assets (JS, CSS, fonts, images) => Cache-First, fallback to Network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Non-GET requests (POST, PUT, DELETE) are always Network-Only
  if (req.method !== 'GET') {
    return;
  }

  // STRICT SECURITY RULE: Never cache backend API endpoints
  if (url.pathname.startsWith('/api') || url.pathname.includes('/api/')) {
    return; // Let browser handle network request natively
  }

  // Cross-origin external API requests
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // Navigation requests (HTML pages)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      })
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate)
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => {
            // Ignore offline fetch errors in background
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network and cache
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cache static JS/CSS/Fonts/Images
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// Listen for message to skip waiting when user confirms update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
