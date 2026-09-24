// GET    /api/updates          -> public, returns currently-live updates
// POST   /api/updates          -> owner only, posts a new update
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

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const updates = await readUpdates(env);
  const now = Date.now();

  // Owner view: everything (live + past) with tap counts, never cached.
  if (new URL(request.url).searchParams.get('all') === '1') {
    if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
    return json({ updates }, { headers: { 'Cache-Control': 'no-store' } });
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
  const isTap = new URL(request.url).searchParams.get('tap');
  if (!isTap && !isAuthorized(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  if (!isTap) try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Owner-only helper: draft a Swahili version for the owner to review.
  // Needs a Workers AI binding named AI (Pages -> Settings -> Bindings).
  if (new URL(request.url).searchParams.get('translate')) {
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

  // Public, tiny: a visitor tapped the WhatsApp button on an update.
  // (Taps only, not views, to stay well inside KV's free write limits.)
  const track = new URL(request.url).searchParams.get('tap');
  if (track) {
    const all = await readUpdates(env);
    const hit = all.find((u) => u.id === track);
    if (hit) { hit.taps = (hit.taps || 0) + 1; await env.UPDATES_KV.put('updates', JSON.stringify(all)); }
    return json({ ok: true });
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
  if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  const updates = await readUpdates(env);
  await env.UPDATES_KV.put('updates', JSON.stringify(updates.filter((u) => u.id !== id)));

  return json({ ok: true });
}
