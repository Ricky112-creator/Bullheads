// Bullhead service worker: offline-ready pages + owner "new order" phone alerts.
// - Online: always network-first, so menu, price and code updates are never held back. The saved copy is used only if the
//   network fails or is very slow.
// - Offline: the public pages work from the saved copy, with their CSS, JS and fonts. Images are saved as they are viewed.
// - Never touched: admin, tools, qr, staff, orders, push and every other API (live data only).
//   /api/menu falls back to its last copy ONLY when the network fails, so prices are never served stale while online.

const SHELL = 'bullhead-shell-v6';
const RUNTIME = 'bullhead-runtime-v6';
const PAGES = self.location.hostname.indexOf('admin.') === 0 ? ['/', '/offline'] : ['/', '/menu', '/visit', '/contact', '/gallery', '/offline'];   // the admin. app only needs its own shell
const LIVE_ONLY = /^\/(admin|tools|qr|staff|api)(\/|$)/;
const NO_STORE_PAGE = /^\/track(\/|$)/;
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const MAX_RUNTIME = 150;

function okToStore(res) { return res && (res.status === 200 || res.type === 'opaque'); }

async function precache() {
  const cache = await caches.open(SHELL);
  const assets = new Set(), origin = self.location.origin;
  await Promise.all(PAGES.map(async (p) => {
    try {
      const res = await fetch(p, { cache: 'reload' });
      if (!res.ok || res.redirected) return;
      const html = await res.clone().text();
      await cache.put(p, res);
      const tags = html.match(/<(?:link|script)\b[^>]*>/gi) || [];
      tags.forEach((t) => {
        const isLink = /^<link/i.test(t);
        if (isLink && !/rel=["']?(?:stylesheet|preload)/i.test(t)) return;
        if (isLink && /rel=["']?preload/i.test(t) && !/as=["']?(?:style|script|font)/i.test(t)) return;
        const m = /(?:href|src)=["']([^"'#]+)["']/i.exec(t); if (!m) return;
        try { const u = new URL(m[1], origin + p); if (u.origin === origin || CDN.test(u.href)) assets.add(u.href); } catch (e) {}
      });
    } catch (e) {}
  }));
  await Promise.all(Array.from(assets).map(async (href) => {
    try {
      let res; try { res = await fetch(href); } catch (e) { res = await fetch(href, { mode: 'no-cors' }); }
      if (!okToStore(res)) return;
      await cache.put(href, res.clone());
      if (/^https:\/\/fonts\.googleapis\.com\//.test(href) && res.type !== 'opaque') {      // also save the font files the CSS points at
        const css = await res.clone().text(), urls = css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || [];
        await Promise.all(Array.from(new Set(urls)).slice(0, 12).map(async (f) => { try { const r = await fetch(f); if (okToStore(r)) await cache.put(f, r); } catch (e) {} }));
      }
    } catch (e) {}
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* find a saved copy: newest first (runtime), then the install-time copy; `loose` also accepts a different ?query (e.g. an older ?v=) */
async function lookup(req, loose) {
  const names = [RUNTIME, SHELL];
  for (const n of names) { const hit = await (await caches.open(n)).match(req); if (hit) return hit; }
  if (loose) for (const n of names) { const hit = await (await caches.open(n)).match(req, { ignoreSearch: true }); if (hit) return hit; }
  return undefined;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await cache.delete(keys[i]);
}

/* network first; if the network fails, or takes longer than `ms` while a saved copy exists, use the saved copy */
async function networkFirst(event, req, keyReq, ms, store) {
  const cache = await caches.open(RUNTIME);
  const net = fetch(req).then((res) => {
    if (store && okToStore(res) && !res.redirected) { const c = res.clone(); event.waitUntil(cache.put(keyReq, c).then(() => trim(cache)).catch(() => {})); }
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  try {
    const first = await Promise.race([net, slow]);
    if (first) return first;
    const hit = await lookup(keyReq, true);
    return hit || await net;                          // slow but nothing saved: keep waiting for the network
  } catch (err) {
    const hit = await lookup(keyReq, true);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(RUNTIME);
  const hit = await lookup(req, false);
  const net = fetch(req).then((res) => { if (okToStore(res)) { const c = res.clone(); event.waitUntil(cache.put(req, c).then(() => trim(cache)).catch(() => {})); } return res; }).catch(() => null);
  if (hit) { event.waitUntil(net); return hit; }
  return (await net) || (await lookup(req, true)) || Response.error();
}

async function page(event, req, url) {
  const key = new Request(url.origin + url.pathname);
  try { return await networkFirst(event, req, key, 4000, !NO_STORE_PAGE.test(url.pathname)); }
  catch (e) {
    if (!NO_STORE_PAGE.test(url.pathname)) { const hit = await lookup(key, false); if (hit) return hit; }
    return (await lookup(new Request(url.origin + '/offline'), false)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), same = url.origin === self.location.origin;
  if (url.search.indexOf('bh-probe') !== -1) return;                       // connectivity check: always the real network
  if (!same && !CDN.test(req.url)) return;                                 // analytics and anything else: untouched
  if (same && url.pathname === '/api/menu') { event.respondWith(networkFirst(event, req, req, 8000, true)); return; }
  if (same && LIVE_ONLY.test(url.pathname)) return;                        // admin, tools, qr, staff, other APIs
  if (req.mode === 'navigate') { event.respondWith(page(event, req, url)); return; }
  if (!same) { event.respondWith(staleWhileRevalidate(event, req)); return; }
  if (req.destination === 'script' || req.destination === 'style') { event.respondWith(networkFirst(event, req, req, 3000, true)); return; }
  event.respondWith(staleWhileRevalidate(event, req));
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
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.indexOf(self.location.origin) === 0);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
