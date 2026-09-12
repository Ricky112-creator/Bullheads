// ============================================
// BULLHEAD — motion, kept deliberate and sparse
// ============================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Always land at the top of a freshly loaded page ---
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));

// --- Cart badge on Contact links, so a pending order stays visible ---
if (typeof getCart === 'function') {
  const count = cartCount(getCart());
  if (count > 0) {
    document.querySelectorAll('a[href="contact.html"]').forEach((a) => {
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

  const stripLine = document.getElementById('stripLine');
  if (stripLine) {
    const text = stripLine.textContent.trim();
    stripLine.innerHTML = text.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ');
    const words = stripLine.querySelectorAll('.word');
    if (!reduceMotion) {
      gsap.to(words, {
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: { trigger: stripLine, start: 'top 75%', end: 'bottom 55%', scrub: 0.6 },
      });
    } else {
      words.forEach((w) => (w.style.opacity = 1));
    }
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
} else {
  console.warn('Bullhead: GSAP failed to load — animations skipped, core site still works.');
  const stripLine = document.getElementById('stripLine');
  if (stripLine) stripLine.style.opacity = 1;
}
