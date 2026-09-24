// Bullhead — minimal service worker.
// Purpose: satisfy real PWA installability criteria, give the installed
// app a basic offline fallback, and show the owner's "new order" phone alerts. Deliberately not a full caching strategy —
// menu/pricing changes shouldn't risk being served stale.

const CACHE = 'bullhead-shell-v3';
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

// ---- Owner phone alerts (Web Push) ----
// The server sends an empty push when an order arrives; we show the alert here.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('🔔 New Bullhead order', {
      body: 'Tap to open the dashboard',
      icon: '/assets/img/icon-180.png',
      tag: 'bullhead-order',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: '/admin' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.includes('/admin'));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
