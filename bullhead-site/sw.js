// Bullhead — minimal service worker.
// Purpose: satisfy real PWA installability criteria and give the installed
// app a basic offline fallback. Deliberately not a full caching strategy —
// menu/pricing changes shouldn't risk being served stale.

const CACHE = 'bullhead-shell-v2';
const SHELL = ['/', '/menu', '/visit', '/contact'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always prefer a live response (menu/pricing accuracy),
// fall back to the cached shell only when actually offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match('/'))
    )
  );
});
