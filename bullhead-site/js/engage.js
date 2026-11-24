/* Bullhead engagement layer. Additive only: never edits existing markup, cart logic or CTAs.
   - menu: add-to-order feedback, "goes well with" strip, "how much meat?" guide
   - visit: save our number, send to a friend
   - reviews strip: shows only when real reviews are pasted into BH_REVIEWS below */
(function () {
  'use strict';
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function buzz(ms) { try { if (!still && navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {} }
  function pop(el) { if (!el || still) return; el.classList.remove('bh-pop'); void el.offsetWidth; el.classList.add('bh-pop'); }
  function items() { return (typeof MENU_ITEMS !== 'undefined' && MENU_ITEMS) || []; }
  function cart() { try { return typeof getCart === 'function' ? getCart() : {}; } catch (e) { return {}; } }
  function money(n) { return typeof formatKES === 'function' ? formatKES(n) : 'KES ' + n; }
  function orderable(it) { return it && typeof it.price === 'number' && !it.soldOut; }

  /* ============ MENU PAGE ============ */
  function menuInit() {
    var list = document.getElementById('menuList'); if (!list) return;

    /* tap feedback on every "+" (real taps only, so scripted taps below don't buzz repeatedly) */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.qty-plus'); if (!b || !e.isTrusted) return;
      pop(b.parentNode.querySelector('.qty-count')); pop(document.getElementById('orderBarCount')); buzz(12);
    });

    function plusOnce(id) {
      var btn = list.querySelector('.menu-item[data-id="' + id + '"] .qty-plus');
      if (btn) btn.click(); return !!btn;
    }

    /* ---- goes well with ---- */
    var strip = document.createElement('div'); strip.className = 'bh-ups'; strip.setAttribute('role', 'region'); strip.setAttribute('aria-label', 'Goes well with your order');
    document.body.appendChild(strip);
    var dismissed = false;
    function catOf(id) { var it = items().filter(function (i) { return i.id === id; })[0]; return it ? String(it.category).toLowerCase() : ''; }
    function suggest() {
      var c = cart(), ids = Object.keys(c); if (!ids.length) return [];
      var cats = ids.map(catOf);
      function has(re) { return cats.some(function (x) { return re.test(x); }); }
      var heavy = has(/grill|fish|butchery/) || ids.some(function (i) { return /^(kuku|matumbo|beef-fry|chicken)/.test(i); });
      var main = has(/main dishes/), cold = has(/cold/), hot = has(/hot/), snack = has(/snack/);
      var pool = heavy ? ['kachumbari', 'extra-ugali', 'soda-300ml', 'water-500ml']
        : main ? ['kachumbari', 'soda-300ml', 'chapati', 'water-500ml']
        : hot && !snack ? ['andazi', 'chapati']
        : snack && !hot ? ['tea-mug', 'teacup']
        : [];
      if (cold) pool = pool.filter(function (i) { return !/soda|water/.test(i); });
      var out = [];
      pool.forEach(function (id) {
        if (out.length >= 3 || c[id]) return;
        var it = items().filter(function (i) { return i.id === id; })[0];
        if (orderable(it) && list.querySelector('.menu-item[data-id="' + id + '"] .qty-plus')) out.push(it);
      });
      return out;
    }
    function paint() {
      var bar = document.getElementById('orderBar');
      var s = (bar && bar.classList.contains('visible') && !dismissed) ? suggest() : [];
      if (!s.length) { strip.classList.remove('on'); return; }
      var key = s.map(function (i) { return i.id; }).join();
      if (strip.getAttribute('data-k') !== key) {
        strip.setAttribute('data-k', key); strip.textContent = '';
        var lab = document.createElement('span'); lab.textContent = 'Goes well with:'; strip.appendChild(lab);
        s.forEach(function (it) {
          var b = document.createElement('button'); b.type = 'button';
          b.appendChild(document.createTextNode('+ ' + it.name + ' ')); var p = document.createElement('b'); p.textContent = money(it.price); b.appendChild(p);
          b.addEventListener('click', function () { if (plusOnce(it.id)) { pop(document.getElementById('orderBarCount')); buzz(12); } });
          strip.appendChild(b);
        });
        var x = document.createElement('button'); x.type = 'button'; x.className = 'bh-x'; x.setAttribute('aria-label', 'Hide suggestions'); x.textContent = '×';
        x.addEventListener('click', function () { dismissed = true; paint(); }); strip.appendChild(x);
      }
      strip.classList.add('on');
    }
    var ob = document.getElementById('orderBar');
    if (ob && 'MutationObserver' in window) new MutationObserver(paint).observe(ob, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    paint();

    /* ---- how much meat? ---- */
    var meats = function () { return items().filter(function (i) { return i.unit === 'kg' && orderable(i); }); };
    {
      var d = document.createElement('details'); d.className = 'bh-est';
      var sm = document.createElement('summary'); sm.textContent = 'How much meat for your group?'; d.appendChild(sm);
      var body = document.createElement('div'); body.className = 'bh-est-body';
      body.innerHTML =
        '<div class="bh-est-row">' +
        '<label>People<input type="number" id="bhPpl" min="1" max="40" value="4" inputmode="numeric"></label>' +
        '<label>Appetite<select id="bhApp"><option value="200">Light bite</option><option value="300" selected>Proper meal</option><option value="400">Very hungry</option></select></label>' +
        '<label>Meat<select id="bhCut"></select></label></div>' +
        '<p class="bh-est-out" id="bhOut" aria-live="polite"></p>' +
        '<button type="button" class="bh-add" id="bhAdd">Add to my order</button>';
      d.appendChild(body); list.parentNode.insertBefore(d, list);
      var ppl = $('#bhPpl', d), app = $('#bhApp', d), cut = $('#bhCut', d), out = $('#bhOut', d), add = $('#bhAdd', d);
      function fillCuts() {
        var m = meats(), keep = cut.value; cut.textContent = '';
        m.forEach(function (it) { var o = document.createElement('option'); o.value = it.id; o.textContent = it.name + ' (' + money(it.price) + '/kg)'; cut.appendChild(o); });
        if (keep && m.some(function (i) { return i.id === keep; })) cut.value = keep;
        d.style.display = m.length ? '' : 'none';
      }
      function calc() {
        var n = Math.max(1, Math.min(40, parseInt(ppl.value, 10) || 1)), g = +app.value;
        var kg = Math.max(0.5, Math.ceil(n * g / 500) / 2);               /* round up to the 0.5 kg the menu sells in */
        var it = meats().filter(function (i) { return i.id === cut.value; })[0];
        if (!it) { out.textContent = ''; add.style.display = 'none'; return null; }
        add.style.display = '';
        out.textContent = '';
        var b = document.createElement('b'); b.textContent = 'About ' + String(kg).replace(/\.0$/, '') + ' kg'; out.appendChild(b);
        out.appendChild(document.createTextNode(' of ' + it.name.toLowerCase() + ', around ' + money(Math.round(kg * it.price))));
        var sml = document.createElement('small'); sml.textContent = 'A rough guide for ' + n + (n === 1 ? ' person' : ' people') + ', bones and all. Ask us if you want it cut a certain way.'; out.appendChild(sml);
        return { it: it, kg: kg };
      }
      [ppl, app, cut].forEach(function (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); });
      add.addEventListener('click', function () {
        var r = calc(); if (!r) return;
        var steps = Math.round(r.kg / 0.5), k;
        for (k = 0; k < steps; k++) if (!plusOnce(r.it.id)) break;
        pop(document.getElementById('orderBarCount')); buzz([14, 40, 14]);
      });
      fillCuts(); calc();
      d.addEventListener('toggle', function () { if (d.open) { fillCuts(); calc(); } });
    }
  }

  /* ============ VISIT PAGE: save number / send to a friend ============ */
  function visitInit() {
    var tel = $('.visit-block a[href^="tel:"]'); if (!tel || document.getElementById('bhShare')) return;
    var num = tel.getAttribute('href').replace(/^tel:/, '');
    var og = $('meta[property="og:site_name"]'), name = (og && og.content) || 'Bullhead Emali';
    var wrap = document.createElement('div'); wrap.className = 'bh-share'; wrap.id = 'bhShare';
    var save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save our number';
    var send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send to a friend';
    wrap.appendChild(save); wrap.appendChild(send); tel.closest('p').insertAdjacentElement('afterend', wrap);
    save.addEventListener('click', function () {
      var v = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:' + name + '\r\nORG:' + name + '\r\nTEL;TYPE=CELL,VOICE:' + num + '\r\nURL:' + location.origin + '/\r\nEND:VCARD\r\n';
      try {
        var u = URL.createObjectURL(new Blob([v], { type: 'text/vcard' })), a = document.createElement('a');
        a.href = u; a.download = 'bullhead.vcf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      } catch (e) { location.href = 'tel:' + num; }
    });
    send.addEventListener('click', function () {
      var text = name + ': open 24 hours, choma, chips and ugali in Emali. ' + location.origin + '/';
      if (navigator.share) { navigator.share({ title: name, text: text, url: location.origin + '/' }).catch(function () {}); }
      else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }

  /* ============ REVIEWS STRIP (home) ============
     Paste ONLY real reviews here, e.g. { name: 'Jane M.', stars: 5, text: 'Exact words from the review', source: 'Google' }.
     While this list is empty nothing is shown on the page. */
  var BH_REVIEWS = [];
  function reviewsInit() {
    if (!BH_REVIEWS.length) return;
    var anchor = document.getElementById('rightnow'); if (!anchor) return;
    var sec = document.createElement('section'); sec.className = 'bh-rev'; sec.setAttribute('aria-label', 'What guests say');
    var h = document.createElement('h2'); h.textContent = 'What guests say'; sec.appendChild(h);
    var row = document.createElement('div'); row.className = 'bh-rev-row'; sec.appendChild(row);
    BH_REVIEWS.forEach(function (r) {
      var f = document.createElement('figure'), s = document.createElement('div'), q = document.createElement('blockquote'), c = document.createElement('figcaption');
      s.className = 'st'; s.setAttribute('aria-label', (r.stars || 5) + ' out of 5 stars'); s.textContent = new Array((r.stars || 5) + 1).join('★');
      q.textContent = r.text; c.textContent = r.name + (r.source ? ', ' + r.source : '');
      f.appendChild(s); f.appendChild(q); f.appendChild(c); row.appendChild(f);
    });
    anchor.insertAdjacentElement('afterend', sec);
  }

  function boot() { menuInit(); visitInit(); reviewsInit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
