// ============================================
// BULLHEAD — motion, kept deliberate and sparse
// ============================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Register the service worker: needed for the site to be reliably
//     "installable" (rather than beforeinstallprompt firing but prompt()
//     resolving with nothing actually shown), and gives the installed app
//     a basic offline fallback. ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// --- Always land at the top of a freshly loaded page ---
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));

// --- Owner-posted live update bar: fetches /api/updates (a Cloudflare
//     Pages Function backed by KV) and shows the most recent one if it's
//     still live. Silently does nothing if the endpoint is missing/errors,
//     so this degrades gracefully wherever it hasn't been deployed yet. ---
(function loadLiveUpdate() {
  const bar = document.getElementById('liveUpdateBar');
  if (!bar) return;
  const WA = 'https://wa.me/254720707323?text=';
  const LABEL = { special: "Today's special", stock: 'Fresh in', notice: 'Update', closing: 'Heads up' };
  const nav = document.querySelector('.site-nav');
  const root = document.documentElement;

  // Keep the strip glued to the bottom edge of the nav, even as the nav shrinks on scroll.
  if (nav && 'ResizeObserver' in window) {
    new ResizeObserver(() => root.style.setProperty('--nav-h', nav.offsetHeight + 'px')).observe(nav);
  }

  const dismissed = () => { try { return JSON.parse(sessionStorage.getItem('bhDismissed') || '[]'); } catch (e) { return []; } };

  function build(items) {
    const first = items[0];
    bar.className = 'live-update-bar type-' + first.type;
    bar.innerHTML = '';

    const pill = document.createElement('span');
    pill.className = 'lu-pill';
    pill.innerHTML = '<i class="lu-dot"></i>';
    pill.append(LABEL[first.type] || 'Update');

    const ticker = document.createElement('div');
    ticker.className = 'lu-ticker';
    const track = document.createElement('div');
    track.className = 'lu-track';
    const text = items.map((u) => u.text).join('   •   ');
    for (let k = 0; k < 2; k++) {           // two copies = seamless loop
      const s = document.createElement('span');
      s.textContent = text;
      if (k) s.setAttribute('aria-hidden', 'true');
      track.appendChild(s);
    }
    track.style.animationDuration = Math.max(14, text.length * 0.22) + 's';
    ticker.appendChild(track);
    bar.append(pill, ticker);

    const cta = items.find((u) => u.cta !== false);
    if (cta) {
      const a = document.createElement('a');
      a.className = 'lu-cta'; a.target = '_blank'; a.rel = 'noopener';
      a.href = WA + encodeURIComponent('Hi Bullhead, I saw your update: "' + cta.text + '"');
      a.textContent = (cta.type === 'notice' || cta.type === 'closing') ? 'Ask on WhatsApp' : 'Order on WhatsApp';
      a.onclick = () => { try { navigator.sendBeacon('/api/updates?tap=' + cta.id, '{}'); } catch (e) {} };
      bar.appendChild(a);
    }

    const x = document.createElement('button');
    x.className = 'lu-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
    x.onclick = () => {
      try { sessionStorage.setItem('bhDismissed', JSON.stringify(dismissed().concat(items.map((n) => n.id)))); } catch (e) {}
      bar.hidden = true;
      document.body.classList.remove('has-live-update');
    };
    bar.appendChild(x);
  }

  fetch('/api/updates')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const gone = dismissed();
      const items = ((data && data.updates) || []).filter((u) => u.text && !gone.includes(u.id));
      if (!items.length) return;
      if (nav) root.style.setProperty('--nav-h', nav.offsetHeight + 'px');
      build(items);
      bar.hidden = false;
      document.body.classList.add('has-live-update'); // pushes the hero badge down, see CSS
    })
    .catch(() => {});
})();

// --- Live Emali clock in the "Open now" badge (Nairobi time, whatever the visitor's timezone) ---
(function emaliClock() {
  const el = document.getElementById('obTime');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', hour: 'numeric', minute: '2-digit', hour12: true });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 15000);
})();

// --- Table QR: capture ?table=N from the URL, remember it briefly.
//     Printed QR at each table links to /menu?table=5 (or /contact?table=5).
//     getActiveTable() is used by contact-page.js to tag the order. ---
const TABLE_KEY = 'bullheadTable';
const TABLE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — long enough for one visit

(function captureTableParam() {
  const table = new URLSearchParams(window.location.search).get('table');
  if (table) {
    try {
      localStorage.setItem(TABLE_KEY, JSON.stringify({ table, ts: Date.now() }));
    } catch (e) {}
  }
})();

function getActiveTable() {
  try {
    const raw = localStorage.getItem(TABLE_KEY);
    if (!raw) return null;
    const { table, ts } = JSON.parse(raw);
    if (!table || Date.now() - ts > TABLE_TTL_MS) {
      localStorage.removeItem(TABLE_KEY);
      return null;
    }
    return table;
  } catch (e) {
    return null;
  }
}

// --- Cart badge on Contact links, so a pending order stays visible.
//     Counts distinct items, not summed quantity, so a kg item doesn't
//     turn the badge into something like "3.5". ---
if (typeof getCart === 'function') {
  const cart = getCart();
  const count = Object.keys(cart).length;
  if (count > 0) {
    document.querySelectorAll('a[href="/contact"]').forEach((a) => {
      if (a.querySelector('.nav-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = count;
      a.appendChild(badge);
    });
  }
}

// --- Mobile menu toggle: runs first, no dependency on GSAP loading ---
const navBurger = document.getElementById('navBurger');
const mobileMenu = document.getElementById('mobileMenu');
if (navBurger && mobileMenu) {
  navBurger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    navBurger.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      navBurger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// --- Nav solid-on-scroll: plain scroll listener, also not GSAP-dependent ---
const nav = document.getElementById('siteNav');
const bannerEl = document.querySelector('.hero, .page-hero');
if (nav) {
  if (bannerEl) {
    const toggleNav = () => {
      const bannerBottom = bannerEl.getBoundingClientRect().bottom;
      nav.classList.toggle('scrolled', bannerBottom <= 80);
    };
    window.addEventListener('scroll', toggleNav, { passive: true });
    toggleNav();
  } else {
    nav.classList.add('scrolled');
  }
}

// --- Strip-line word wrap: always runs, so the markup is ready whether
//     or not GSAP ends up loading. The actual reveal animation is chosen
//     below depending on what's available. ---
(function setupStripLine() {
  const stripLine = document.getElementById('stripLine');
  if (!stripLine || stripLine.dataset.wordsReady) return;
  const text = stripLine.textContent.trim();
  stripLine.innerHTML = text.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ');
  stripLine.dataset.wordsReady = '1';
})();

// --- Strip-line reveal: driven by IntersectionObserver rather than
//     ScrollTrigger's pixel-position math, which is cached at setup time
//     and can end up wrong on a cold first load — before the hero photo and
//     web fonts finish loading and shift the real layout height, the "once"
//     trigger's boundary is calculated against the wrong position, and the
//     word-by-word fade can end up permanently stuck half-dim on that visit.
//     IntersectionObserver just watches real visibility, so it isn't
//     affected by that. Still uses GSAP's tween (when available) for the
//     same eased stagger feel, just triggered by actual visibility. ---
(function revealStripLine() {
  const stripLine = document.getElementById('stripLine');
  if (!stripLine) return;

  // Re-query .word elements at animation time rather than capturing them
  // once at setup. The language toggle can replace stripLine's children
  // (e.g. on load, or when the visitor switches language) between this
  // setup running and the observer actually firing on scroll; querying
  // fresh here means we always animate whatever spans are on screen right
  // now, instead of a stale, possibly-detached set.
  function currentWords() {
    return stripLine.querySelectorAll('.word');
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    currentWords().forEach((w) => (w.style.opacity = 1));
    stripLine.dataset.revealed = '1';
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const words = currentWords();
        if (window.gsap) {
          gsap.to(words, {
            opacity: 1,
            stagger: 0.08,
            ease: 'none',
            duration: 0.6,
          });
        } else {
          words.forEach((w, i) => { w.style.transitionDelay = `${i * 45}ms`; });
          stripLine.classList.add('in-view');
        }
        stripLine.dataset.revealed = '1';
        io.disconnect();
      });
    },
    { threshold: 0.4 }
  );
  io.observe(stripLine);
})();

// --- Everything below is animation polish and needs GSAP.
//     If it failed to load, skip it quietly — core site still works. ---
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  let lenis;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
  }

  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    gsap.to(progressFill, {
      width: '100%',
      ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
  }

  const heroImg = document.getElementById('heroImg');
  const heroSection = document.getElementById('hero');
  if (heroImg && heroSection && !reduceMotion) {
    gsap.to(heroImg, {
      scale: 1.0,
      ease: 'none',
      scrollTrigger: { trigger: heroSection, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  gsap.utils.toArray('.location-card, .kitchen-card, .explore-card').forEach((card) => {
    gsap.fromTo(
      card,
      { y: reduceMotion ? 0 : 24, opacity: reduceMotion ? 1 : 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
      }
    );
  });

  // --- Trigger positions above are cached in pixels at setup time. The hero
  //     photo and web fonts finish loading after that, shifting real layout
  //     height — so a refresh once everything has actually settled keeps the
  //     scrub/once animations synced to where content really sits on the page. ---
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  if (heroImg && !heroImg.complete) heroImg.addEventListener('load', refresh, { once: true });
} else {
  console.warn('Bullhead: GSAP failed to load — animations skipped, core site still works.');
}
