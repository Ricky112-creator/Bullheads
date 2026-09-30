// 1) Redirect ONLY the exact production pages.dev hostname to the custom domain.
//    Preview deployments (<hash>.bullheads.pages.dev, main.bullheads.pages.dev)
//    have different hostnames and pass through untouched. No loop is possible
//    because the custom domain never matches this check.
//
// 2) Branch sites. branch1.bullheadhotels.co.ke and branch2.bullheadhotels.co.ke serve the SAME files as the
//    main site (one repo, one deployment). On those hostnames this file tailors what search engines and
//    phones see, before the page leaves Cloudflare, so it works even with JavaScript off:
//      - canonical / og:url point at the branch's own address (no duplicate-content fight with the main site)
//      - the other branch's blocks (data-branch="two" on branch 1, and vice versa) are removed from the HTML
//      - JSON-LD keeps only this branch's Restaurant entry, with its own URLs
//      - <title> and social titles say "Bullhead One" / "Bullhead Two"
//      - sitemap.xml, robots.txt and site.webmanifest are generated for the branch's own address
//    The main site (bullheadhotels.co.ke) is left exactly as it was.
import { BRANCH_NAMES, BRANCH_HOSTS, hostBranch } from './_lib/branches.js';

const MAIN = 'https://bullheadhotels.co.ke';

// Owner-only pages live on their own address, admin.bullheadhotels.co.ke, so the owner's sign-in (kept in the
// browser, scoped to the address) is never shared with the public site. On every other address these pages do not exist.
const ADMIN_HOST = 'admin.bullheadhotels.co.ke';
const OWNER_PAGE = /^\/(admin|tools|qr)(\.html)?\/?$/i;
const ADMIN_OK = /^\/(admin|tools|qr)(\.html)?\/?$|^\/api(\/|$)|^\/(sw\.js|favicon\.ico|site\.webmanifest)$/i;
const notFound = () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><body style="font-family:system-ui,sans-serif;padding:12vh 24px;text-align:center"><h1>Page not found</h1><p><a href="https://bullheadhotels.co.ke/">Go to Bullhead</a></p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } });

async function adminHost(context, url) {
  const p = url.pathname;
  if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex, nofollow' } });
  if (p !== '/' && !ADMIN_OK.test(p)) return notFound();
  const res = p === '/' ? await context.env.ASSETS.fetch(new Request(new URL('/admin', url), context.request)) : await context.next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'bullheads.pages.dev') {
    url.protocol = 'https:';
    url.host = 'bullheadhotels.co.ke';
    return Response.redirect(url.toString(), 301);
  }

  if (url.hostname === ADMIN_HOST) return adminHost(context, url);
  if (OWNER_PAGE.test(url.pathname)) return notFound();

  const bk = hostBranch(url.hostname);
  if (!bk) return context.next();
  const origin = 'https://' + BRANCH_HOSTS[bk], name = BRANCH_NAMES[bk];
  const res = await context.next();
  const path = url.pathname;

  // ---- generated / adjusted non-HTML files ----
  if (res.ok && (path === '/sitemap.xml' || path === '/robots.txt')) {
    const text = (await res.text()).split(MAIN).join(origin);
    return new Response(text, { status: res.status, headers: res.headers });
  }
  if (res.ok && path === '/site.webmanifest') {
    try {
      const m = await res.json();
      m.name = name + ' — Butchery & Hotel'; m.short_name = name; m.start_url = '/'; m.id = '/';
      return new Response(JSON.stringify(m), { status: 200, headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } });
    } catch (e) { return res; }
  }

  // ---- HTML pages ----
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  const swap = (v) => String(v || '').split(MAIN).join(origin);
  const brand = (v) => String(v || '').replace(/Bullhead(?! (?:One|Two))/, name);       // first plain "Bullhead" -> "Bullhead One"
  const oneCounter = (v) => String(v || '').replace(/Two counters,\s*open/i, 'Open');    // the main-site blurb talks about two counters
  const attr = (selector, a, fn) => [selector, { element(e) { const v = e.getAttribute(a); if (v != null) e.setAttribute(a, fn(v)); } }];

  let ld = '', ttl = '';
  const rw = new HTMLRewriter()
    .on('html', { element(e) { e.setAttribute('data-branch', bk); } })
    .on(...attr('link[rel="canonical"]', 'href', swap))
    .on(...attr('meta[property="og:url"]', 'content', swap))
    .on(...attr('meta[name="description"]', 'content', oneCounter))
    .on(...attr('meta[property="og:description"]', 'content', oneCounter))
    .on(...attr('meta[name="twitter:description"]', 'content', oneCounter))
    .on(...attr('meta[property="og:title"]', 'content', brand))
    .on(...attr('meta[name="twitter:title"]', 'content', brand))
    .on('title', {
      text(t) { ttl += t.text; if (t.lastInTextNode) { t.replace(brand(ttl), { html: true }); ttl = ''; } else t.remove(); },
    })
    // the other branch's blocks are removed outright, not just hidden
    .on('[data-only]', { element(e) { if (e.getAttribute('data-only') !== bk) e.remove(); } })
    .on('[data-branch]', { element(e) { if (e.tagName !== 'html' && e.getAttribute('data-branch') !== bk) e.remove(); } })
    .on('script[type="application/ld+json"]', {
      text(t) {
        ld += t.text;
        if (!t.lastInTextNode) { t.remove(); return; }
        let out = ld; ld = '';
        try {
          const j = JSON.parse(out), mine = bk === 'one' ? '1' : '2';
          if (Array.isArray(j['@graph'])) {
            const node = j['@graph'].find((n) => String(n.name || '').trim().endsWith(' ' + mine));
            if (node) {
              const own = JSON.parse(swap(JSON.stringify(node)));
              own.url = origin + '/';
              own.parentOrganization = { '@type': 'Organization', name: 'Bullhead Hotel & Butchery', url: MAIN };
              out = JSON.stringify({ '@context': j['@context'], ...own }, null, 2);
            }
          }
        } catch (e) { /* leave the block as it was */ }
        t.replace(out, { html: true });
      },
    });
  return rw.transform(res);
}
