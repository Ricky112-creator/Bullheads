/* Bullhead hero reel: the first photo is already on screen (it is the LCP image); the rest load after the page settles,
   then crossfade with a slow push. Pauses off screen and when the tab is hidden. Holds still for reduced motion. */
(function () {
  var media = document.querySelector('.hero .hero-media[data-hero-slides]'); if (!media) return;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {}; if (still || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) return;
  var urls = media.getAttribute('data-hero-slides').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var first = media.querySelector(':scope > picture, :scope > img'); if (!first || !urls.length) return;
  var slides = [first], cur = 0, timer = 0, ready = 0, on = true, hold = 6800;
  first.classList.add('hero-slide', 'is-on');
  var anchor = media.querySelector('.hero-scrim');
  function load() {
    urls.forEach(function (u) {
      var im = new Image(); im.className = 'hero-slide'; im.alt = ''; im.decoding = 'async'; im.setAttribute('aria-hidden', 'true');
      im.onload = function () { ready++; if (ready === 1) start(); };
      im.src = u; media.insertBefore(im, anchor); slides.push(im);
    });
  }
  function show(n) {
    var prev = slides[cur]; cur = n; var el = slides[cur];
    el.classList.remove('is-on'); void el.offsetWidth; el.style.setProperty('--dir', cur % 2 ? '1' : '-1'); el.classList.add('is-on');
    prev.classList.remove('is-on');
  }
  function next() {
    if (!on || document.hidden) return;
    for (var k = 1; k <= slides.length; k++) { var n = (cur + k) % slides.length, s = slides[n]; if (n === 0 || (s.complete && s.naturalWidth)) { show(n); return; } }
  }
  function start() { if (!timer) timer = setInterval(next, hold); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; }, { threshold: 0.05 }).observe(media);
  function go() { setTimeout(load, 1200); }
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
