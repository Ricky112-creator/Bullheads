/* Bullhead greeting strip. When the owner has no live update posted (or /api/updates is unavailable), the existing update bar
   shows friendly greetings instead: time-of-day hello, Kenyan public holidays, Easter, "happy new month", and a rotating house line.
   Owner-posted updates are untouched and always win. Must load BEFORE main.js (it feeds main.js's own /api/updates request). */
(function () {
  'use strict';
  var TZ = 'Africa/Nairobi';

  function parts(d) {
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(d), o = {};
    f.forEach(function (p) { if (p.type !== 'literal') o[p.type] = +p.value; });
    return o;
  }
  function easter(y) {                       /* Gregorian Easter Sunday (anonymous algorithm) -> [month, day] */
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return [mo, da];
  }
  function dayNum(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

  var M = function (en, sw) { return { text: en, textSw: sw }; };
  var FEST = [
    { from: [12, 28], to: [12, 31], m: M('Happy New Year from all of us at Bullhead! May the year ahead be full of good roads and good meals.', 'Heri ya Mwaka Mpya kutoka kwetu sote Bullhead! Mwaka wenu uwe wa baraka na safari njema.') },
    { from: [1, 1], to: [1, 3], m: M('Happy New Year from all of us at Bullhead! May the year ahead be full of good roads and good meals.', 'Heri ya Mwaka Mpya kutoka kwetu sote Bullhead! Mwaka wenu uwe wa baraka na safari njema.') },
    { from: [12, 20], to: [12, 27], m: M('Merry Christmas from the Bullhead family! Safe travels, and a warm table is waiting for you.', 'Krismasi njema kutoka familia ya Bullhead! Safari salama, meza yenye joto inakusubiri.') },
    { from: [12, 11], to: [12, 12], m: M('Happy Jamhuri Day, Kenya!', 'Jamhuri Njema, Kenya!') },
    { from: [10, 19], to: [10, 20], m: M('Happy Mashujaa Day! We honour our heroes.', 'Siku Kuu ya Mashujaa njema! Tunawaenzi mashujaa wetu.') },
    { from: [5, 31], to: [6, 1], m: M('Happy Madaraka Day, Kenya!', 'Madaraka Day njema, Kenya!') },
    { from: [4, 30], to: [5, 1], m: M('Happy Labour Day! Take a break, you have earned a good meal.', 'Siku ya Wafanyakazi njema! Pumzika, umestahili mlo mzuri.') }
  ];
  var EASTER = M('Happy Easter from Bullhead! Wishing you a blessed weekend with family and friends.', 'Pasaka njema kutoka Bullhead! Tunawatakia wikendi yenye baraka na familia na marafiki.');
  var NEWMONTH = M('Happy new month! Wishing you a month of blessings and good food.', 'Heri ya mwezi mpya! Mwezi wa baraka na chakula kizuri.');
  var POOL = [
    M('Open 24 hours, every day. Whatever the hour, we are here.', 'Wazi masaa 24, kila siku. Saa yoyote, tupo.'),
    M('Driving through Emali? Order ahead and it will be waiting at the counter.', 'Unapita Emali? Agiza mapema, kikusubiri kaunta.'),
    M('Thank you for choosing Bullhead. You are always welcome.', 'Asante kwa kuchagua Bullhead. Karibu daima.'),
    M('Safe travels! Stop by for something warm on the road.', 'Safari salama! Karibu upate kitu chenye joto njiani.'),
    M('Fresh meat from our butchery, by the kilo. Ask us how much you need.', 'Nyama safi kutoka kwa bucha yetu, kwa kilo. Uliza unahitaji kiasi gani.')
  ];
  function hello(h) {
    return h >= 5 && h < 11 ? M('Good morning! Hot chai, andazi and chapati are on.', 'Habari za asubuhi! Chai moto, andazi na chapati viko tayari.')
      : h >= 11 && h < 17 ? M('Good afternoon! Lunch is on, come hungry.', 'Habari za mchana! Chakula cha mchana kiko tayari, karibu.')
      : h >= 17 && h < 22 ? M('Good evening! Supper is on, and the tea is hot.', 'Habari za jioni! Chakula cha jioni kiko tayari, na chai ni moto.')
      : M('Still on the road? The kitchen is awake and the tea is hot.', 'Bado uko barabarani? Jiko liko macho na chai ni moto.');
  }

  function messages(date) {
    var p = parts(date || new Date()), y = p.year, m = p.month, d = p.day, today = dayNum(y, m, d), out = [];
    FEST.forEach(function (f) { if (!out.length && today >= dayNum(y, f.from[0], f.from[1]) && today <= dayNum(y, f.to[0], f.to[1])) out.push(f.m); });
    var e = easter(y), es = dayNum(y, e[0], e[1]);
    if (!out.length && today >= es - 2 && today <= es + 1) out.push(EASTER);          /* Good Friday to Easter Monday */
    if (d <= 2) out.push(NEWMONTH);
    out.push(hello(p.hour));
    var doy = today - dayNum(y, 1, 1);
    out.push(POOL[doy % POOL.length]); out.push(POOL[(doy + 1) % POOL.length]);
    var stamp = y * 10000 + m * 100 + d;
    return out.slice(0, 3).map(function (x, i) { return { id: 'bh-g-' + stamp + '-' + i, type: 'greeting', text: x.text, textSw: x.textSw, cta: false }; });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { messages: messages, easter: easter }; return; }
  if (typeof window === 'undefined' || !window.fetch || typeof Response === 'undefined') return;

  /* feed main.js's own request: real owner updates pass through untouched, otherwise greetings stand in */
  var orig = window.fetch;
  function fake() { return new Response(JSON.stringify({ updates: messages() }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET' || !/^(https?:\/\/[^/]+)?\/api\/updates\/?(\?branch=(?:one|two|main))?$/.test(url)) return orig.apply(this, arguments);
    return orig.apply(this, arguments).then(function (r) {
      if (!r || !r.ok) return fake();
      return r.clone().json().then(function (d) { return d && d.updates && d.updates.length ? r : fake(); }, fake);
    }, fake);
  };

  /* the bar's pill says "Update" for unknown types: label greetings "Welcome" / "Karibu" instead */
  function relabel() {
    var bar = document.getElementById('liveUpdateBar'); if (!bar) return;
    function fix() {
      if (!bar.classList.contains('type-greeting')) return;
      var pill = bar.querySelector('.lu-pill'), t = pill && pill.lastChild;
      var sw = false; try { sw = localStorage.getItem('bullheadLang') === 'sw'; } catch (e) {}
      if (t && t.nodeType === 3) t.nodeValue = sw ? 'Karibu' : 'Welcome';
    }
    if ('MutationObserver' in window) new MutationObserver(fix).observe(bar, { childList: true, attributes: true, attributeFilter: ['class'] });
    fix();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relabel); else relabel();
})();
