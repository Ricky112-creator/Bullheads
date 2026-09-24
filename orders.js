// POST   /api/orders            -> public: the site records each order here BEFORE it opens WhatsApp
// GET    /api/orders            -> owner or staff: recent orders (newest first)
// GET    /api/orders?id=<uuid>  -> public: ONE order's progress, for the customer's tracking page
// PATCH  /api/orders?id=&status= -> owner or staff: confirm / preparing / ready / done / cancelled
// DELETE /api/orders?id=        -> owner only
//
// The dashboard is the order; the WhatsApp message is a receipt that carries the same short
// order code (#K7Q2M, worked out from the id by js/order-utils.js).
//
// Statuses:  unconfirmed -> new -> preparing -> ready -> done   (or cancelled)
//   * Anything that reaches us with only the website's word for it starts as "unconfirmed":
//     staff confirm it (they see the WhatsApp message with the same code, or they call/WhatsApp
//     the customer from the card) before the kitchen starts. That stops ghost orders where
//     the customer never pressed Send in WhatsApp.
//   * A dine-in order from a table QR code (?table=N) is already in the room, so it starts as "new".
//
// Orders live in a D1 database (binding: DB), one row per order. Tables are created automatically.
import { ensureSchema, notifyOwner } from './push.js';
import { json, ipHash, requireRole } from '../_lib/auth.js';

const MAX_KEEP = 3000;     // finished / cancelled / unconfirmed rows kept (live orders are never trimmed)
const MAX_LIST = 150;      // rows the dashboard loads
const RATE_LIMIT = 20;     // orders per device address per 10 minutes (generous: mobile networks share addresses)
const GLOBAL_LIMIT = 60;   // orders from everyone per 10 minutes: far above real life, stops floods from rotating addresses
const STATUSES = ['unconfirmed', 'new', 'preparing', 'ready', 'done', 'cancelled'];
const TYPES = ['dine-in', 'delivery', 'drive-through', 'reserve', 'on-the-way'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^https:\/\/maps\.google\.com\/\?q=-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const fail = (e) => json({ error: String((e && e.message) || e) }, { status: 500 });

// Kenyan mobile number in any usual spelling -> 2547XXXXXXXX / 2541XXXXXXXX, or '' if it isn't one.
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^[17]\d{8}$/.test(d) ? '254' + d : '';
}

export async function onRequestGet({ request, env }) {
  // Customer tracking: the order id is a random UUID that only the customer (and the
  // WhatsApp chat) has, so knowing it is the credential. Only progress details are
  // returned: never the name, phone, address, pin or notes.
  const pub = new URL(request.url).searchParams.get('id');
  if (pub !== null) {
    if (!UUID_RE.test(pub)) return json({ error: 'Not found' }, { status: 404 });
    try {
      await ensureSchema(env);
      const r = await env.DB.prepare('SELECT status, body FROM orders WHERE id = ?').bind(pub.toLowerCase()).first();
      if (!r) return json({ error: 'Not found' }, { status: 404 });
      const o = JSON.parse(r.body);
      return json({ order: {
        status: r.status, type: o.type, ts: o.ts, etaAt: o.etaAt || null, table: o.table || '', counter: o.counter || '', total: o.total || 0,
        items: (o.items || []).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
      } });
    } catch (e) { return fail(e); }
  }
  const g = await requireRole(request, env, ['owner', 'staff']);
  if (g.res) return g.res;
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare('SELECT id, status, body FROM orders ORDER BY ts DESC LIMIT ?').bind(MAX_LIST).all();
    return json({ orders: results.map((r) => ({ ...JSON.parse(r.body), id: r.id, status: r.status })) });
  } catch (e) { return fail(e); }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const type = str(b.type, 20);
  if (!TYPES.includes(type)) return json({ error: 'Bad order type' }, { status: 400 });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({
    id: str(i.id, 40), name: str(i.name, 60), qty: Math.min(Number(i.qty) || 0, 100), unit: i.unit === 'kg' ? 'kg' : '', lineTotal: Math.min(Number(i.lineTotal) || 0, 1e6),
  })).filter((i) => i.name && i.qty > 0);
  // A table reservation is a real request even with no food and no note.
  if (!items.length && !str(b.notes, 10) && type !== 'reserve') return json({ error: 'Empty order' }, { status: 400 });

  const table = /^\d{1,3}$/.test(str(b.table, 10)) ? str(b.table, 10) : '';
  const atTable = type === 'dine-in' && !!table;           // ordering from a table QR code: already in the room
  const phone = normPhone(b.phone);
  if (!atTable && !phone) return json({ error: 'Please add a valid phone number (e.g. 0712 345 678) so we can reach you about this order.', field: 'phone' }, { status: 400 });
  const pin = type === 'delivery' && PIN_RE.test(str(b.pin, 100)) ? str(b.pin, 100) : '';

  const eta = Number(b.etaMinutes) > 0 ? Math.min(Number(b.etaMinutes), 240) : null;
  const order = {
    // The browser makes the id so the tracking link and order code can go into the WhatsApp message instantly.
    id: UUID_RE.test(String(b.id || '')) ? String(b.id).toLowerCase() : crypto.randomUUID(), ts: new Date().toISOString(),
    status: atTable ? 'new' : 'unconfirmed',
    type, name: str(b.name, 40), phone, notes: str(b.notes, 200), table, counter: str(b.counter, 30),
    partySize: str(b.partySize, 4), arriving: str(b.arriving, 20), address: str(b.address, 120), pin,
    etaMinutes: eta, etaAt: eta ? new Date(Date.now() + eta * 60000).toISOString() : null,
    items, total: items.reduce((s, i) => s + i.lineTotal, 0),
  };
  try {
    await ensureSchema(env);
    const ip = await ipHash(request);
    const since = new Date(Date.now() - 10 * 60000).toISOString();
    if (ip) {
      const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM orders WHERE ip = ? AND ts > ?').bind(ip, since).first();
      if (row && row.c >= RATE_LIMIT) return json({ error: 'Too many orders — please try again in a few minutes' }, { status: 429 });
    }
    const all = await env.DB.prepare('SELECT COUNT(*) AS c FROM orders WHERE ts > ?').bind(since).first();
    if (all && all.c >= GLOBAL_LIMIT) return json({ error: 'We are getting a lot of orders right now — please try again in a few minutes' }, { status: 429 });
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO orders (id, ts, status, ip, body) VALUES (?, ?, ?, ?, ?)').bind(order.id, order.ts, order.status, ip, JSON.stringify(order)),
      // Housekeeping, done here so no scheduled job (or bill) is needed:
      // an unconfirmed order nobody picked up for a day is dead: cancel it
      env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE status = 'unconfirmed' AND ts < ?").bind(new Date(now - 24 * 3600e3).toISOString()),
      // keep the newest MAX_KEEP finished rows; orders still being worked on are never trimmed
      env.DB.prepare("DELETE FROM orders WHERE status IN ('done','cancelled','unconfirmed') AND id NOT IN (SELECT id FROM orders WHERE status IN ('done','cancelled','unconfirmed') ORDER BY ts DESC LIMIT ?)").bind(MAX_KEEP),
      // privacy: phone, address and pin are wiped 30 days after the order; the address fingerprint used for rate limits after a day
      env.DB.prepare("UPDATE orders SET body = json_remove(body, '$.phone', '$.address', '$.pin') WHERE ts < ? AND (body LIKE '%\"phone\":\"2%' OR body LIKE '%\"address\":\"_%' OR body LIKE '%\"pin\":\"h%')").bind(new Date(now - 30 * 24 * 3600e3).toISOString()),
      env.DB.prepare('UPDATE orders SET ip = NULL WHERE ip IS NOT NULL AND ts < ?').bind(new Date(now - 24 * 3600e3).toISOString()),
    ]);
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String((e && e.message) || e))) return json({ error: 'Duplicate order' }, { status: 409 });
    return fail(e);
  }

  // Buzz the owner's phone(s) after the response has gone back to the customer.
  const push = notifyOwner(env).catch(() => {});
  if (waitUntil) waitUntil(push);
  return json({ ok: true, id: order.id, status: order.status });
}

export async function onRequestPatch({ request, env }) {
  const g = await requireRole(request, env, ['owner', 'staff']);
  if (g.res) return g.res;
  const u = new URL(request.url), status = u.searchParams.get('status');
  if (!STATUSES.includes(status)) return json({ error: 'Bad status' }, { status: 400 });
  try {
    await ensureSchema(env);
    const r = await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, u.searchParams.get('id') || '').run();
    if (r && r.meta && r.meta.changes === 0) return json({ error: 'Order not found' }, { status: 404 });
    return json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function onRequestDelete({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
