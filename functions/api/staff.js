// GET    /api/staff        -> owner only: list staff (names, no codes)
// POST   /api/staff {name, branch} -> owner only: create a staff login for one branch ('one'|'two'); the code is shown ONCE
// PATCH  /api/staff?id=&branch=    -> owner only: move a login to a branch ('' = all branches)
// DELETE /api/staff?id=    -> owner only: remove a staff login
// Staff use their code exactly like the owner code (Authorization: Bearer <code>) but only
// get the Orders tab: see orders and change status. Delete, menu, updates stay owner-only.
// (How a code is checked, and the wrong-code throttle, live in ../_lib/auth.js.)
import { json, sha256, requireRole, ensureStaff } from '../_lib/auth.js';
import { cleanBranch } from '../_lib/branches.js';

export async function onRequestGet({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensureStaff(env);
  const { results } = await env.DB.prepare('SELECT s.id AS id, s.name AS name, s.ts AS ts, COALESCE(b.branch, \'\') AS branch FROM staff s LEFT JOIN staff_branch b ON b.id = s.id ORDER BY s.ts').all();
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
  const id = crypto.randomUUID(), branch = cleanBranch(b.branch);
  const stmts = [env.DB.prepare('INSERT INTO staff (id, name, hash, ts) VALUES (?, ?, ?, ?)').bind(id, name, await sha256(code), new Date().toISOString())];
  if (branch) stmts.push(env.DB.prepare('INSERT INTO staff_branch (id, branch) VALUES (?, ?)').bind(id, branch));
  await env.DB.batch(stmts);
  return json({ ok: true, name, code, branch });
}
export async function onRequestDelete({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensureStaff(env);
  const id = new URL(request.url).searchParams.get('id') || '';
  await env.DB.batch([env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(id), env.DB.prepare('DELETE FROM staff_branch WHERE id = ?').bind(id)]);
  return json({ ok: true });
}
export async function onRequestPatch({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensureStaff(env);
  const u = new URL(request.url), id = u.searchParams.get('id') || '', branch = cleanBranch(u.searchParams.get('branch'));
  const has = await env.DB.prepare('SELECT 1 AS x FROM staff WHERE id = ?').bind(id).first();
  if (!has) return json({ error: 'Login not found' }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare('DELETE FROM staff_branch WHERE id = ?').bind(id),
    ...(branch ? [env.DB.prepare('INSERT INTO staff_branch (id, branch) VALUES (?, ?)').bind(id, branch)] : []),
  ]);
  return json({ ok: true, branch });
}
