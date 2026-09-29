(function () {
  var root = document.getElementById('relay'); if (!root) return;
  var beats = root.querySelectorAll('.beat'), tk = root.querySelector('.ticket'), fill = root.querySelector('.rail i'),
      lines = tk.querySelectorAll('.ln.w'), clk = tk.querySelector('.clk'), name = tk.querySelector('[data-branch-name]'), timers = [], ran = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (name) name.textContent = (window.BH && BH.current ? BH.current.name : 'Bullhead Two');
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function reset() { timers.forEach(clearTimeout); timers = []; beats.forEach(function (b) { b.classList.remove('on', 'press'); }); tk.classList.remove('on');
    lines.forEach(function (l) { l.classList.remove('on'); }); fill.style.height = '0'; clk.textContent = '0:00'; }
  function play() {
    reset();
    var h = function (p) { return function () { fill.style.height = p + '%'; }; };
    at(200, function () { beats[0].classList.add('on'); });
    at(1100, function () { beats[0].classList.add('press'); });
    at(1300, function () { beats[0].classList.remove('press'); beats[1].classList.add('on'); h(50)(); });
    at(2300, function () { beats[2].classList.add('on'); h(100)(); tk.classList.add('on'); });
    lines.forEach(function (l, i) { at(2900 + i * 320, function () { l.classList.add('on'); }); });
    [['0:01', 3000], ['0:02', 3700], ['0:03', 4300]].forEach(function (t) { at(t[1], function () { clk.textContent = t[0]; }); });
  }
  function still() { beats.forEach(function (b) { b.classList.add('on'); }); tk.classList.add('on'); lines.forEach(function (l) { l.classList.add('on'); }); fill.style.height = '100%'; clk.textContent = '0:03'; }
  root.querySelector('.relay-replay').addEventListener('click', function () { reduce ? still() : play(); });
  if (!('IntersectionObserver' in window) || reduce) { still(); return; }
  new IntersectionObserver(function (es, o) { if (es[0].isIntersecting && !ran) { ran = true; play(); o.disconnect(); } }, { threshold: .45 }).observe(root);
})();
