// GET    /api/staff        -> owner only: list staff (names, no codes)
// POST   /api/staff {name} -> owner only: create a staff login; the code is shown ONCE
// DELETE /api/staff?id=    -> owner only: remove a staff login
// Staff use their code exactly like the owner code (Authorization: Bearer <code>) but only
// get the Orders tab: see orders and change status. Delete, menu, updates stay owner-only.
// (How a code is checked, and the wrong-code throttle, live in ../_lib/auth.js.)
import { json, sha256, requireRole, ensureStaff } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensureStaff(env);
  const { results } = await env.DB.prepare('SELECT id, name, ts FROM staff ORDER BY ts').all();
  return json({ staff: results });
}
export async function onRequestPost({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  let b; try { b = await request.json(); } catch { b = {}; }
  const name = String(b.name || '').trim().slice(0, 30);
  if (!name) return json({ error: 'Name needed' }, { status: 400 });
  await ensureStaff(env);
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM staff').first();
  if (n.c >= 20) return json({ error: 'Too many staff logins' }, { status: 400 });
  // 10 characters from a 31-symbol alphabet (about 50 bits). Bytes >= 248 are skipped so there is no modulo bias.
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = 'bh-';
  while (code.length < 13) for (const x of crypto.getRandomValues(new Uint8Array(16))) if (x < 248 && code.length < 13) code += chars[x % 31];
  await env.DB.prepare('INSERT INTO staff (id, name, hash, ts) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), name, await sha256(code), new Date().toISOString()).run();
  return json({ ok: true, name, code });
}
export async function onRequestDelete({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensureStaff(env);
  await env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
  return json({ ok: true });
}
