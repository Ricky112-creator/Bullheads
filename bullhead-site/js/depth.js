/* Bullhead depth: live 3D backgrounds on canvas 2D, perspective-projected by hand. No libraries, no network.
   embers  = the footer: a glowing grill grate on a floor plane, sparks rising through it (the grill never goes out)
   sparks  = the home hero: a few sparks lifting off the photo
   road    = the Visit hero: lane dashes and roadside posts streaming toward you (the Nairobi-Mombasa road)
   One shared loop. It draws only the scenes on screen, only while the tab is visible, at most ~45 fps,
   and holds a single still frame for visitors who asked for less motion, saved data, or have a weak device. */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var conn = navigator.connection || {};
  var weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || conn.saveData;
  var still = function () { return mq.matches || weak; };
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var scenes = [], px = 0, tx = 0, running = false, last = 0, t0 = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function mount(host, kind) {
    if (!host || host.querySelector(':scope > canvas.bh-depth')) return;
    var cv = document.createElement('canvas'); cv.className = 'bh-depth bh-depth--' + kind; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, kind === 'embers' ? host.firstChild : (host.querySelector('.hero-scrim, .page-hero-scrim') || null));
    host.classList.add('bh-depth-host');
    var s = { host: host, cv: cv, cx: cv.getContext('2d'), kind: kind, w: 0, h: 0, dpr: 1, vis: false, p: [], t: 0 };
    s.seed = function () {
      var n = kind === 'embers' ? (s.w < 700 ? 26 : 56) : kind === 'sparks' ? (s.w < 700 ? 12 : 26) : 0;
      s.p = []; for (var i = 0; i < n; i++) s.p.push(spawn(true));
    };
    function spawn(first) { return { x: rnd(-4, 4), y: first ? rnd(0, 2.4) : rnd(0, .2), z: rnd(1.2, 7), v: rnd(.14, .42), ph: rnd(0, 6.28), sw: rnd(.15, .5), r: rnd(.6, 1.7), hot: Math.random() }; }
    s.spawn = spawn;
    s.size = function () {
      var r = host.getBoundingClientRect(); s.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      s.w = Math.max(1, Math.round(r.width)); s.h = Math.max(1, Math.round(r.height));
      cv.width = Math.round(s.w * s.dpr); cv.height = Math.round(s.h * s.dpr); s.cx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      s.seed(); draw(s, 0);
    };
    if ('ResizeObserver' in window) new ResizeObserver(function () { s.size(); }).observe(host); else window.addEventListener('resize', s.size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { s.vis = es[0].isIntersecting; if (s.vis) kick(); }, { rootMargin: '80px 0px' }).observe(host); else s.vis = true;
    scenes.push(s); s.size();
  }

  function ember(c, s, p, f, cxm, hy, t) {
    var z = p.z; if (z < .4) return;
    var X = cxm + ((p.x + Math.sin(t * p.sw + p.ph) * .35 - px * .5) / z) * f;
    var Y = hy + ((1.1 - p.y) / z) * f;
    if (X < -20 || X > s.w + 20 || Y < -20 || Y > s.h + 20) return;
    var life = Math.min(1, p.y / .35) * Math.max(0, 1 - p.y / 2.5), r = Math.max(.5, p.r * (f / z) * .016);
    var a = life * (.35 + .65 * Math.min(1, 2.6 / z));
    c.fillStyle = 'rgba(255,' + Math.round(110 + p.hot * 90) + ',' + Math.round(40 + p.hot * 50) + ',' + (a * .2).toFixed(3) + ')';
    c.beginPath(); c.arc(X, Y, r * 4.2, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,' + Math.round(190 + p.hot * 50) + ',120,' + a.toFixed(3) + ')';
    c.beginPath(); c.arc(X, Y, r, 0, 6.2832); c.fill();
  }

  function draw(s, dt) {
    var c = s.cx, w = s.w, h = s.h; s.t += dt; var t = s.t;
    c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'lighter';
    if (s.kind === 'embers') {
      var hy = h * .42, f = Math.max(w, 640) * .62, cxm = w / 2;
      var g = c.createRadialGradient(cxm, h * 1.05, 0, cxm, h * 1.05, Math.max(w, h) * .72);
      var pulse = .5 + .5 * Math.sin(t * .9) * Math.sin(t * .37 + 1);
      g.addColorStop(0, 'rgba(235,100,35,' + (.30 + .08 * pulse).toFixed(3) + ')'); g.addColorStop(.5, 'rgba(170,60,25,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      /* the grate: lines on a floor plane that slowly slides toward you */
      c.lineWidth = 1; var off = (t * .18) % .6, i, z, Y, a;
      for (i = 0; i < 14; i++) {
        z = .9 + i * .6 - off; if (z < .5) continue; Y = hy + (1.1 / z) * f; if (Y > h + 4) continue;
        a = Math.max(0, .26 - i * .017) * Math.min(1, (z - .5) * 1.4);
        c.strokeStyle = 'rgba(255,128,52,' + a.toFixed(3) + ')'; c.beginPath(); c.moveTo(0, Y); c.lineTo(w, Y); c.stroke();
      }
      for (i = -8; i <= 8; i++) {
        var xa = cxm + ((i * .7 - px * .5) / 7) * f, ya = hy + (1.1 / 7) * f, xb = cxm + ((i * .7 - px * .5) / .55) * f, yb = hy + (1.1 / .55) * f;
        a = Math.max(.02, .17 - Math.abs(i) * .012);
        c.strokeStyle = 'rgba(255,128,52,' + a.toFixed(3) + ')'; c.beginPath(); c.moveTo(xa, ya); c.lineTo(xb, yb); c.stroke();
      }
      for (i = 0; i < s.p.length; i++) { var p = s.p[i]; p.y += p.v * dt; if (p.y > 2.5) s.p[i] = s.spawn(false); ember(c, s, s.p[i], f, cxm, hy, t); }
    } else if (s.kind === 'sparks') {
      var f2 = Math.max(w, 700) * .7;
      for (var k = 0; k < s.p.length; k++) { var q = s.p[k]; q.y += q.v * dt * 1.1; if (q.y > 2.5) s.p[k] = s.spawn(false); ember(c, s, s.p[k], f2, w / 2, h * .98 - f2 * .1, t); }
    } else if (s.kind === 'road') {
      var hz = h * .46, fr = Math.max(w, 700) * .75, mid = w / 2 - px * w * .03;
      var gl = c.createLinearGradient(0, hz - 60, 0, hz + 40); gl.addColorStop(0, 'rgba(255,170,90,0)'); gl.addColorStop(.5, 'rgba(255,150,70,.28)'); gl.addColorStop(1, 'rgba(255,150,70,0)');
      c.fillStyle = gl; c.fillRect(0, hz - 60, w, 100);
      var sp = (t * 3.2) % 4;
      function P(x, z) { return [mid + (x / z) * fr, hz + (1.25 / z) * fr]; }
      c.lineCap = 'round';
      for (var d = 0; d < 12; d++) {
        var z0 = d * 4 - sp + 2, z1 = z0 + 1.6; if (z1 < .7) continue; if (z0 < .7) z0 = .7;
        var A = P(0, z0), B = P(0, z1), al = Math.min(1, 7 / z0) * .5;
        c.strokeStyle = 'rgba(255,224,170,' + al.toFixed(3) + ')'; c.lineWidth = Math.max(1, 26 / z0 * (fr / 900)); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
        for (var sd = -1; sd <= 1; sd += 2) {
          var pa = P(sd * 3.1, z0), pb = [pa[0], pa[1] - 90 / z0 * (fr / 900)];
          c.strokeStyle = 'rgba(255,190,120,' + (al * .8).toFixed(3) + ')'; c.lineWidth = Math.max(1, 10 / z0 * (fr / 900)); c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
        }
      }
      for (var e = -1; e <= 1; e += 2) { var n1 = P(e * 1.75, 12), n2 = P(e * 1.75, .7); c.strokeStyle = 'rgba(255,200,140,.16)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(n1[0], n1[1]); c.lineTo(n2[0], n2[1]); c.stroke(); }
      /* a pair of headlights now and then, coming up the far lane */
      var cyc = (t % 9) / 9; if (cyc < .55) { var zz = 14 - cyc / .55 * 12.5, L = P(-1.1 - .0, zz), R = P(-.55, zz), ra = Math.max(1.2, 70 / zz * (fr / 900) * .1);
        c.fillStyle = 'rgba(255,238,200,' + Math.min(.9, cyc * 4).toFixed(3) + ')'; c.beginPath(); c.arc(L[0], L[1] - ra, ra, 0, 6.2832); c.arc(R[0], R[1] - ra, ra, 0, 6.2832); c.fill(); }
    }
    c.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(.05, (now - last) / 1000 || 0); 
    if (now - last < 22) { requestAnimationFrame(frame); return; }
    last = now; px += (tx - px) * .06; var any = false;
    for (var i = 0; i < scenes.length; i++) if (scenes[i].vis) { draw(scenes[i], dt); any = true; }
    if (any && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (running || still() || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  function init() {
    var foot = document.querySelector('footer.visit'); if (foot) mount(foot, 'embers');
    var home = document.querySelector('.hero .hero-media'); if (home) mount(home, 'sparks');
    var vh = document.querySelector('body.visit-page .page-hero, .page-hero[data-bh-scene="road"]'); if (vh) mount(vh, 'road');
    if (fine && !still()) window.addEventListener('pointermove', function (e) { tx = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    if (mq.addEventListener) mq.addEventListener('change', kick);
    kick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
