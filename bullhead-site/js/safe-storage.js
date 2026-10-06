// Safari can refuse localStorage/sessionStorage (e.g. "Block All Cookies"). Reading it then throws and would blank the page.
// If that happens, fall back to in-memory storage for this visit. Does nothing when storage works.
(function () {
  ['localStorage', 'sessionStorage'].forEach(function (n) {
    try { var s = window[n]; s.setItem('__bh', '1'); s.removeItem('__bh'); }
    catch (e) {
      var m = {}, has = function (k) { return Object.prototype.hasOwnProperty.call(m, k); };
      var fake = { getItem: function (k) { return has(k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, clear: function () { m = {}; }, key: function (i) { return Object.keys(m)[i] || null; } };
      try { Object.defineProperty(window, n, { value: fake, configurable: true }); } catch (e2) {}
    }
  });
})();
