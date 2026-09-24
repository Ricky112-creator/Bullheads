// GET    /api/photos          -> public: [{ id, caption }] newest first
// GET    /api/photos?img=<id> -> public: the image itself
// POST   /api/photos {caption, data} -> owner only: data = JPEG data URL (browser shrinks it first)
// DELETE /api/photos?id=      -> owner only
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const owner = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
let ready = null;
const ensure = (env) => (ready = ready || env.DB.prepare('CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, ts TEXT NOT NULL, caption TEXT, data TEXT NOT NULL)').run().catch((e) => { ready = null; throw e; }));
const PREFIX = 'data:image/jpeg;base64,';

export async function onRequestGet({ request, env }) {
  try {
    await ensure(env);
    const img = new URL(request.url).searchParams.get('img');
    if (img) {
      const r = await env.DB.prepare('SELECT data FROM photos WHERE id = ?').bind(img).first();
      if (!r) return new Response('Not found', { status: 404 });
      const bin = atob(r.data.slice(PREFIX.length));
      return new Response(Uint8Array.from(bin, (c) => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
    }
    const { results } = await env.DB.prepare('SELECT id, caption FROM photos ORDER BY ts DESC LIMIT 60').all();
    return json({ photos: results });
  } catch (e) { return json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function onRequestPost({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (typeof b.data !== 'string' || !b.data.startsWith(PREFIX) || b.data.length > 600000) return json({ error: 'Photo must be a JPEG under ~450 KB' }, { status: 400 });
  await ensure(env);
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM photos').first();
  if (n.c >= 60) return json({ error: 'Photo limit (60) reached. Delete some first.' }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO photos (id, ts, caption, data) VALUES (?, ?, ?, ?)').bind(id, new Date().toISOString(), String(b.caption || '').slice(0, 80), b.data).run();
  return json({ ok: true, id });
}
export async function onRequestDelete({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  await ensure(env);
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
  return json({ ok: true });
}
