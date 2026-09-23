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

// --- Strip-line type reveal: plain IntersectionObserver, deliberately NOT
//     wired to GSAP/ScrollTrigger/Lenis. A continuous scrub tween tied to
//     scroll position can drift out of sync with Lenis's smoothed scroll
//     value, which is what was leaving the words stuck dim. This just
//     watches for the line actually entering view and fades it in once —
//     runs on every page regardless of whether GSAP loaded. ---
(function revealStripLine() {
  const stripLine = document.getElementById('stripLine');
  if (!stripLine) return;
  const text = stripLine.textContent.trim();
  stripLine.innerHTML = text.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ');
  const words = stripLine.querySelectorAll('.word');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    words.forEach((w) => (w.style.opacity = 1));
    return;
  }

  words.forEach((w, i) => (w.style.transitionDelay = `${i * 45}ms`));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          stripLine.classList.add('in-view');
          io.disconnect();
        }
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
