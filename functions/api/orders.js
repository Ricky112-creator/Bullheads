// POST   /api/orders            -> public: the site drops each WhatsApp order here so the owner sees it live
// GET    /api/orders            -> owner only: recent orders (newest first)
// PATCH  /api/orders?id=&status= -> owner only: new | preparing | ready | done
// DELETE /api/orders?id=        -> owner only
// Same KV namespace (UPDATES_KV) and ADMIN_TOKEN as /api/updates.
const MAX_ORDERS = 150;
const STATUSES = ['new', 'preparing', 'ready', 'done'];
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init && init.headers) } });
const authed = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
const read = async (env) => { const r = await env.UPDATES_KV.get('orders'); return r ? JSON.parse(r) : []; };
const save = (env, o) => env.UPDATES_KV.put('orders', JSON.stringify(o.slice(0, MAX_ORDERS)));
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  return json({ orders: await read(env) });
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({
    id: str(i.id, 40), name: str(i.name, 60), qty: Math.min(Number(i.qty) || 0, 100), unit: i.unit === 'kg' ? 'kg' : '', lineTotal: Math.min(Number(i.lineTotal) || 0, 1e6),
  })).filter((i) => i.name && i.qty > 0);
  if (!items.length && !str(b.notes, 10)) return json({ error: 'Empty order' }, { status: 400 });
  const eta = Number(b.etaMinutes) > 0 ? Math.min(Number(b.etaMinutes), 240) : null;
  const order = {
    id: crypto.randomUUID(), ts: new Date().toISOString(), status: 'new',
    type: str(b.type, 20), name: str(b.name, 40), notes: str(b.notes, 200), table: str(b.table, 10), counter: str(b.counter, 30),
    partySize: str(b.partySize, 4), arriving: str(b.arriving, 20), address: str(b.address, 120),
    etaMinutes: eta, etaAt: eta ? new Date(Date.now() + eta * 60000).toISOString() : null,
    items, total: items.reduce((s, i) => s + i.lineTotal, 0),
  };
  const all = await read(env); all.unshift(order); await save(env, all);
  return json({ ok: true });
}

export async function onRequestPatch({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  const u = new URL(request.url), status = u.searchParams.get('status');
  if (!STATUSES.includes(status)) return json({ error: 'Bad status' }, { status: 400 });
  const all = await read(env), o = all.find((x) => x.id === u.searchParams.get('id'));
  if (o) { o.status = status; await save(env, all); }
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  await save(env, (await read(env)).filter((x) => x.id !== id));
  return json({ ok: true });
}
