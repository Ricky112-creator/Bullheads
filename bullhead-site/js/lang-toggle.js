(function () {
  var STORAGE_KEY = 'bullheadLang';
  var els = document.querySelectorAll('[data-sw]');
  els.forEach(function (el) { el.dataset.en = el.innerHTML; });
  var toggle = document.getElementById('langToggle');

  function apply(lang) {
    els.forEach(function (el) {
      el.innerHTML = lang === 'sw' ? el.dataset.sw : el.dataset.en;
    });
    if (toggle) toggle.textContent = lang === 'sw' ? 'EN' : 'SW';
  }

  var saved = localStorage.getItem(STORAGE_KEY) || 'en';
  apply(saved);

  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = localStorage.getItem(STORAGE_KEY) || 'en';
      var next = current === 'en' ? 'sw' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    });
  }
})();
