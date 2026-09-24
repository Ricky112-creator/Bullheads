// GET    /api/photos                       -> public: published photos [{ id, caption, v, t }]  (v = revision, t = has thumbnail)
// GET    /api/photos?img=<id>&t=1&v=<rev>  -> public: a published image (t=1: the small thumbnail if there is one).
//                                             Owner code: any image, including drafts.
// GET    /api/photos?all=1                 -> owner only: every photo, with { published }
// POST   /api/photos {caption, data, thumb?} -> owner only: uploads as a DRAFT (not public yet)
// PATCH  /api/photos?id= {caption?, data?, thumb?, published?} -> owner only: edit / rotate / publish / unpublish
// DELETE /api/photos?id=                   -> owner only
//
// Public images are cached at Cloudflare's edge (Cache API, free) and in the visitor's browser for a day.
// The URL carries the photo's revision (v), which changes whenever the picture or its published state
// changes, so an edit shows up immediately and a 60-photo gallery does not cost 60 Function runs per visitor.
import { json, requireRole } from '../_lib/auth.js';

const PREFIX = 'data:image/jpeg;base64,';
const okData = (d) => typeof d === 'string' && d.startsWith(PREFIX) && d.length <= 600000;
const okThumb = (d) => typeof d === 'string' && d.startsWith(PREFIX) && d.length <= 90000;
let ready = null;
const ensure = (env) => (ready = ready || (async () => {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, ts TEXT NOT NULL, caption TEXT, data TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1)').run();
  // Older databases don't have these columns yet. Existing photos stay live (published = 1) at revision 0 with no thumbnail.
  for (const col of ['published INTEGER NOT NULL DEFAULT 1', 'rev INTEGER NOT NULL DEFAULT 0', 'thumb TEXT']) {
    try { await env.DB.prepare('ALTER TABLE photos ADD COLUMN ' + col).run(); } catch (e) { /* already there */ }
  }
})().catch((e) => { ready = null; throw e; }));

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    await ensure(env);
    const u = new URL(request.url), img = u.searchParams.get('img');
    const me = (await requireRole(request, env, ['owner'])).role === 'owner';   // no code sent -> false, and nothing is counted
    if (img) {
      const wantThumb = u.searchParams.get('t') === '1', v = String(parseInt(u.searchParams.get('v'), 10) || 0);
      const cache = !me && typeof caches !== 'undefined' ? caches.default : null;
      const key = new Request(`${u.origin}${u.pathname}?img=${encodeURIComponent(img)}${wantThumb ? '&t=1' : ''}&v=${v}`);
      if (cache) { const hit = await cache.match(key); if (hit) return hit; }
      const r = await env.DB.prepare(`SELECT data, thumb FROM photos WHERE id = ?${me ? '' : ' AND published = 1'}`).bind(img).first();
      if (!r) return new Response('Not found', { status: 404 });
      const src = wantThumb && r.thumb ? r.thumb : r.data;
      const res = new Response(Uint8Array.from(atob(src.slice(PREFIX.length)), (c) => c.charCodeAt(0)), {
        headers: { 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': me ? 'private, no-store' : 'public, max-age=86400' },
      });
      if (cache) { const p = cache.put(key, res.clone()); if (waitUntil) waitUntil(p); else await p; }
      return res;
    }
    if (u.searchParams.get('all') && me) {
      const { results } = await env.DB.prepare('SELECT id, caption, published, rev AS v, (thumb IS NOT NULL) AS t FROM photos ORDER BY ts DESC').all();
      return json({ photos: results });
    }
    const { results } = await env.DB.prepare('SELECT id, caption, rev AS v, (thumb IS NOT NULL) AS t FROM photos WHERE published = 1 ORDER BY ts DESC LIMIT 60').all();
    return json({ photos: results }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e) { return json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function onRequestPost({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!okData(b.data)) return json({ error: 'Photo must be a JPEG under ~450 KB' }, { status: 400 });
  if (b.thumb !== undefined && !okThumb(b.thumb)) return json({ error: 'Bad thumbnail' }, { status: 400 });
  await ensure(env);
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM photos').first();
  if (n.c >= 60) return json({ error: 'Photo limit (60) reached. Delete some first.' }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO photos (id, ts, caption, data, thumb, published) VALUES (?, ?, ?, ?, ?, 0)').bind(id, new Date().toISOString(), String(b.caption || '').slice(0, 80), b.data, b.thumb || null).run();
  return json({ ok: true, id });
}
export async function onRequestPatch({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  const id = new URL(request.url).searchParams.get('id') || '';
  let b; try { b = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  await ensure(env);
  const jobs = [];
  if (b.caption !== undefined) jobs.push(env.DB.prepare('UPDATE photos SET caption = ? WHERE id = ?').bind(String(b.caption).slice(0, 80), id));
  if (b.data !== undefined) { if (!okData(b.data)) return json({ error: 'Bad image' }, { status: 400 }); jobs.push(env.DB.prepare('UPDATE photos SET data = ?, rev = rev + 1 WHERE id = ?').bind(b.data, id)); }
  if (b.thumb !== undefined) { if (!okThumb(b.thumb)) return json({ error: 'Bad thumbnail' }, { status: 400 }); jobs.push(env.DB.prepare('UPDATE photos SET thumb = ?, rev = rev + 1 WHERE id = ?').bind(b.thumb, id)); }
  if (b.published !== undefined) jobs.push(env.DB.prepare('UPDATE photos SET published = ?, rev = rev + 1 WHERE id = ?').bind(b.published ? 1 : 0, id));
  if (!jobs.length) return json({ error: 'Nothing to change' }, { status: 400 });
  await env.DB.batch(jobs);
  return json({ ok: true });
}
export async function onRequestDelete({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  await ensure(env);
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(new URL(request.url).searchParams.get('id') || '').run();
  return json({ ok: true });
}
