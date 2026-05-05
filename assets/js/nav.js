/* =============================================================================
 * SY ACADEMY · nav.js
 * =============================================================================
 * Navbar sticky scroll · Countdown banner · Fade-in observer · Mobile menu
 * Aucune dépendance externe. Respect prefers-reduced-motion.
 * ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------------
   * 1 / NAVBAR — état "scrolled" au-delà de 8px
   * ------------------------------------------------------------------------ */
  const navbar = document.getElementById('navbar') || document.querySelector('.navbar');

  if (navbar) {
    let ticking = false;
    const updateNavbar = () => {
      if (window.scrollY > 8) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    }, { passive: true });

    updateNavbar();
  }

  /* ---------------------------------------------------------------------------
   * 2 / NAV LINKS — état actif basé sur le pathname courant
   * ------------------------------------------------------------------------ */
  const navLinks = document.querySelectorAll('.nav-links a[href]');
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http')) return;
    const linkPath = href.replace(/\/$/, '') || '/';
    if (linkPath === currentPath) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* ---------------------------------------------------------------------------
   * 3 / MOBILE MENU — toggle + Escape + clic extérieur
   * ------------------------------------------------------------------------ */
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navList = document.querySelector('.nav-links');

  if (menuBtn && navList) {
    const closeMenu = () => {
      menuBtn.setAttribute('aria-expanded', 'false');
      navList.classList.remove('is-open');
      document.body.classList.remove('nav-open');
    };

    const openMenu = () => {
      menuBtn.setAttribute('aria-expanded', 'true');
      navList.classList.add('is-open');
      document.body.classList.add('nav-open');
    };

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) closeMenu(); else openMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', (e) => {
      if (!navList.contains(e.target) && !menuBtn.contains(e.target)) {
        closeMenu();
      }
    });

    navList.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => closeMenu());
    });
  }

  /* ---------------------------------------------------------------------------
   * 4 / FADE-IN — IntersectionObserver pour les .fade-in
   * ------------------------------------------------------------------------ */
  const fadeEls = document.querySelectorAll('.fade-in');

  if (fadeEls.length > 0) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      fadeEls.forEach((el) => el.classList.add('visible'));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      fadeEls.forEach((el) => observer.observe(el));
    }
  }

  /* ---------------------------------------------------------------------------
   * 6 / SMOOTH SCROLL — ancres internes (avec compensation navbar)
   * ------------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();

      const navHeight = navbar ? navbar.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;

      window.scrollTo({
        top,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });
  });
})();
