(function () {
  var root = document.getElementById('relay'); if (!root) return;
  var beats = root.querySelectorAll('.beat'), tk = root.querySelector('.ticket'), fill = root.querySelector('.rail i'),
      lines = tk.querySelectorAll('.ln.w'), clk = tk.querySelector('.clk'), name = tk.querySelector('[data-branch-name]'), timers = [], ran = false, turn = 0;
  var D = {
    one: { n: 'Bullhead One', i: ['1  Nyama choma \u00bd kg', '2  Ugali', '1  Kachumbari', '2  Chai'], note: 'no chili, extra ugali' },
    two: { n: 'Bullhead Two', i: ['1  Tilapia & ugali', '2  Chapati', '1  Kachumbari', '2  Chai'], note: 'no chili please' }
  };
  var fixed = root.getAttribute('data-branch');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fillTicket() {
    var k = D[fixed] ? fixed : (turn++ % 2 ? 'two' : 'one'), d = D[k];
    name.textContent = d.n;
    var t = ['ORDER BH-7K2Q \u00b7 PICKUP'].concat(d.i, ['NOTE  ' + d.note, 'PAID  M-Pesa till \u2713']);
    lines.forEach(function (l, x) { l.textContent = t[x] || ''; });
  }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function reset() { timers.forEach(clearTimeout); timers = []; beats.forEach(function (b) { b.classList.remove('on', 'press'); }); tk.classList.remove('on');
    lines.forEach(function (l) { l.classList.remove('on'); }); fill.style.height = '0'; clk.textContent = '0:00'; }
  function play() {
    reset(); fillTicket();
    at(200, function () { beats[0].classList.add('on'); });
    at(1100, function () { beats[0].classList.add('press'); });
    at(1300, function () { beats[0].classList.remove('press'); beats[1].classList.add('on'); fill.style.height = '50%'; });
    at(2300, function () { beats[2].classList.add('on'); fill.style.height = '100%'; tk.classList.add('on'); });
    lines.forEach(function (l, i) { at(2900 + i * 320, function () { l.classList.add('on'); }); });
    [['0:01', 3000], ['0:02', 3700], ['0:03', 4300]].forEach(function (t) { at(t[1], function () { clk.textContent = t[0]; }); });
  }
  function still() { fillTicket(); beats.forEach(function (b) { b.classList.add('on'); }); tk.classList.add('on'); lines.forEach(function (l) { l.classList.add('on'); }); fill.style.height = '100%'; clk.textContent = '0:03'; }
  root.querySelector('.relay-replay').addEventListener('click', function () { reduce ? still() : play(); });
  if (!('IntersectionObserver' in window) || reduce) { still(); return; }
  new IntersectionObserver(function (es, o) { if (es[0].isIntersecting && !ran) { ran = true; play(); o.disconnect(); } }, { threshold: .45 }).observe(root);
})();
