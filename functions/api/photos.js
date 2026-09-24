// GET    /api/photos             -> public: published photos [{ id, caption }]
// GET    /api/photos?img=<id>    -> public: a published image (owner code: any image, incl. drafts)
// GET    /api/photos?all=1       -> owner only: every photo, with { published }
// POST   /api/photos {caption, data}       -> owner only: uploads as a DRAFT (not public yet)
// PATCH  /api/photos?id= {caption?, data?, published?} -> owner only: edit / rotate / publish / unpublish
// DELETE /api/photos?id=         -> owner only
const json = (d, init) => new Response(JSON.stringify(d), { ...init, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const owner = (req, env) => env.ADMIN_TOKEN && (req.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_TOKEN}`;
const PREFIX = 'data:image/jpeg;base64,';
const okData = (d) => typeof d === 'string' && d.startsWith(PREFIX) && d.length <= 600000;
let ready = null;
const ensure = (env) => (ready = ready || (async () => {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, ts TEXT NOT NULL, caption TEXT, data TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1)').run();
  // Older databases don't have "published" yet. Existing photos stay live (default 1).
  try { await env.DB.prepare('ALTER TABLE photos ADD COLUMN published INTEGER NOT NULL DEFAULT 1').run(); } catch (e) { /* already there */ }
})().catch((e) => { ready = null; throw e; }));

export async function onRequestGet({ request, env }) {
  try {
    await ensure(env);
    const u = new URL(request.url), me = owner(request, env), img = u.searchParams.get('img');
    if (img) {
      const r = await env.DB.prepare(`SELECT data FROM photos WHERE id = ?${me ? '' : ' AND published = 1'}`).bind(img).first();
      if (!r) return new Response('Not found', { status: 404 });
      const bin = atob(r.data.slice(PREFIX.length));
      return new Response(Uint8Array.from(bin, (c) => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': me ? 'private, no-store' : 'public, max-age=300' } });
    }
    if (u.searchParams.get('all') && me) {
      const { results } = await env.DB.prepare('SELECT id, caption, published FROM photos ORDER BY ts DESC').all();
      return json({ photos: results });
    }
    const { results } = await env.DB.prepare('SELECT id, caption FROM photos WHERE published = 1 ORDER BY ts DESC LIMIT 60').all();
    return json({ photos: results });
  } catch (e) { return json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function onRequestPost({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!okData(b.data)) return json({ error: 'Photo must be a JPEG under ~450 KB' }, { status: 400 });
  await ensure(env);
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM photos').first();
  if (n.c >= 60) return json({ error: 'Photo limit (60) reached. Delete some first.' }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO photos (id, ts, caption, data, published) VALUES (?, ?, ?, ?, 0)').bind(id, new Date().toISOString(), String(b.caption || '').slice(0, 80), b.data).run();
  return json({ ok: true, id });
}
export async function onRequestPatch({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  await ensure(env);
  const jobs = [];
  if (b.caption !== undefined) jobs.push(env.DB.prepare('UPDATE photos SET caption = ? WHERE id = ?').bind(String(b.caption).slice(0, 80), id));
  if (b.data !== undefined) { if (!okData(b.data)) return json({ error: 'Bad image' }, { status: 400 }); jobs.push(env.DB.prepare('UPDATE photos SET data = ? WHERE id = ?').bind(b.data, id)); }
  if (b.published !== undefined) jobs.push(env.DB.prepare('UPDATE photos SET published = ? WHERE id = ?').bind(b.published ? 1 : 0, id));
  if (!jobs.length) return json({ error: 'Nothing to change' }, { status: 400 });
  await env.DB.batch(jobs);
  return json({ ok: true });
}
export async function onRequestDelete({ request, env }) {
  if (!owner(request, env)) return json({ error: 'Unauthorized' }, { status: 401 });
  await ensure(env);
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
  return json({ ok: true });
}
