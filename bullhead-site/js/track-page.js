(function () {
  var $ = function (id) { return document.getElementById(id); };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var id = new URLSearchParams(location.search).get('o') || '';
  var TYPE = { 'dine-in': 'Dine in', delivery: 'Delivery', 'drive-through': 'Drive-through', reserve: 'Reservation', 'on-the-way': 'On my way' };
  var STAGE = { unconfirmed: -1, cancelled: -1, new: 0, preparing: 1, ready: 2, done: 3 };
  var WA = '254720707323';
  var READY_SUB = {
    'dine-in': 'Your food is ready and on its way to your table.',
    'drive-through': 'Your order is ready for pick-up at the counter.',
    'on-the-way': 'Your order is ready and waiting for you at the counter.',
    delivery: 'Your order is ready and heading out to you.',
    reserve: 'Your table is ready for you.'
  };
  var COPY = {
    unconfirmed: { e: '📲', h: 'Waiting for confirmation', sw: 'Tunasubiri kuthibitisha', s: 'Send your order on WhatsApp so we can confirm it. This page will update as soon as we do.' },
    cancelled: { e: '✖️', h: 'This order was cancelled', sw: 'Oda hii imeghairiwa', s: 'If that’s a surprise, message us on WhatsApp and we’ll sort it out.' },
    new:       { e: '📝', h: 'We’ve got your order', sw: 'Tumepokea oda yako', s: 'The kitchen will start on it in a moment.' },
    preparing: { e: '🔥', h: 'Being prepared', sw: 'Inaandaliwa sasa', s: 'Your food is being cooked fresh right now.' },
    ready:     { e: '🍽', h: 'Your order is ready!', sw: 'Oda yako iko tayari!', s: '' },
    done:      { e: '😋', h: 'Enjoy your meal', sw: 'Karibu tena!', s: 'Thank you for choosing Bullhead. We’re open 24 hours.' }
  };
var REVIEW = { 'Bullhead One': 'https://g.page/r/CZlFY4eey516EBM/review', 'Bullhead Two': 'https://g.page/r/CYM5D_xsP-3oEBM/review' };
  var last = null, timer = null, failed = 0, misses = 0;

  // Once the order is done, invite a Google review for the counter they used (both if unknown).
  function showReview(o) {
    var box = $('review');
    if (o.status !== 'done') { box.hidden = true; return; }
    var key = String(o.counter || '');
    if (!box.hidden && box.dataset.for === key) return;
    box.dataset.for = key; box.innerHTML = '';
    var one = REVIEW[key] ? [key] : Object.keys(REVIEW);
    var h = document.createElement('h2'); h.textContent = '⭐ Enjoyed it? Tell others'; box.appendChild(h);
    var p = document.createElement('p'); p.className = 'tk-meta';
    p.textContent = 'A quick Google review helps other travellers find us. ' + (one.length > 1 ? 'Which counter did you visit?' : 'Thank you!');
    box.appendChild(p);
    var sw = document.createElement('p'); sw.className = 'tk-rvs'; sw.textContent = 'Tupe maoni yako kwenye Google. Asante!'; box.appendChild(sw);
    one.forEach(function (k) {
      var a = document.createElement('a'); a.className = 'tk-rv'; a.href = REVIEW[k]; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = one.length > 1 ? 'Review ' + k : 'Leave a Google review'; box.appendChild(a);
    });
    box.hidden = false;
  }
  function show(state, o) {
    var c = COPY[state];
    $('emoji').textContent = c.e; $('headline').textContent = c.h; $('headlineSw').textContent = c.sw;
    $('sub').textContent = state === 'ready' ? (READY_SUB[o && o.type] || 'Your order is ready.') : c.s;
    var cur = STAGE[state];
    Array.prototype.forEach.call($('steps').children, function (li, i) {
      li.className = i < cur ? 'done' : (i === cur ? 'now' + (i === 2 ? ' final' : '') : '');
    });
    $('steps').hidden = cur < 0;
    document.title = c.h + ' | Bullhead';
  }

  function notFound(wasKnown) {
    $('steps').hidden = true; $('orderCard').hidden = true; $('eta').hidden = true;
    if (wasKnown) {
      $('emoji').textContent = '😋'; $('headline').textContent = 'This order is complete'; $('headlineSw').textContent = 'Oda hii imekamilika';
      $('sub').textContent = 'Thank you for choosing Bullhead. Order again any time. We’re open 24 hours.';
    } else {
      $('emoji').textContent = '🤔'; $('headline').textContent = 'We can’t find this order'; $('headlineSw').textContent = 'Hatuipati oda hii';
      $('sub').textContent = 'The link may be incomplete. Open the exact link from your WhatsApp message, or message us and we’ll check.';
    }
    $('pay').innerHTML = ''; $('live').hidden = true; stop();
  }

  // Short message for the recovery button: the code is what staff match against the dashboard.
  function waText(o) {
    var L = ['Hi Bullhead, confirming my order #' + orderCode(id) + ' (' + (TYPE[o.type] || 'order') + (o.table ? ', Table ' + o.table : '') + ')'];
    o.items.forEach(function (i) { L.push('- ' + (i.unit === 'kg' ? i.qty + 'kg ' : i.qty + 'x ') + i.name); });
    if (o.total) L.push('Total: KES ' + o.total.toLocaleString('en-KE'));
    L.push('Track: ' + location.origin + '/track?o=' + id);
    return L.join('\n');
  }

  function render(o) {
    show(o.status, o);
    var eta = $('eta');
    if (o.etaAt && (o.status === 'new' || o.status === 'preparing')) {
      var t = new Date(o.etaAt); eta.textContent = '🚗 You’ll arrive around ' + t.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }); eta.hidden = false;
    } else eta.hidden = true;
    var ul = $('items'); ul.innerHTML = '';
    o.items.forEach(function (i) {
      var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span');
      a.textContent = i.name; b.textContent = i.unit === 'kg' ? i.qty + ' kg' : '× ' + i.qty; li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    $('meta').textContent = 'Order #' + orderCode(id) + ' · ' + (TYPE[o.type] || 'Order') + (o.table ? ' · Table ' + o.table : '');
    // Recovery button: if the customer never sent the WhatsApp message (pop-up blocked, tab closed), it is one tap away.
    var sc = $('sendCard'); sc.hidden = o.status !== 'unconfirmed';
    WA = window.BH ? BH.whatsapp(BH.current || BH.byCounter(o.counter)) : WA;   // the branch this order is for
    if (!sc.hidden) $('sendBtn').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(waText(o));
    $('total').textContent = 'KES ' + (o.total || 0).toLocaleString('en-KE'); $('totalRow').hidden = !o.total;
    $('orderCard').hidden = !(o.items.length || o.table || o.type);
    // Optional pay-ahead card, only while the order is still open.
    var pay = $('pay'), wantPay = o.total > 0 && o.status !== 'done' && o.status !== 'cancelled' && o.status !== 'unconfirmed' && typeof mpesaCard === 'function';   // no paying for an order we haven’t confirmed
    if (!wantPay) pay.innerHTML = '';
    else if (!pay.firstChild) { var pc = mpesaCard(o.total, o.counter); pc.style.margin = '0 0 16px'; pay.appendChild(pc); }
       showReview(o);
    if (last && last !== 'ready' && o.status === 'ready' && navigator.vibrate) navigator.vibrate([250, 120, 250]);
    last = o.status;
  }

  function stop() { clearTimeout(timer); timer = null; }
  function schedule(ms) { stop(); timer = setTimeout(poll, ms || (last === 'done' || last === 'cancelled' ? 60000 : last === 'ready' ? 30000 : 15000)); }

  function poll() {
    if (document.hidden) return schedule();
    fetch('/api/orders?id=' + encodeURIComponent(id), { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return { gone: true };
      if (!r.ok) throw 0; return r.json();
    }).then(function (d) {
      failed = 0; $('live').className = 'tk-live'; $('live').textContent = 'This page updates by itself. No need to refresh.';
      // Right after ordering, this page can load a moment before the order has finished saving
      // (slow mobile data), so give a brand-new link ~30s before saying it doesn't exist.
      if (d.gone) { if (!last && ++misses < 10) return schedule(3000); return notFound(!!last); }
      render(d.order); schedule();
    }).catch(function () {
      failed++; $('live').className = 'tk-live off'; $('live').textContent = 'Connection lost. Trying again…'; schedule();
    });
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden && timer) { stop(); poll(); } });
  if (!UUID.test(id)) notFound(false); else poll();
})();
