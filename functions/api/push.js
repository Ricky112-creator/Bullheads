// GET    /api/push          -> public: { publicKey } so the browser can subscribe
// POST   /api/push          -> owner only: save this phone's push subscription
// POST   /api/push?test=1   -> owner only: send a test alert to every saved phone
// DELETE /api/push          -> owner only: remove a subscription (body: { endpoint })
//
// Also exports two helpers used by /api/orders:
//   ensureSchema(env) - creates the D1 tables on first use (no manual SQL needed)
//   notifyOwner(env)  - sends a "new order" push to every saved phone
//
// Needs (Cloudflare Pages -> Settings):
//   - D1 database bound as DB                      (Bindings)
//   - secrets VAPID_PUBLIC and VAPID_PRIVATE        (Variables and Secrets)
//   - optional VAPID_SUBJECT (a mailto: or https: contact, defaults to the site URL)
//
// The push carries no message body on purpose: it just wakes the phone and the
// service worker shows "New Bullhead order". That keeps this file small and means
// no order details ever pass through the browser vendors' push servers.

const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init && init.headers) } });
const authed = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
const MAX_SUBS = 10;

// ---------- database ----------
let schemaReady = null;
export function ensureSchema(env) {
  if (!env.DB) return Promise.reject(new Error('D1 binding "DB" is missing'));
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, ts TEXT NOT NULL, status TEXT NOT NULL, ip TEXT, body TEXT NOT NULL)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS orders_ts ON orders (ts)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, sub TEXT NOT NULL, ts TEXT NOT NULL)'),
    ]).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------- VAPID (RFC 8292) ----------
const b64uToBytes = (s) => {
  s = String(s).trim().replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const bytesToB64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let keyCache = null;
async function signingKey(env) {
  if (keyCache && keyCache.for === env.VAPID_PRIVATE) return keyCache.key;
  const pub = b64uToBytes(env.VAPID_PUBLIC); // 65 bytes: 0x04 | X | Y
  const jwk = { kty: 'EC', crv: 'P-256', x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)), d: String(env.VAPID_PRIVATE).trim() };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  keyCache = { for: env.VAPID_PRIVATE, key };
  return key;
}

export async function vapidHeader(env, endpoint) {
  const enc = (o) => bytesToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'https://bullheadhotels.co.ke',
  });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${bytesToB64u(sig)}, k=${String(env.VAPID_PUBLIC).trim()}`;
}

// Returns how many phones were reached.
export async function notifyOwner(env) {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE) return 0;
  await ensureSchema(env);
  const { results } = await env.DB.prepare('SELECT endpoint FROM push_subs ORDER BY ts DESC LIMIT ?').bind(MAX_SUBS).all();
  let sent = 0;
  await Promise.all(results.map(async (r) => {
    try {
      const res = await fetch(r.endpoint, {
        method: 'POST',
        headers: { Authorization: await vapidHeader(env, r.endpoint), TTL: '43200', Urgency: 'high' },
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(r.endpoint).run();
    } catch (e) { /* one dead phone must never block the others */ }
  }));
  return sent;
}

// ---------- routes ----------
export async function onRequestGet({ env }) {
  return json({ publicKey: env.VAPID_PUBLIC ? String(env.VAPID_PUBLIC).trim() : null });
}

export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSchema(env);
    const u = new URL(request.url);
    if (u.searchParams.get('test')) return json({ ok: true, sent: await notifyOwner(env) });

    let sub; try { sub = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
    const ep = String((sub && sub.endpoint) || '');
    if (!/^https:\/\//.test(ep) || ep.length > 700) return json({ error: 'Bad subscription' }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare('INSERT OR REPLACE INTO push_subs (endpoint, sub, ts) VALUES (?, ?, ?)').bind(ep, JSON.stringify({ endpoint: ep }), new Date().toISOString()),
      env.DB.prepare('DELETE FROM push_subs WHERE endpoint NOT IN (SELECT endpoint FROM push_subs ORDER BY ts DESC LIMIT ?)').bind(MAX_SUBS),
    ]);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSchema(env);
    let b = {}; try { b = await request.json(); } catch {}
    if (b.endpoint) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(String(b.endpoint)).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e.message || e) }, { status: 500 });
  }
}
