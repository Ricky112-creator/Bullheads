// Shared helpers for every /api endpoint: JSON replies, who-is-calling (owner / staff),
// and a small rate limiter. Lives in functions/_lib/ so it is NOT a public route
// (only files that export onRequest* handlers become routes).
//
// Everything here uses the same D1 database (binding: DB) that orders already need,
// so there is nothing new to set up and nothing new to pay for.

export const json = (d, init) => new Response(JSON.stringify(d), {
  ...init,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(init && init.headers) },
});

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// A short, non-reversible-in-practice fingerprint of the caller's address (used for rate limits only).
export async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!ip) return '';
  return (await sha256(ip)).slice(0, 16);
}

// Constant-time string comparison (compares fixed-length digests, so timing never leaks how much matched).
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}

// ---------- tiny rate limiter (D1) ----------
let rlReady = null;
function rlEnsure(env) {
  if (!env.DB) return Promise.reject(new Error('no DB'));
  return (rlReady = rlReady || env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS rl (k TEXT NOT NULL, ts TEXT NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS rl_k_ts ON rl (k, ts)'),
  ]).catch((e) => { rlReady = null; throw e; }));
}
// How many hits for `key` in the last windowMs. Fails OPEN (returns 0) if the database is unavailable.
export async function rlCount(env, key, windowMs) {
  try {
    await rlEnsure(env);
    const r = await env.DB.prepare('SELECT COUNT(*) AS c FROM rl WHERE k = ? AND ts > ?').bind(key, new Date(Date.now() - windowMs).toISOString()).first();
    return r ? r.c : 0;
  } catch (e) { return 0; }
}
export async function rlHit(env, key) {
  try {
    await rlEnsure(env);
    await env.DB.prepare('INSERT INTO rl (k, ts) VALUES (?, ?)').bind(key, new Date().toISOString()).run();
    if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM rl WHERE ts < ?').bind(new Date(Date.now() - 3600e3).toISOString()).run();
  } catch (e) { /* best effort */ }
}

// ---------- staff logins ----------
let staffReady = null;
export const ensureStaff = (env) => (staffReady = staffReady || env.DB.prepare('CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, ts TEXT NOT NULL)').run().catch((e) => { staffReady = null; throw e; }));
async function isStaffToken(t, env) {
  if (!env.DB) return false;
  try { await ensureStaff(env); return !!(await env.DB.prepare('SELECT 1 AS x FROM staff WHERE hash = ?').bind(await sha256(t)).first()); } catch (e) { return false; }
}

// ---------- who is calling? ----------
// 'owner' | 'staff' | 'none' (no code, or a wrong one) | 'locked' (too many wrong codes from this address).
// The lock is checked BEFORE the code is compared, so guessing is throttled no matter how lucky a guess is.
// A staff code on an owner-only page is not a "wrong code", so it never counts against anyone.
const FAIL_MAX = 30, FAIL_WINDOW = 10 * 60000;
export async function roleOf(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t || t.length > 200) return 'none';
  const key = 'auth:' + ((await ipHash(request)) || 'unknown');
  if ((await rlCount(env, key, FAIL_WINDOW)) >= FAIL_MAX) return 'locked';
  if (env.ADMIN_TOKEN && (await safeEqual(t, String(env.ADMIN_TOKEN)))) return 'owner';
  if (await isStaffToken(t, env)) return 'staff';
  await rlHit(env, key);
  return 'none';
}

// Usage:  const g = await requireRole(request, env, ['owner']);  if (g.res) return g.res;
export async function requireRole(request, env, allow) {
  const role = await roleOf(request, env);
  if (role === 'locked') return { res: json({ error: 'Too many wrong codes. Try again in a few minutes.' }, { status: 429 }) };
  if (!(allow || ['owner']).includes(role)) return { res: json({ error: 'Unauthorized' }, { status: 401 }) };
  return { role };
}
