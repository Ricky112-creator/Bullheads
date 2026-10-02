// ============================================
// BULLHEAD — branch config (client side)
// One codebase serves three addresses:
//   bullheadhotels.co.ke          the main site (both counters, the customer picks one when ordering)
//   branch1.bullheadhotels.co.ke  Bullhead One only
//   branch2.bullheadhotels.co.ke  Bullhead Two only
// Everything that can differ between the two counters lives in CFG below, and nowhere else.
// If a branch gets its own WhatsApp number or till, change it HERE and the whole site follows
// (order messages, call/WhatsApp links, the M-Pesa card on /contact and /track, the till on /visit).
// The server-side twin of this list is functions/_lib/branches.js (names + hostnames only).
// ============================================
(function () {
  // The ONE place the shared contact details live. Per-branch overrides go in CFG below.
  var DEFAULT_WA = '254720707323', DEFAULT_PHONE = '0720 707 323', DEFAULT_TILL = '3502492';
  var CFG = {
    one: {
      key: 'one', name: 'Bullhead One', short: 'Bullhead 1', counter: 'Bullhead One', host: 'branch1.bullheadhotels.co.ke',
      whatsapp: DEFAULT_WA, phoneDisplay: DEFAULT_PHONE, till: DEFAULT_TILL,
      lat: -2.078670, lng: 37.469386, other: 'two',
    },
    two: {
      key: 'two', name: 'Bullhead Two', short: 'Bullhead 2', counter: 'Bullhead Two', host: 'branch2.bullheadhotels.co.ke',
      whatsapp: DEFAULT_WA, phoneDisplay: DEFAULT_PHONE, till: DEFAULT_TILL,
      lat: -2.079304, lng: 37.473449, other: 'one',
    },
  };
  function detect() {
    var m = /^branch([12])\./.exec(location.hostname);
    if (m) return m[1] === '1' ? 'one' : 'two';
    // Preview / local testing only: ?branch=one|two switches this tab into a branch site, ?branch=off switches back.
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || /\.pages\.dev$/.test(h)) {
      try {
        var q = new URLSearchParams(location.search).get('branch');
        if (q === 'off') sessionStorage.removeItem('bhBranch');
        else if (CFG[q]) sessionStorage.setItem('bhBranch', q);
        var s = sessionStorage.getItem('bhBranch');
        if (CFG[s]) return s;
      } catch (e) { /* storage blocked: stay on the main site */ }
    }
    return '';
  }

  var key = detect();
  var BH = window.BH = {
    all: CFG,
    key: key,
    current: key ? CFG[key] : null,
    // "Bullhead One" / "Bullhead Two" (the counter picker's value) -> that branch's config, or null
    byCounter: function (c) { var s = String(c || ''); return /\bone\b/i.test(s) ? CFG.one : /\btwo\b/i.test(s) ? CFG.two : null; },
    whatsapp: function (cfg) { return (cfg && cfg.whatsapp) || DEFAULT_WA; },
    till: function (cfg) { return (cfg && cfg.till) || DEFAULT_TILL; },
    origin: function (k) { return 'https://' + CFG[k].host; },
  };
  // Visible phone number and till follow this file on every address, the main site included.
  document.addEventListener('DOMContentLoaded', function () {
    var c = BH.current;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bh-phone]'), function (e) { e.textContent = (c && c.phoneDisplay) || DEFAULT_PHONE; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bh-till]'), function (e) { e.textContent = BH.till(c); });
  });
  if (!key) return;

  // Marks the page as a branch site: CSS hides main-site-only bits ([data-apex-only]) and the other branch's bits ([data-only]).
  // (On the real branch hostnames the server already sets this and removes the other branch's HTML; this covers preview mode.)
  document.documentElement.setAttribute('data-branch', key);
  var cfg = BH.current, other = CFG[cfg.other];

  document.addEventListener('DOMContentLoaded', function () {
    // The counter picker is hidden on a branch site (CSS), but the form still reads it, so keep it right.
    var sel = document.getElementById('location');
    if (sel) sel.value = cfg.counter;

    // "Bullhead" in the nav becomes "Bullhead One" / "Bullhead Two".
    Array.prototype.forEach.call(document.querySelectorAll('.nav-mark'), function (a) {
      Array.prototype.forEach.call(a.childNodes, function (n) { if (n.nodeType === 3 && /Bullhead/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace('Bullhead', cfg.name); });
    });

    // Call / WhatsApp / SMS links and the visible number follow this branch's config.
    if (cfg.whatsapp !== DEFAULT_WA) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
        var h = a.getAttribute('href');
        if (h.indexOf(DEFAULT_WA) !== -1) a.setAttribute('href', h.split(DEFAULT_WA).join(cfg.whatsapp));
      });
    }

    // A quiet pointer to the other counter, so nobody is stranded on the wrong site.
    var f = document.querySelector('footer');
    if (f && !document.getElementById('bhOther')) {
      var p = document.createElement('p');
      p.id = 'bhOther';
      p.style.cssText = 'margin:14px 0 0;font-size:.9rem;text-align:center;opacity:.85;';
      p.appendChild(document.createTextNode('Also open 24 hours: '));
      var a = document.createElement('a');
      a.href = BH.origin(other.key) + '/';
      a.textContent = other.name + ' →';
      a.style.cssText = 'text-decoration:underline;';
      p.appendChild(a);
      f.appendChild(p);
    }
  });
})();
