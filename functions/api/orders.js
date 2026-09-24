// POST   /api/orders            -> public: the site drops each WhatsApp order here so the owner sees it live
// GET    /api/orders            -> owner only: recent orders (newest first)
// GET    /api/orders?id=<uuid>  -> public: ONE order's progress, for the customer's tracking page
// PATCH  /api/orders?id=&status= -> owner only: new | preparing | ready | done
// DELETE /api/orders?id=        -> owner only
//
// Orders now live in a D1 database (binding: DB), one row per order, so two orders
// arriving at the same moment can never overwrite each other (the old single-array
// KV storage could). The tables are created automatically on first use.
// ADMIN_TOKEN is the same owner access code as /api/updates.
import { ensureSchema, notifyOwner } from './push.js';

const MAX_KEEP = 1000;     // rows kept in the database
const MAX_LIST = 150;      // rows the dashboard loads
const RATE_LIMIT = 20;     // orders per device address per 10 minutes (generous: mobile networks share addresses)
const STATUSES = ['new', 'preparing', 'ready', 'done'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init && init.headers) } });
const authed = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const fail = (e) => json({ error: String((e && e.message) || e) }, { status: 500 });

async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!ip) return '';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
  // Customer tracking: the order id is a random UUID that only the customer (and the
  // WhatsApp chat) has, so knowing it is the credential. Only progress details are
  // returned: never the name, address, notes or phone details.
  const pub = new URL(request.url).searchParams.get('id');
  if (pub !== null) {
    if (!UUID_RE.test(pub)) return json({ error: 'Not found' }, { status: 404 });
    try {
      await ensureSchema(env);
      const r = await env.DB.prepare('SELECT status, body FROM orders WHERE id = ?').bind(pub.toLowerCase()).first();
      if (!r) return json({ error: 'Not found' }, { status: 404 });
      const o = JSON.parse(r.body);
      return json({ order: {
        status: r.status, type: o.type, ts: o.ts, etaAt: o.etaAt || null, table: o.table || '', total: o.total || 0,
        items: (o.items || []).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
      } });
    } catch (e) { return fail(e); }
  }
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare('SELECT id, status, body FROM orders ORDER BY ts DESC LIMIT ?').bind(MAX_LIST).all();
    return json({ orders: results.map((r) => ({ ...JSON.parse(r.body), id: r.id, status: r.status })) });
  } catch (e) { return fail(e); }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({
    id: str(i.id, 40), name: str(i.name, 60), qty: Math.min(Number(i.qty) || 0, 100), unit: i.unit === 'kg' ? 'kg' : '', lineTotal: Math.min(Number(i.lineTotal) || 0, 1e6),
  })).filter((i) => i.name && i.qty > 0);
  if (!items.length && !str(b.notes, 10)) return json({ error: 'Empty order' }, { status: 400 });
  const eta = Number(b.etaMinutes) > 0 ? Math.min(Number(b.etaMinutes), 240) : null;
  const order = {
    // The browser makes the id so the tracking link can go into the WhatsApp message instantly.
    id: UUID_RE.test(String(b.id || '')) ? String(b.id).toLowerCase() : crypto.randomUUID(), ts: new Date().toISOString(), status: 'new',
    type: str(b.type, 20), name: str(b.name, 40), notes: str(b.notes, 200), table: str(b.table, 10), counter: str(b.counter, 30),
    partySize: str(b.partySize, 4), arriving: str(b.arriving, 20), address: str(b.address, 120),
    etaMinutes: eta, etaAt: eta ? new Date(Date.now() + eta * 60000).toISOString() : null,
    items, total: items.reduce((s, i) => s + i.lineTotal, 0),
  };
  try {
    await ensureSchema(env);
    const ip = await ipHash(request);
    if (ip) {
      const since = new Date(Date.now() - 10 * 60000).toISOString();
      const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM orders WHERE ip = ? AND ts > ?').bind(ip, since).first();
      if (row && row.c >= RATE_LIMIT) return json({ error: 'Too many orders — please try again in a few minutes' }, { status: 429 });
    }
    await env.DB.batch([
      env.DB.prepare('INSERT INTO orders (id, ts, status, ip, body) VALUES (?, ?, ?, ?, ?)').bind(order.id, order.ts, order.status, ip, JSON.stringify(order)),
      env.DB.prepare('DELETE FROM orders WHERE id NOT IN (SELECT id FROM orders ORDER BY ts DESC LIMIT ?)').bind(MAX_KEEP),
    ]);
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String((e && e.message) || e))) return json({ error: 'Duplicate order' }, { status: 409 });
    return fail(e);
  }

  // Buzz the owner's phone(s) after the response has gone back to the customer.
  const push = notifyOwner(env).catch(() => {});
  if (waitUntil) waitUntil(push);
  return json({ ok: true, id: order.id });
}

export async function onRequestPatch({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  const u = new URL(request.url), status = u.searchParams.get('status');
  if (!STATUSES.includes(status)) return json({ error: 'Bad status' }, { status: 400 });
  try {
    await ensureSchema(env);
    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, u.searchParams.get('id') || '').run();
    return json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function onRequestDelete({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
