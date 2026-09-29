// GET  /api/settings -> owner only: { custom } (true once the owner has changed the code from the dashboard)
// POST /api/settings { current, next } -> owner only: change the owner access code. Every other phone that is signed in with
//                                         the old code is signed out, because the old code stops working.
// How the code is checked (and how it can be reset) lives in ../_lib/auth.js.
import { json, requireRole, isOwnerCode, setOwnerCode, hasCustomOwnerCode, rlHit, ipHash } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  return json({ custom: await hasCustomOwnerCode(env) });
}

export async function onRequestPost({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  if (!env.DB) return json({ error: 'The database is not connected' }, { status: 500 });
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const cur = String(b.current || ''), next = String(b.next || '');
  // The current code must be typed again, so a phone left unlocked cannot lock the owner out.
  if (!(await isOwnerCode(env, cur))) {
    await rlHit(env, 'auth:' + ((await ipHash(request)) || 'unknown'));   // guessing here counts like a wrong sign-in
    return json({ error: 'Your current access code is not right' }, { status: 403 });
  }
  if (next.length < 8) return json({ error: 'The new code must be at least 8 characters' }, { status: 400 });
  if (next.length > 100) return json({ error: 'The new code is too long (100 characters at most)' }, { status: 400 });
  if (next !== next.trim()) return json({ error: 'The new code cannot start or end with a space' }, { status: 400 });
  if (next === cur) return json({ error: 'Pick a code different from the current one' }, { status: 400 });
  try { await setOwnerCode(env, next); } catch (e) { return json({ error: 'Could not save the new code' }, { status: 500 }); }
  return json({ ok: true });
}
