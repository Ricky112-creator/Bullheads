(function () {
  var box = document.getElementById('menuPhotos'), list = document.getElementById('menuList');
  if (!box || !list) return;
  var figs = Array.prototype.slice.call(box.querySelectorAll('.menu-photo'));
  if (!figs.length) return;
  var dotsEl = box.querySelector('.menu-photo-dots'), btns = [], cur = -1, ticking = false;
  function catsOf(f) { return (f.getAttribute('data-cats') || '').split('|').map(function (s) { return s.trim().toLowerCase(); }); }
  function titleOf(c) { var t = c.querySelector('.menu-category-title'); return t ? t.textContent.trim().toLowerCase() : ''; }
  function catEls() { return Array.prototype.slice.call(list.querySelectorAll('.menu-category')); }
  function matches(title) {
    var m = figs.filter(function (f) { return catsOf(f).indexOf(title) > -1; });
    if (!m.length) m = figs.filter(function (f) { return catsOf(f).indexOf('*') > -1; });
    return m.length ? m : [figs[0]];
  }
  function show(i) {
    if (i === cur) return;
    cur = i;
    figs.forEach(function (f, n) {
      var on = n === i;
      f.classList.toggle('on', on);
      if (on) f.removeAttribute('aria-hidden'); else f.setAttribute('aria-hidden', 'true');
      if (btns[n]) { btns[n].classList.toggle('on', on); if (on) btns[n].setAttribute('aria-current', 'true'); else btns[n].removeAttribute('aria-current'); }
    });
  }
  function pick() {
    ticking = false;
    var cats = catEls(); if (!cats.length) return;
    var probe = list.getBoundingClientRect().top + list.clientHeight * 0.35, active = cats[0];
    cats.forEach(function (c) { if (c.getBoundingClientRect().top <= probe) active = c; });
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2) active = cats[cats.length - 1];
    var r = active.getBoundingClientRect();
    var prog = Math.max(0, Math.min(0.999, (probe - r.top) / Math.max(r.height, 1)));
    var m = matches(titleOf(active));
    show(figs.indexOf(m[Math.floor(prog * m.length)]));
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(pick); } }
  function jump(i) {
    var cat = null, c = catsOf(figs[i]);
    catEls().forEach(function (el) { if (!cat && c.indexOf(titleOf(el)) > -1) cat = el; });
    var top = 0;
    if (cat) {
      var m = matches(titleOf(cat)), k = Math.max(0, m.indexOf(figs[i]));
      top = cat.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop + (cat.offsetHeight * k) / m.length + (k ? 4 : 0);
    }
    list.scrollTo({ top: top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  if (dotsEl) figs.forEach(function (f, n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Photo ' + (n + 1) + ' of ' + figs.length);
    b.onclick = function () { jump(n); };
    dotsEl.appendChild(b); btns.push(b);
  });
  list.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(list, { childList: true });
  figs.forEach(function (f, n) { if (n) f.setAttribute('aria-hidden', 'true'); });
  if (btns[0]) { btns[0].classList.add('on'); btns[0].setAttribute('aria-current', 'true'); }
  cur = 0;
  schedule();
})();
