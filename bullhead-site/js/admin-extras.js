// Owner dashboard extras. External file on purpose: the page's Content-Security-Policy blocks inline scripts.
(function () {
  var $ = function (i) { return document.getElementById(i); };

  // ---------- Install button (small icon in the header) ----------
  // Android / desktop Chrome and Edge: the browser says "this can be installed" (beforeinstallprompt) and we show the icon.
  // iPhone / iPad: there is no such event and Apple only allows installing through Share > Add to Home Screen,
  // so the icon shows in Safari and tapping it explains the two taps. Inside the installed app the icon never shows.
  var btn = $('installBtn'), deferred = null;
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ios() { var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function say(msg) { var t = $('toast'); if (!t) return; t.textContent = msg; t.className = 'show'; clearTimeout(say.h); say.h = setTimeout(function () { t.className = ''; }, 9000); }
  if (btn && !standalone()) {
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.hidden = false; });
    if (ios()) btn.hidden = false;
    btn.addEventListener('click', function () {
      if (deferred) {
        var d = deferred; deferred = null; btn.hidden = true;
        d.prompt();
        d.userChoice.then(function (c) { if (c && c.outcome !== 'accepted') { deferred = d; btn.hidden = false; } }).catch(function () {});
      } else if (ios()) {
        say('To install: tap the Share button in Safari, then Add to Home Screen. Open Bullhead Admin from your Home Screen after that.');
      }
    });
    window.addEventListener('appinstalled', function () { btn.hidden = true; deferred = null; });
  }

  // ---------- Settings tidy-ups ----------
  // Wipe anything typed into the Settings sheet whenever it closes.
  var sm = $('setModal');
  function clearSettingsFields() {
    if (!sm) return;
    sm.querySelectorAll('input[type="password"], input[type="text"]').forEach(function (i) { i.value = ''; });
    var show = $('pwShow'); if (show) show.checked = false;
    var form = $('pwForm'); if (form) form.hidden = true;
  }
  if (sm) new MutationObserver(function () { if (sm.hasAttribute('hidden')) clearSettingsFields(); }).observe(sm, { attributes: true, attributeFilter: ['hidden'] });

  // The Settings gear only makes sense once signed in: keep it in step with the dashboard being visible.
  var app = $('app'), gear = $('setBtn');
  if (app && gear) {
    var sync = function () { gear.hidden = app.hidden; };
    sync();
    // Belt and braces: even if the gear were somehow clicked while signed out, the Settings sheet must not open.
    gear.addEventListener('click', function (e) { if (app.hidden) { e.stopImmediatePropagation(); e.preventDefault(); if (sm) sm.hidden = true; } }, true);
    new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
