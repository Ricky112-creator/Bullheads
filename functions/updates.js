// GET    /api/updates          -> public, returns currently-live updates
// POST   /api/updates          -> owner only, posts a new update
// POST   /api/updates?tap=<id> -> public, counts one WhatsApp-button tap (D1, rate-limited)
// DELETE /api/updates?id=<id>  -> owner only, removes one early
//
// Storage: a single JSON array under the KV key "updates", newest first,
// capped at MAX_UPDATES entries. Each entry:
//   { id, text, postedAt (ISO string), expiresAt (ISO string | null) }
//
// Requires, set in the Cloudflare Pages dashboard under
// Settings -> Functions -> Bindings/Variables:
//   - a KV namespace bound as UPDATES_KV
//   - a secret ADMIN_TOKEN (the owner's access code — pick anything, e.g.
//     a long random phrase; it's typed into /admin.html, never shown to
//     site visitors)

import { requireRole, ipHash, rlCount, rlHit } from '../_lib/auth.js';

const MAX_UPDATES = 30; // history kept for Repost + stats
const TYPES = ['special', 'stock', 'notice', 'closing'];
const MAX_TEXT_LENGTH = 140;

async function readUpdates(env) {
  const raw = await env.UPDATES_KV.get('updates');
  return raw ? JSON.parse(raw) : [];
}

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init && init.headers) },
  });
}

// "Tap" counts (visitors pressing the WhatsApp button on an update) live in D1, NOT in the KV
// array: a public request must never trigger a KV write (the free tier allows only 1,000 a day,
// and the same quota is what saves your menu and updates).
let tapsReady = null;
const ensureTaps = (env) => (tapsReady = tapsReady || env.DB.prepare('CREATE TABLE IF NOT EXISTS update_taps (id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)').run().catch((e) => { tapsReady = null; throw e; }));
async function tapCounts(env) {
  if (!env.DB) return {};
  try { await ensureTaps(env); const { results } = await env.DB.prepare('SELECT id, n FROM update_taps').all(); return Object.fromEntries(results.map((r) => [r.id, r.n])); } catch (e) { return {}; }
}

// Public and tiny: a visitor tapped the WhatsApp button on an update. Does nothing else, ever.
async function handleTap(request, env, id) {
  try {
    if (env.DB && /^[0-9a-f-]{36}$/i.test(id)) {
      const key = 'tap:' + ((await ipHash(request)) || 'unknown');
      if ((await rlCount(env, key, 10 * 60000)) < 10) {
        await rlHit(env, key);
        if ((await readUpdates(env)).some((u) => u.id === id)) {         // only real updates can be counted (KV read, not write)
          await ensureTaps(env);
          await env.DB.prepare('INSERT INTO update_taps (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1').bind(id).run();
        }
      }
    }
  } catch (e) { /* counting taps must never break the page */ }
  return json({ ok: true });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const updates = await readUpdates(env);
  const now = Date.now();

  // Owner view: everything (live + past) with tap counts, never cached.
  if (new URL(request.url).searchParams.get('all') === '1') {
    const g = await requireRole(request, env, ['owner']);
    if (g.res) return g.res;
    const taps = await tapCounts(env);
    return json({ updates: updates.map((u) => ({ ...u, taps: (u.taps || 0) + (taps[u.id] || 0) })) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const live = updates
    .filter((u) => !u.expiresAt || new Date(u.expiresAt).getTime() > now)
    .slice(0, 5)
    .map(({ taps, ...pub }) => pub); // keep stats private

  // Short cache so the bar still feels "live" without hitting KV on every
  // single page view.
  return json({ updates: live }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Public "tap" counter: handled first and returns, so it can never reach anything below.
  const tap = url.searchParams.get('tap');
  if (tap) return handleTap(request, env, tap);

  // Everything else is owner-only.
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Owner-only helper: draft a Swahili version for the owner to review.
  // Needs a Workers AI binding named AI (Pages -> Settings -> Bindings).
  if (url.searchParams.get('translate')) {
    if (!env.AI) return json({ error: 'Auto-translate is not enabled yet' }, { status: 501 });
    try {
      const out = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text: String(body.text || '').slice(0, MAX_TEXT_LENGTH), source_lang: 'english', target_lang: 'swahili',
      });
      return json({ text: out.translated_text || '' });
    } catch (e) {
      return json({ error: 'Translation failed' }, { status: 502 });
    }
  }

  const text = String(body.text || '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) return json({ error: 'text is required' }, { status: 400 });

  const hours = Number(body.expiresInHours);
  const entry = {
    id: crypto.randomUUID(),
    text,
    textSw: String(body.textSw || '').trim().slice(0, MAX_TEXT_LENGTH) || undefined,
    type: TYPES.includes(body.type) ? body.type : 'notice',
    cta: body.cta !== false, // show "Order on WhatsApp" button
    taps: 0,
    postedAt: new Date().toISOString(),
    expiresAt: hours > 0 ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null,
  };

  const updates = await readUpdates(env);
  updates.unshift(entry);
  updates.length = Math.min(updates.length, MAX_UPDATES);
  await env.UPDATES_KV.put('updates', JSON.stringify(updates));

  return json({ ok: true, entry });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;

  const id = new URL(request.url).searchParams.get('id');
  const updates = await readUpdates(env);
  await env.UPDATES_KV.put('updates', JSON.stringify(updates.filter((u) => u.id !== id)));

  return json({ ok: true });
}
