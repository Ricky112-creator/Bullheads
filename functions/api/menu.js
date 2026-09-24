// GET  /api/menu -> public: per-item overrides { [itemId]: { price?, special?, soldOut?, until? } }
// POST /api/menu -> owner only: replaces the overrides (body: { menu: {...} })
// Same KV namespace (UPDATES_KV) and ADMIN_TOKEN as /api/updates.
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', ...(init && init.headers) } });
const authed = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;

export async function onRequestGet({ env }) {
  const raw = await env.UPDATES_KV.get('menu');
  const cust = await env.UPDATES_KV.get('menu-custom');
  return json({ menu: raw ? JSON.parse(raw) : {}, custom: cust ? JSON.parse(cust) : [] }, { headers: { 'Cache-Control': 'public, max-age=15' } });
}

export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  let body; try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clean = {};
  for (const [id, m] of Object.entries(body.menu || {}).slice(0, 200)) {
    if (!/^[a-z0-9-]{1,40}$/.test(id) || !m || typeof m !== 'object') continue;
    const e = {};
    if (typeof m.price === 'number' && m.price >= 0 && m.price <= 100000) e.price = m.price;
    if (m.special === true) e.special = true;
    if (m.soldOut === true) e.soldOut = true;
    if (e.soldOut && m.until && !isNaN(Date.parse(m.until))) e.until = new Date(m.until).toISOString();
    if (Object.keys(e).length) clean[id] = e;
  }
  await env.UPDATES_KV.put('menu', JSON.stringify(clean));

  // Owner-added dishes (whole list replaced each save).
  let custom;
  if (Array.isArray(body.custom)) {
    custom = body.custom.slice(0, 60).map((c) => ({
      id: String(c.id || ''), category: String(c.category || '').trim().slice(0, 40), name: String(c.name || '').trim().slice(0, 60),
      price: typeof c.price === 'number' && c.price >= 0 && c.price <= 100000 ? c.price : null, unit: c.unit === 'kg' ? 'kg' : '',
    })).filter((c) => /^[a-z0-9-]{1,40}$/.test(c.id) && c.name && c.category);
    await env.UPDATES_KV.put('menu-custom', JSON.stringify(custom));
  }
  return json({ ok: true, menu: clean, custom });
}
