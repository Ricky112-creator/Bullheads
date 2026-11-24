/* Bullhead offline notice. Shows a small message when the visitor has no connection (including Wi-Fi with no internet),
   with a Call us button (a phone call works on airtime), and "Back online" when it returns. Additive: changes nothing else on the page. */
(function () {
  "use strict";
  var el = null, hideT = null, state = null, busy = false;
  function sw() { try { return localStorage.getItem("bullheadLang") === "sw"; } catch (e) { return false; } }
  function phone() {
    try { var m = document.querySelector("meta[name=\"bh-actions\"]"); if (m) { var t = JSON.parse(m.content).tel; if (t) return t; } } catch (e) {}
    var a = document.querySelector("a[href^=\"tel:\"]"); return a ? a.getAttribute("href").replace(/^tel:/, "") : "";
  }
  function build() {
    if (el) return el;
    el = document.createElement("div"); el.className = "bh-off"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el); return el;
  }
  function show(kind) {
    var box = build(); box.textContent = ""; box.className = "bh-off on is-" + kind; clearTimeout(hideT);
    var p = document.createElement("span");
    if (kind === "off") {
      p.textContent = sw() ? "Hauna mtandao. Bado unaweza kuona menyu na kuchagua oda yako, lakini kuituma kunahitaji mtandao." : "You are offline. You can still browse the menu and build your order, but sending it needs a connection.";
      box.appendChild(p);
      var tel = phone();
      if (tel) { var a = document.createElement("a"); a.href = "tel:" + tel; a.textContent = sw() ? "Piga simu" : "Call us"; box.appendChild(a); }
      var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", sw() ? "Funga" : "Close"); x.textContent = "\u00d7";
      x.addEventListener("click", function () { box.classList.remove("on"); }); box.appendChild(x);
    } else {
      p.textContent = sw() ? "Mtandao umerudi." : "Back online."; box.appendChild(p);
      hideT = setTimeout(function () { box.classList.remove("on"); }, 3000);
    }
  }
  function set(next) {
    if (next === state) return;
    var was = state; state = next;
    if (next === "off") show("off"); else if (was === "off") show("on");
  }
  /* a tiny HEAD request that the service worker never answers from memory, so Wi-Fi with no internet is detected too */
  function probe() {
    if (busy) return; busy = true;
    var done = function (ok) { busy = false; set(ok ? "on" : "off"); };
    if (navigator.onLine === false) return done(false);
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); done(false); }, 6000);
    fetch("/favicon.ico?bh-probe=" + Date.now(), { method: "HEAD", cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(t); if (busy) done(r && r.status > 0 && r.status < 500); }, function () { clearTimeout(t); if (busy) done(false); });
  }
  window.addEventListener("offline", function () { busy = false; set("off"); });
  window.addEventListener("online", function () { busy = false; probe(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) probe(); });
  setInterval(function () { if (!document.hidden) probe(); }, 90000);
  setInterval(function () { if (!document.hidden && state === "off") probe(); }, 20000);
  setTimeout(probe, 2500);
})();
