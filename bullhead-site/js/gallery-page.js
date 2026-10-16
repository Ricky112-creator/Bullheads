(function () {
  var g = document.getElementById('gg'), lb = document.getElementById('lb');
  fetch('/api/photos').then(function (r) { return r.json(); }).then(function (d) {
    g.innerHTML = '';
    if (!d.photos || !d.photos.length) { g.innerHTML = '<p class="gal-empty">Photos coming soon.</p>'; return; }
    d.photos.forEach(function (p) {
      var f = document.createElement('figure'), i = document.createElement('img');
      var q = '/api/photos?img=' + p.id, v = '&v=' + (p.v || 0);
      i.loading = 'lazy'; i.decoding = 'async'; i.alt = p.caption || 'Bullhead'; i.src = q + (p.t ? '&t=1' : '') + v; f.appendChild(i);
      if (p.caption) { var c = document.createElement('figcaption'); c.textContent = p.caption; f.appendChild(c); }
      f.onclick = function () { document.getElementById('lbImg').src = q + v; document.getElementById('lbCap').textContent = p.caption || ''; lb.classList.add('on'); };
      g.appendChild(f);
    });
  }).catch(function () { g.innerHTML = '<p class="gal-empty">Could not load photos. Please try again.</p>'; });
  lb.onclick = function () { lb.classList.remove('on'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('on'); });
})();
