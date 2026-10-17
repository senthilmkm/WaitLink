/* ==========================================================================
   WaitLink — Progressive Web App (PWA) Service Worker
   Version: 1.0.0
   Enables standalone tablet installation & offline queue shell resilience
   ========================================================================== */

const CACHE_NAME = 'waitlink-shell-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css?v=4.6',
  '/app.js',
  '/qrcode.min.js',
  '/firebase-app-compat.js',
  '/firebase-firestore-compat.js',
  '/firebase-auth-compat.js',
  '/assets/waitlink_stripe_icon.png'
];

// Domains and endpoints that must NEVER be cached (live cloud transactions)
const NEVER_CACHE_PATTERNS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'api.stripe.com',
  'checkout.stripe.com',
  'js.stripe.com',
  'cloudfunctions.net',
  '/top_ups',
  '/billing'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA SW] Pruning legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Bypass all non-GET requests immediately
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Bypass live cloud databases, Stripe, and Cloud Functions
  const isExcluded = NEVER_CACHE_PATTERNS.some(pattern => url.includes(pattern));
  if (isExcluded) {
    return;
  }

  // 3. For navigation requests (loading pages), use Network First with Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 4. For static assets (styles, scripts, images, fonts), Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
