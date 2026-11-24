// GET  /api/menu[?branch=one|two] -> public: per-item overrides { [itemId]: { price?, special?, soldOut?, until? } }
//      A branch site (branch1./branch2.) gets that branch's board if the owner has saved one, otherwise the shared board.
// POST /api/menu -> owner only: replaces the overrides (body: { menu: {...}, branch?: 'all'|'main'|'one'|'two' }).
//      'all' (or nothing)  every site gets this exact board (the shared board and both branch boards).
//      'main'              the main site only: branches that were following the shared board are first pinned to what they
//                          show now, so this edit does not leak onto them.
//      'one' / 'two'       that branch's own board (e.g. Branch 2 sold out of tilapia).
//      Every board is saved with a timestamp (KV metadata) so a branch site can tell which edit is newest.
// Same KV namespace (UPDATES_KV) and ADMIN_TOKEN as /api/updates.
import { json, requireRole } from '../_lib/auth.js';
import { BRANCH_KEYS, cleanBranch, hostBranch } from '../_lib/branches.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const br = hostBranch(u.hostname) || cleanBranch(u.searchParams.get('branch'));
  // the branch's own board if the owner saved one, otherwise the shared board (which is also what the main site shows)
  const own = br ? await env.UPDATES_KV.getWithMetadata('menu:' + br) : { value: null };
  const src = own.value ? own : await env.UPDATES_KV.getWithMetadata('menu');
  const cust = await env.UPDATES_KV.get('menu-custom');
  const ts = (src.metadata && src.metadata.ts) || 0;
  return json({ menu: src.value ? JSON.parse(src.value) : {}, custom: cust ? JSON.parse(cust) : [], ts }, { headers: { 'Cache-Control': 'public, max-age=15' } });
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
  const scope = body.branch === 'main' ? 'main' : (cleanBranch(body.branch) || 'all');
  const val = JSON.stringify(clean), meta = { metadata: { ts: Date.now() } };
  if (scope === 'one' || scope === 'two') {
    await env.UPDATES_KV.put('menu:' + scope, val, meta);
  } else if (scope === 'main') {
    // pin first: a branch with no board of its own was following the shared one, so freeze it at what it shows today
    const shared = (await env.UPDATES_KV.get('menu')) || '{}';
    for (const k of BRANCH_KEYS) if (!(await env.UPDATES_KV.get('menu:' + k))) await env.UPDATES_KV.put('menu:' + k, shared, { metadata: { ts: 1 } });
    await env.UPDATES_KV.put('menu', val, meta);
  } else {
    await env.UPDATES_KV.put('menu', val, meta);
    for (const k of BRANCH_KEYS) await env.UPDATES_KV.put('menu:' + k, val, meta);
  }

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
