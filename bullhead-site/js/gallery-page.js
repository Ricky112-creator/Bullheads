// Gallery page.
//   Main site (bullheadhotels.co.ke):      shows ONLY the photos the owner uploads and publishes in the admin panel (/api/photos).
//   Branch sites (branch1. / branch2.):    always show the full built-in set listed in /assets/gallery/branch-gallery.json.
// BH (js/branches.js) says which kind of address this is; it loads before this file.
(function () {
  var g = document.getElementById('gg'), lb = document.getElementById('lb');
  var lbImg = document.getElementById('lbImg'), lbCap = document.getElementById('lbCap');
  var onBranch = !!(window.BH && BH.current);

  function show(full, cap) { lbImg.src = full; lbCap.textContent = cap || ''; lb.classList.add('on'); }
  function caption(f, cap) { if (!cap) return; var c = document.createElement('figcaption'); c.textContent = cap; f.appendChild(c); }
  function empty(msg) { g.innerHTML = '<p class="gal-empty">' + msg + '</p>'; }

  // ---- main site: admin-uploaded photos ----
  function loadUploaded() {
    fetch('/api/photos').then(function (r) { return r.json(); }).then(function (d) {
      g.innerHTML = '';
      if (!d.photos || !d.photos.length) { empty('Photos coming soon.'); return; }
      d.photos.forEach(function (p) {
        var f = document.createElement('figure'), i = document.createElement('img');
        var q = '/api/photos?img=' + p.id, v = '&v=' + (p.v || 0);
        i.loading = 'lazy'; i.decoding = 'async'; i.alt = p.caption || 'Bullhead'; i.src = q + (p.t ? '&t=1' : '') + v; f.appendChild(i);
        caption(f, p.caption);
        f.onclick = function () { show(q + v, p.caption); };
        g.appendChild(f);
      });
    }).catch(function () { empty('Could not load photos. Please try again.'); });
  }

  // ---- branch sites: the built-in set, always full ----
  function loadBuiltIn() {
    fetch('/assets/gallery/branch-gallery.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (d) {
      g.innerHTML = '';
      (d.photos || []).forEach(function (p, n) {
        var base = '/assets/img/' + p.name, f = document.createElement('figure'), pic = document.createElement('picture'), i = document.createElement('img');
        if (p.webp) { var s = document.createElement('source'); s.type = 'image/webp'; s.srcset = base + '.webp'; pic.appendChild(s); }
        i.src = base + '.jpg'; i.alt = p.caption || 'Bullhead'; i.width = p.w; i.height = p.h; i.decoding = 'async';
        if (n > 1) i.loading = 'lazy';   // the first two are near the top of the page
        pic.appendChild(i); f.appendChild(pic); caption(f, p.caption);
        f.onclick = function () { show(base + '.jpg', p.caption); };
        g.appendChild(f);
      });
      if (!g.firstChild) empty('Photos coming soon.');
    }).catch(function () { empty('Could not load photos. Please try again.'); });
  }

  if (onBranch) loadBuiltIn(); else loadUploaded();
  lb.onclick = function () { lb.classList.remove('on'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('on'); });
})();
