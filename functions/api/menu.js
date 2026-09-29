// GET  /api/menu[?branch=one|two] -> public: per-item overrides { [itemId]: { price?, special?, soldOut?, until? } }
//      A branch site (branch1./branch2.) gets that branch's board if the owner has saved one, otherwise the shared board.
// POST /api/menu -> owner only: replaces the overrides (body: { menu: {...}, branch?: 'one'|'two' }).
//      With a branch it saves that branch's own board (e.g. Bullhead Two sold out of tilapia); without, the shared board.
// Same KV namespace (UPDATES_KV) and ADMIN_TOKEN as /api/updates.
import { json, requireRole } from '../_lib/auth.js';
import { cleanBranch, hostBranch } from '../_lib/branches.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const br = hostBranch(u.hostname) || cleanBranch(u.searchParams.get('branch'));
  const raw = (br && (await env.UPDATES_KV.get('menu:' + br))) || (await env.UPDATES_KV.get('menu'));
  const cust = await env.UPDATES_KV.get('menu-custom');
  return json({ menu: raw ? JSON.parse(raw) : {}, custom: cust ? JSON.parse(cust) : [] }, { headers: { 'Cache-Control': 'public, max-age=15' } });
}

export async function onRequestPost({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
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
  const branch = cleanBranch(body.branch);
  await env.UPDATES_KV.put(branch ? 'menu:' + branch : 'menu', JSON.stringify(clean));

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
