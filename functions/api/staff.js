// GET    /api/staff        -> owner only: list staff (names, no codes)
// POST   /api/staff {name} -> owner only: create a staff login; the code is shown ONCE
// DELETE /api/staff?id=    -> owner only: remove a staff login
// Staff use their code exactly like the owner code (Authorization: Bearer <code>) but only
// get the Orders tab: see orders and change status. Delete, menu, updates stay owner-only.
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const owner = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
let ready = null;
const ensure = (env) => (ready = ready || env.DB.prepare('CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, ts TEXT NOT NULL)').run().catch((e) => { ready = null; throw e; }));

export async function isStaff(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer /, '').trim();
  if (!t || !env.DB) return false;
  try { await ensure(env); return !!(await env.DB.prepare('SELECT 1 AS x FROM staff WHERE hash = ?').bind(await sha(t)).first()); } catch { return false; }
}

export async function onRequestGet({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  await ensure(env);
  const { results } = await env.DB.prepare('SELECT id, name, ts FROM staff ORDER BY ts').all();
  return json({ staff: results });
}
export async function onRequestPost({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  let b; try { b = await request.json(); } catch { b = {}; }
  const name = String(b.name || '').trim().slice(0, 30);
  if (!name) return json({ error: 'Name needed' }, { status: 400 });
  await ensure(env);
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM staff').first();
  if (n.c >= 20) return json({ error: 'Too many staff logins' }, { status: 400 });
  const a = crypto.getRandomValues(new Uint8Array(8)), chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const code = 'bh-' + [...a].map((x) => chars[x % chars.length]).join('');
  await env.DB.prepare('INSERT INTO staff (id, name, hash, ts) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), name, await sha(code), new Date().toISOString()).run();
  return json({ ok: true, name, code });
}
export async function onRequestDelete({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  await ensure(env);
  await env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
  return json({ ok: true });
}
