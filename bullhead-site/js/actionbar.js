/* Bullhead mobile action bar: Order / WhatsApp / Call / Map. Reads <meta name="bh-actions">. Mobile only, shown after the hero. */
/* ----- mobile action bar (home, visit, contact, gallery) ----- */
(function () {
  var m = document.querySelector('meta[name="bh-actions"]');
  if (!m || document.getElementById('stAbar')) return;
  var c; try { c = JSON.parse(m.getAttribute('content')); } catch (e) { return; }
  var ic = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v7a3 3 0 0 0 3 3v6"/><path d="M7 4v6"/><path d="M10 4v7a3 3 0 0 1-3 3"/><path d="M18 20V4c-2.2 1.2-3.5 3.8-3.5 7.5V14H18"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>'
  };
  var bar = document.createElement('nav'); bar.id = 'stAbar'; bar.className = 'st-abar'; bar.setAttribute('aria-label', 'Quick actions');
  bar.innerHTML =
    '<a class="st-go" href="/menu">' + ic.menu + '<span data-sw="Agiza">Order</span></a>' +
    '<a href="' + c.wa + '" target="_blank" rel="noopener">' + ic.wa + '<span>WhatsApp</span></a>' +
    '<a href="tel:' + c.tel + '">' + ic.tel + '<span data-sw="Piga simu">Call</span></a>' +
    '<a href="' + c.map + '" target="_blank" rel="noopener">' + ic.map + '<span data-sw="Ramani">Map</span></a>';
  document.body.appendChild(bar); document.body.classList.add('has-abar');
  var home = !!document.querySelector('.hero'), typing = false;
  function upd() { var past = !home || window.scrollY > (window.innerHeight || 700) * .7; bar.classList.toggle('is-in', past && !typing); }
  window.addEventListener('scroll', upd, { passive: true });
  document.addEventListener('focusin', function (e) { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { typing = true; upd(); } });
  document.addEventListener('focusout', function () { typing = false; upd(); });
  upd();
})();

(function () {
  var hero = document.querySelector('.hero'); if (!hero) return;
  function upd() { document.body.classList.toggle('st-past', hero.getBoundingClientRect().bottom < 90); }
  window.addEventListener('scroll', upd, { passive: true }); upd();
})();
