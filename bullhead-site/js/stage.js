/* Bullhead stage: pointer depth, tilt, drift, heading reveals, magnetic buttons, the ring, the order ribbon. No dependencies. */
(function () {
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function $(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---- hero depth ---- */
  if (fine && !still) $('.hero, .page-hero').forEach(function (h) {
    var tx = 0, ty = 0, x = 0, y = 0, on = false, run = 0;
    function loop() {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      h.style.setProperty('--hx', x.toFixed(3)); h.style.setProperty('--hy', y.toFixed(3));
      if (on || Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002) run = requestAnimationFrame(loop); else run = 0;
    }
    h.addEventListener('pointermove', function (e) {
      var r = h.getBoundingClientRect(); tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      on = true; if (!run) run = requestAnimationFrame(loop);
    });
    h.addEventListener('pointerleave', function () { tx = 0; ty = 0; on = false; if (!run) run = requestAnimationFrame(loop); });
  });

  /* ---- tilt + glare ---- */
  if (fine && !still) $('.zones-grid .explore-card, .explore-grid .explore-card, .location-card').forEach(function (c) {
    var g = document.createElement('i'); g.className = 'bh-glare'; c.appendChild(g); c.classList.add('bh-tilt');
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
      c.classList.add('live'); c.style.rotate = (-y).toFixed(3) + ' ' + x.toFixed(3) + ' 0 ' + (Math.hypot(x, y) * 5).toFixed(2) + 'deg';
      c.style.setProperty('--gx', ((x + 1) * 50) + '%'); c.style.setProperty('--gy', ((y + 1) * 50) + '%');
    });
    c.addEventListener('pointerleave', function () { c.classList.remove('live'); c.style.rotate = ''; });
  });

  /* ---- drift: photographs slide a little against their frames ---- */
  if (!still) {
    var drifts = [];
    $('.story-media img, .explore-card > img, .location-media img, .bh-walk__pic').forEach(function (im) {
      if (im.closest('.reel, .ring')) return; im.classList.add('bh-drift'); drifts.push({ el: im, vis: false });
    });
    if (drifts.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { for (var i = 0; i < drifts.length; i++) if (drifts[i].el === e.target) drifts[i].vis = e.isIntersecting; }); }, { rootMargin: '10% 0px' });
      drifts.forEach(function (d) { io.observe(d.el); });
      var w = false, upd = function () {
        w = false; var vh = window.innerHeight || 800;
        drifts.forEach(function (d) { if (!d.vis) return; var r = d.el.parentElement.getBoundingClientRect(); var p = clamp((r.top + r.height / 2) / vh, -0.2, 1.2) - 0.5; d.el.style.setProperty('--dy', (p * -34).toFixed(1) + 'px'); });
      };
      var req = function () { if (!w) { w = true; requestAnimationFrame(upd); } };
      window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req); req();
    }
  }

  /* ---- headings rise once ---- */
  if (!still && 'IntersectionObserver' in window) {
    var hs = $('main h2, .ring-copy h2').filter(function (h) { return !h.closest('.hero') && !h.closest('[hidden]'); });
    var hio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); hio.unobserve(e.target); } }); }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
    hs.forEach(function (h) { h.classList.add('bh-rise'); hio.observe(h); });
  }

  /* ---- magnetic buttons ---- */
  if (fine && !still) $('.btn, .nav-cta, .order-bar-link, .rn-cta').forEach(function (b) {
    b.classList.add('bh-mag');
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / r.width, y = (e.clientY - (r.top + r.height / 2)) / r.height;
      b.style.translate = (x * 9).toFixed(1) + 'px ' + (y * 7).toFixed(1) + 'px';
    });
    b.addEventListener('pointerleave', function () { b.style.translate = ''; });
  });

  /* ---- the ring ---- */
  $('.ring').forEach(function (ring) {
    var spin = ring.querySelector('.ring-spin'); if (!spin || still) return;
    var w = false, on = true;
    function upd() { w = false; var r = ring.getBoundingClientRect(), vh = window.innerHeight || 800; var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1); spin.style.setProperty('--spin', (-p * 315).toFixed(2)); }
    function req() { if (on && !w) { w = true; requestAnimationFrame(upd); } }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; req(); }, { rootMargin: '20% 0px' }).observe(ring);
    window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req); req();
  });

  /* ---- the order ribbon (contact page): your order, your details, send ---- */
  var wrap = document.querySelector('.contact-wrap'), form = document.getElementById('orderForm');
  if (wrap && form) {
    var ol = document.createElement('ol'); ol.className = 'flow'; ol.setAttribute('aria-label', 'Order steps');
    ol.innerHTML = '<li><b>1</b>Your order</li><li><b>2</b>Your phone number</li><li><b>3</b>Send it to the kitchen</li>';
    wrap.insertBefore(ol, wrap.firstChild);
    var steps = $('li', ol), phone = document.getElementById('phone'), summary = document.getElementById('orderSummary'), submit = form.querySelector('button[type="submit"]');
    function state() {
      var hasOrder = summary && !summary.hidden && summary.children.length > 0;
      var ph = phone ? phone.value.replace(/\D/g, '') : '';
      var okPhone = typeof normPhoneKE === 'function' ? !!normPhoneKE(phone && phone.value) : ph.length >= 9;
      steps[0].className = hasOrder ? 'done' : 'now';
      steps[1].className = okPhone ? 'done' : (hasOrder ? 'now' : '');
      steps[2].className = hasOrder && okPhone ? 'now' : '';
      if (submit) submit.classList.toggle('is-ready', hasOrder && okPhone);
    }
    if (phone) phone.addEventListener('input', state);
    if (summary && 'MutationObserver' in window) new MutationObserver(state).observe(summary, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    state();
  }

  /* ---- menu: the count pops, a dot flies to the order bar ---- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.qty-btn'); if (!b) return;
    var cnt = b.parentElement && b.parentElement.querySelector('.qty-count');
    requestAnimationFrame(function () {
      if (cnt && !still) { cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); }
      var bar = document.querySelector('.order-bar.visible .order-bar-info strong');
      if (bar && !still) { bar.classList.remove('pop'); void bar.offsetWidth; bar.classList.add('pop'); }
      var tgt = document.querySelector('.order-bar.visible');
      if (!still && tgt && b.classList.contains('qty-plus') && b.animate) {
        var a = b.getBoundingClientRect(), t = tgt.getBoundingClientRect(), d = document.createElement('i'); d.className = 'bh-dot';
        d.style.left = (a.left + a.width / 2 - 7) + 'px'; d.style.top = (a.top + a.height / 2 - 7) + 'px'; document.body.appendChild(d);
        var dx = t.left + 40 - a.left, dy = t.top + t.height / 2 - a.top;
        d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + (dx * .55) + 'px,' + (dy * .2 - 60) + 'px) scale(1.2)', opacity: 1, offset: .55 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity: .2 }], { duration: 620, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = function () { d.remove(); };
      }
    });
  });
})();
