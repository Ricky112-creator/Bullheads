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

const MAX_UPDATES = 5;
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
  const updates = await readUpdates(context.env);
  const now = Date.now();
  const live = updates.filter((u) => !u.expiresAt || new Date(u.expiresAt).getTime() > now);

  // Short cache so the bar still feels "live" without hitting KV on every
  // single page view.
  return json({ updates: live }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = String(body.text || '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) return json({ error: 'text is required' }, { status: 400 });

  const hours = Number(body.expiresInHours);
  const entry = {
    id: crypto.randomUUID(),
    text,
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
