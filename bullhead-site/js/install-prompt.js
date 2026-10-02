(function () {
  var INSTALLED_KEY = 'bullheadInstalled';

  var deferredPrompt = null;
  var btn = document.getElementById('installBtn');
  if (!btn) return;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function markInstalled() {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
  }
  function alreadyInstalled() {
    try { return localStorage.getItem(INSTALLED_KEY) === '1' || isStandalone(); } catch (e) { return isStandalone(); }
  }

  if (isStandalone()) {
    markInstalled(); // caught here even if 'appinstalled' never fired (e.g. manual Add to Home Screen)
    btn.hidden = true;
    return; // running as the installed app itself — nothing to prompt, no listeners needed
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (alreadyInstalled()) return;
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    btn.hidden = true;
    deferredPrompt.prompt();
    deferredPrompt.userChoice
      .then(function (choice) {
      })
      .catch(function (err) {
        console.error('[install] prompt() failed', err);
      })
      .finally(function () {
        deferredPrompt = null;
      });
  });

  window.addEventListener('appinstalled', function () {
    btn.hidden = true;
    deferredPrompt = null;
    markInstalled();
  });
})();
