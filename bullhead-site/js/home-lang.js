(function () {
  var STORAGE_KEY = 'bullheadLang';
  var els = document.querySelectorAll('[data-sw]');
  els.forEach(function (el) { el.dataset.en = el.innerHTML; });
  var toggle = document.getElementById('langToggle');
  var stripLine = document.getElementById('stripLine');

  // Plain-text (tag-stripped) version of a data-en/data-sw value, used to
  // rebuild stripLine's word-by-word <span> markup so the scroll reveal
  // (main.js) keeps working after a language switch.
  function textOf(html) {
    var t = document.createElement('div');
    t.innerHTML = html;
    return t.textContent.trim();
  }

  function apply(lang) {
    els.forEach(function (el) {
      var target = lang === 'sw' ? el.dataset.sw : el.dataset.en;

      if (el === stripLine) {
        var wrapped = textOf(target).split(' ').map(function (w) {
          return '<span class="word">' + w + '</span>';
        }).join(' ');
        // Same language already rendered — skip the rewrite entirely so we
        // don't silently swap out the exact spans GSAP's reveal is
        // animating (or already animated) for freshly-parsed duplicates.
        if (el.innerHTML === wrapped) return;
        el.innerHTML = wrapped;
        // If the reveal already ran (or never needed to, e.g. reduced
        // motion), the new spans should appear at full opacity right away
        // instead of falling back to their dim, unrevealed default —
        // otherwise switching language would re-hide already-shown text.
        if (stripLine.dataset.revealed === '1') {
          stripLine.classList.add('in-view');
          stripLine.querySelectorAll('.word').forEach(function (w) { w.style.opacity = 1; });
        }
        return;
      }

      if (el.innerHTML === target) return; // nothing changed, avoid pointless DOM churn
      el.innerHTML = target;
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
