/* Bullhead reel: 3D coverflow gallery. Data comes from reel-data.js; the owner's uploads (/api/photos) are appended after the curated set. */
(function () {
  var D = window.BH_REEL; if (!D) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.getElementById('reel'), stage = document.getElementById('reelStage'), chipsEl = document.getElementById('reelChips');
  var film = document.getElementById('reelFilm'), ticketNo = document.getElementById('tkNo'), ticketOf = document.getElementById('tkOf'), ticketCh = document.getElementById('tkCh'), ticketCap = document.getElementById('tkCap');
  var btnPrev = document.getElementById('reelPrev'), btnNext = document.getElementById('reelNext'), btnPlay = document.getElementById('reelPlay'), btnOpen = document.getElementById('reelOpen');
  var base = 'assets/img/reel/r-';
  var chapters = D.chapters.slice();
  var all = D.items.map(function (r) {
    return { id: r[0], ch: r[1], w: r[2], h: r[3], avg: r[4], cap: r[5], s: '/' + base + r[0] + '-s.webp', l: '/' + base + r[0] + '.webp', t: '/' + base + r[0] + '-t.webp' };
  });
  var SW = { 'The strip': 'Mbele ya jengo', 'Fire and fryer': 'Moto na kikaango', 'At the tables': 'Mezani', 'The details': 'Vitu vidogo', 'The block': 'Jengo', 'The room': 'Chumba', 'Counter and kitchen': 'Kaunta na jiko', 'One: The strip': 'Kwanza: Mbele ya jengo', 'One: Fire and fryer': 'Kwanza: Moto na kikaango', 'One: At the tables': 'Kwanza: Mezani', 'One: The details': 'Kwanza: Vitu vidogo', 'Two: The block': 'Pili: Jengo', 'Two: The room': 'Pili: Chumba', 'Two: At the tables': 'Pili: Mezani', 'Two: Counter and kitchen': 'Pili: Kaunta na jiko', 'Two: The details': 'Pili: Vitu vidogo' };
  var list = all.slice(), cur = 0, pos = 0, target = 0, filter = -1, cards = [], W = 800, raf = 0, timer = 0, playing = !still, touched = false, moved = false;

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ----- chips ----- */
  function chip(label, val, sw) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', val === filter ? 'true' : 'false'); b.dataset.f = val;
    if (sw) b.setAttribute('data-sw', sw);
    b.addEventListener('click', function () { stopAuto(); setFilter(val); });
    li.appendChild(b); chipsEl.appendChild(li);
  }
  function buildChips() {
    chipsEl.innerHTML = ''; chip('All', -1, 'Zote');
    chapters.forEach(function (c, i) { chip(c, i, SW[c]); });
  }
  function setFilter(val) {
    filter = val;
    Array.prototype.forEach.call(chipsEl.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.f === val)); });
    list = val < 0 ? all.slice() : all.filter(function (p) { return p.ch === val; });
    cur = 0; pos = 0; target = 0; build();
  }

  /* ----- build stage + filmstrip ----- */
  function build() {
    stage.innerHTML = ''; film.innerHTML = ''; cards = [];
    list.forEach(function (p, i) {
      var c = document.createElement('figure'); c.className = 'reel-card' + (p.w / p.h >= 1.35 ? ' land' : ''); c.style.setProperty('--c', p.avg);
      c.setAttribute('role', 'group'); c.setAttribute('aria-label', 'Photo ' + (i + 1) + ' of ' + list.length);
      var gl = document.createElement('i'); gl.className = 'gl'; c.appendChild(gl);
      c.addEventListener('click', function () { if (moved) return; stopAuto(); if (Math.round(target) === i) openViewer(i); else go(i); });
      c.addEventListener('pointermove', function (e) {
        if (!c.classList.contains('on') || still || e.pointerType === 'touch') return;
        var r = c.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
        c.style.setProperty('--mx', ((x + 1) * 50) + '%'); c.style.setProperty('--my', ((y + 1) * 50) + '%');
        c.style.rotate = (-y).toFixed(3) + ' ' + x.toFixed(3) + ' 0 ' + (Math.hypot(x, y) * 3.2).toFixed(2) + 'deg';
      });
      c.addEventListener('pointerleave', function () { c.style.rotate = ''; });
      stage.appendChild(c); cards.push({ el: c, p: p, img: null });
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Show photo ' + (i + 1) + ': ' + p.cap); b.style.setProperty('--c', p.avg);
      var im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = ''; im.src = p.t; im.width = 260; im.height = 173; b.appendChild(im);
      b.addEventListener('click', function () { stopAuto(); go(i); });
      film.appendChild(b);
    });
    measure(); frame(true); sync();
  }
  function measure() { var c = cards[0]; W = c ? c.el.offsetWidth : 800; }

  function ensure(c) {
    if (c.img) return;
    var i = document.createElement('img'); i.alt = c.p.cap; i.decoding = 'async'; i.draggable = false; i.src = c.p.s; c.el.insertBefore(i, c.el.firstChild);
    var bk = document.createElement('div'); bk.className = 'bk'; bk.style.backgroundImage = 'url(' + c.p.t + ')'; c.el.insertBefore(bk, c.el.firstChild);
    c.img = i;
  }

  /* ----- the 3D frame ----- */
  function layout(c, i) {
    var d = i - pos, ad = Math.abs(d), s = d < 0 ? -1 : 1, el = c.el;
    if (ad > 3.4) { if (!el.hidden) el.hidden = true; return; }
    if (el.hidden) el.hidden = false;
    if (ad < 3.1) ensure(c);
    var tx = s * W * (0.5 * Math.min(ad, 1) + 0.2 * Math.max(ad - 1, 0));
    var ry = -clamp(d, -1.25, 1.25) * 40, tz = -Math.min(ad, 2.6) * 170, sc = 1 - Math.min(ad, 2) * 0.04;
    el.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,' + tz.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
    el.style.opacity = (1 - Math.min(ad, 3) * 0.24).toFixed(3);
    el.style.zIndex = String(100 - Math.round(ad * 10));
    el.style.pointerEvents = ad > 2.2 ? 'none' : 'auto';
    var on = ad < 0.5; if (on !== el.classList.contains('on')) el.classList.toggle('on', on);
  }
  function frame(snap) {
    if (snap) pos = target;
    for (var i = 0; i < cards.length; i++) layout(cards[i], i);
    if (!snap && Math.abs(target - pos) > 0.0008) { pos += (target - pos) * 0.13; raf = requestAnimationFrame(function () { frame(false); }); }
    else { raf = 0; if (!snap) { pos = target; for (var j = 0; j < cards.length; j++) layout(cards[j], j); } }
  }
  function kick() { if (still) { frame(true); return; } if (!raf) raf = requestAnimationFrame(function () { frame(false); }); }

  /* ----- state sync (ticket, glow, filmstrip) ----- */
  function sync() {
    var i = clamp(Math.round(target), 0, list.length - 1), p = list[i]; if (!p) return;
    cur = i;
    ticketNo.textContent = 'No. ' + pad(i + 1); ticketOf.textContent = 'of ' + list.length; ticketCh.textContent = chapters[p.ch] || 'More photos'; ticketCap.textContent = p.cap;
    root.style.setProperty('--glow', p.avg);
    var bs = film.children; for (var k = 0; k < bs.length; k++) { if (k === i) bs[k].setAttribute('aria-current', 'true'); else bs[k].removeAttribute('aria-current'); }
    var cb = bs[i]; if (cb) film.scrollTo({ left: cb.offsetLeft - film.clientWidth / 2 + cb.clientWidth / 2, behavior: still ? 'auto' : 'smooth' });
    btnPrev.disabled = i === 0; btnNext.disabled = i === list.length - 1;
  }
  function go(i) { target = clamp(Math.round(i), 0, list.length - 1); sync(); kick(); }

  /* ----- autoplay: stops for good on the first touch of any control ----- */
  function setPlay(on) { playing = on; btnPlay.setAttribute('aria-pressed', String(on)); btnPlay.textContent = on ? '\u23F8' : '\u25B6'; btnPlay.setAttribute('aria-label', on ? 'Pause slideshow' : 'Play slideshow'); }
  function tick() { if (!playing || document.hidden) return; go(cur >= list.length - 1 ? 0 : cur + 1); }
  function startAuto() { clearInterval(timer); if (playing && !still) timer = setInterval(tick, 4800); }
  function stopAuto() { touched = true; clearInterval(timer); if (playing) setPlay(false); }
  btnPlay.addEventListener('click', function () { if (playing) { stopAuto(); } else { touched = true; setPlay(true); startAuto(); } });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (es[0].isIntersecting && !touched) startAuto(); else clearInterval(timer); }, { threshold: 0.35 }).observe(stage);
  else startAuto();

  /* ----- input: buttons, keys, drag, wheel ----- */
  btnPrev.addEventListener('click', function () { stopAuto(); go(cur - 1); });
  btnNext.addEventListener('click', function () { stopAuto(); go(cur + 1); });
  btnOpen.addEventListener('click', function () { stopAuto(); openViewer(cur); });
  stage.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); stopAuto(); go(cur + 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); stopAuto(); go(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); stopAuto(); go(0); }
    else if (k === 'End') { e.preventDefault(); stopAuto(); go(list.length - 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); stopAuto(); openViewer(cur); }
  });
  var dx0 = 0, pos0 = 0, down = false, lastX = 0, lastT = 0, vel = 0;
  stage.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return; down = true; moved = false; dx0 = lastX = e.clientX; lastT = e.timeStamp; pos0 = target; vel = 0;
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  });
  function onMove(e) {
    if (!down) return; var dx = e.clientX - dx0;
    if (!moved && Math.abs(dx) < 7) return;
    if (!moved) { moved = true; stopAuto(); stage.classList.add('drag'); }
    var dt = Math.max(1, e.timeStamp - lastT); vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = e.timeStamp;
    target = clamp(pos0 - dx / (W * 0.46), 0, list.length - 1); pos = target; frame(true);
  }
  function onUp() {
    down = false; stage.classList.remove('drag');
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    if (moved) { target = clamp(Math.round(target - vel * 1.6), 0, list.length - 1); sync(); kick(); setTimeout(function () { moved = false; }, 0); }
  }
  var wAcc = 0, wT = 0;
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); stopAuto();
    var now = e.timeStamp; if (now - wT > 160) wAcc = 0; wT = now; wAcc += e.deltaX;
    if (Math.abs(wAcc) > 60) { go(cur + (wAcc > 0 ? 1 : -1)); wAcc = 0; }
  }, { passive: false });
  window.addEventListener('resize', function () { measure(); frame(true); });

  /* ----- full-screen viewer ----- */
  var rv = document.createElement('div'); rv.className = 'rv'; rv.setAttribute('role', 'dialog'); rv.setAttribute('aria-modal', 'true'); rv.setAttribute('aria-label', 'Photo viewer'); rv.hidden = false;
  rv.innerHTML = '<button type="button" class="x" aria-label="Close viewer">\u2715</button><button type="button" class="pv" aria-label="Previous photo">\u2190</button><button type="button" class="nx" aria-label="Next photo">\u2192</button><img alt=""><p></p>';
  document.body.appendChild(rv);
  var rvImg = rv.querySelector('img'), rvCap = rv.querySelector('p'), ri = 0, sx = 0;
  function show(i) {
    ri = clamp(i, 0, list.length - 1); var p = list[ri];
    var n = rvImg.cloneNode(); n.src = p.l; n.alt = p.cap; rv.replaceChild(n, rvImg); rvImg = n; rvCap.textContent = p.cap + '  (' + (ri + 1) + ' of ' + list.length + ')';
    [ri + 1, ri - 1].forEach(function (k) { if (list[k]) { var pre = new Image(); pre.src = list[k].l; } });
    rv.querySelector('.pv').disabled = ri === 0; rv.querySelector('.nx').disabled = ri === list.length - 1;
  }
  function openViewer(i) { show(i); rv.classList.add('on'); document.documentElement.style.overflow = 'hidden'; rv.querySelector('.x').focus(); }
  function closeViewer() { if (!rv.classList.contains('on')) return; rv.classList.remove('on'); document.documentElement.style.overflow = ''; go(ri); stage.focus({ preventScroll: true }); }
  rv.querySelector('.x').addEventListener('click', closeViewer);
  rv.querySelector('.pv').addEventListener('click', function () { show(ri - 1); });
  rv.querySelector('.nx').addEventListener('click', function () { show(ri + 1); });
  rv.addEventListener('click', function (e) { if (e.target === rv) closeViewer(); });
  rv.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  rv.addEventListener('touchend', function (e) { var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(ri + (d < 0 ? 1 : -1)); }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (!rv.classList.contains('on')) return;
    if (e.key === 'Escape') closeViewer(); else if (e.key === 'ArrowRight') show(ri + 1); else if (e.key === 'ArrowLeft') show(ri - 1);
  });

  /* ----- owner uploads from the dashboard are added after the curated set ----- */
  fetch('/api/photos').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.photos || !d.photos.length) return;
    var idx = chapters.length; chapters.push('More photos');
    d.photos.forEach(function (p, n) {
      var q = '/api/photos?img=' + encodeURIComponent(p.id), v = '&v=' + (p.v || 0);
      all.push({ id: 'u' + n, ch: idx, w: 1500, h: 1000, avg: '#3a2a22', cap: p.caption || 'Bullhead', s: q + v, l: q + v, t: q + (p.t ? '&t=1' : '') + v });
    });
    var keep = filter; buildChips(); chipsEl.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.f === keep)); });
    if (keep < 0) { var at = cur; list = all.slice(); build(); target = pos = at; frame(true); sync(); }
  }).catch(function () {});

  buildChips(); setPlay(playing); build();
})();
